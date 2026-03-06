# Phase 4: Workflow Orchestration - Research

**Researched:** 2026-03-06
**Domain:** Temporal TypeScript SDK -- workflow orchestration, child workflows, queries, retry policies, task queues
**Confidence:** HIGH

## Summary

Phase 4 wires the existing AI generation activities (Phase 2) and browser execution activities (Phase 3) into end-to-end Temporal workflows. The project already has Temporal SDK v1.15.0 installed and configured, a working hello-world parent-child workflow spike, 6 activities (crawlDom, generateSteps, validateSteps, executeStepsActivity, executeViewportsActivity, hello/greet), a browser pool with graceful shutdown, and a Temporal client helper. The primary work is composing these existing pieces into production workflows with proper retry policies, status queries, heartbeats, and multi-viewport fan-out via child workflows.

The standard approach is a parent workflow (`testRunWorkflow`) that orchestrates the full pipeline sequentially -- crawl, generate, validate, then fan out execution to child workflows per viewport. Each child workflow (`viewportExecutionWorkflow`) runs the `executeStepsActivity` for a single viewport. The parent uses `defineQuery` to expose real-time status, and activities use `heartbeat()` for long-running operations. Result persistence happens in a final activity that writes to the database.

This phase also requires new database tables (`test_runs`, `test_run_results`, `test_run_steps`) and a new DB migration. The existing `crawlDom` and `validateSteps` activities need updating to use the browser pool instead of launching standalone browsers.

**Primary recommendation:** Use a single parent workflow with sequential activity stages and parallel child workflows only for the viewport fan-out step. Keep all activities on one task queue initially; separate task queues (INFR-03) can be introduced later as an optimization without workflow code changes.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@temporalio/workflow` | 1.15.0 | Workflow definitions, `defineQuery`, `setHandler`, `executeChild`, `proxyActivities` | Already installed, deterministic sandbox for durable workflows |
| `@temporalio/activity` | 1.15.0 | Activity implementations, `heartbeat()`, `activityInfo()` | Already installed, provides heartbeat and context for long-running activities |
| `@temporalio/client` | 1.15.0 | Starting workflows, querying status via `WorkflowHandle` | Already installed, client-side workflow management |
| `@temporalio/worker` | 1.15.0 | Worker process creation, activity registration | Already installed, bundles workflows and runs activities |
| `@temporalio/common` | 1.15.0 | `ApplicationFailure` for non-retryable errors | Transitive dependency already present |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `drizzle-orm` | (existing) | Persist test run results to PostgreSQL | Final activity writes results |
| `nanoid` | 5.x (existing) | Generate unique test run IDs | When creating test_run records |
| `generic-pool` | 3.9.x (existing) | Browser pool for crawl/validate/execute activities | Already used by execute activities |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Single task queue | Multiple task queues per INFR-03 | Multiple queues add operational complexity; defer to after basic orchestration works. The `taskQueue` option in `proxyActivities` makes this a config change, not an architectural change |
| `executeChild` for viewports | `executeViewportsActivity` (existing sequential activity) | Child workflows give independent retry per viewport and avoid event history bloat; activity runs all viewports sequentially with no isolation |
| `client.workflow.execute` (blocking) | `client.workflow.start` + polling | `start` returns immediately -- better for server functions that should respond fast |

**Installation:**
```bash
# No new packages needed -- all Temporal SDK packages are already installed
# DB schema changes will use existing drizzle-kit tooling
pnpm --filter @validater/db drizzle-kit generate
pnpm --filter @validater/db drizzle-kit migrate
```

## Architecture Patterns

### Recommended Project Structure
```
packages/worker/src/
├── activities/
│   ├── crawl-dom.activity.ts          # EXISTING -- update to use browser pool
│   ├── generate-steps.activity.ts     # EXISTING -- no changes needed
│   ├── validate-steps.activity.ts     # EXISTING -- update to use browser pool
│   ├── execute-steps.activity.ts      # EXISTING -- no changes needed
│   ├── execute-viewports.activity.ts  # EXISTING -- may become unused (child workflows replace it)
│   ├── persist-results.activity.ts    # NEW -- write results to DB
│   └── hello.activity.ts             # EXISTING -- spike, can remain
├── workflows/
│   ├── test-run.workflow.ts           # NEW -- parent workflow (full pipeline)
│   ├── viewport-execution.workflow.ts # NEW -- child workflow (single viewport)
│   └── hello.workflow.ts              # EXISTING -- spike, can remain
├── browser/
│   ├── pool.ts                        # EXISTING
│   ├── memory-monitor.ts             # EXISTING
│   └── index.ts                       # EXISTING
├── worker.ts                          # UPDATE -- register all activities, new task queue
├── client.ts                          # EXISTING -- no changes
└── index.ts

packages/db/src/schema/
├── users.ts                           # EXISTING
├── test-runs.ts                       # NEW -- test_runs, test_run_results, test_run_steps tables
└── index.ts                           # UPDATE -- re-export new schema
```

### Pattern 1: Parent-Child Workflow with Status Queries
**What:** A parent workflow orchestrates the full test pipeline. It tracks its own status via a mutable variable, exposes it via `defineQuery`, and fans out viewport execution to child workflows.
**When to use:** Always -- this is THE primary workflow for Phase 4.
**Example:**
```typescript
// Source: Temporal official docs + project existing patterns
import {
  proxyActivities,
  defineQuery,
  setHandler,
  executeChild,
} from '@temporalio/workflow';
import type * as activities from '../activities/index.js';

// Define query at module level for type-safe client access
export const getTestRunStatus = defineQuery<TestRunStatus>('getTestRunStatus');

export interface TestRunStatus {
  phase: 'pending' | 'crawling' | 'generating' | 'validating' | 'executing' | 'persisting' | 'complete' | 'failed';
  viewportsComplete: number;
  viewportsTotal: number;
  error?: string;
}

const { crawlDom, generateSteps, validateSteps, persistResults } =
  proxyActivities<typeof activities>({
    startToCloseTimeout: '5 minutes',
    retry: {
      initialInterval: '1s',
      backoffCoefficient: 2,
      maximumInterval: '30s',
      maximumAttempts: 3,
    },
  });

export async function testRunWorkflow(params: TestRunParams): Promise<TestRunResult> {
  let status: TestRunStatus = {
    phase: 'pending',
    viewportsComplete: 0,
    viewportsTotal: params.viewports.length,
  };
  setHandler(getTestRunStatus, () => status);

  // Sequential pipeline stages
  status = { ...status, phase: 'crawling' };
  const crawlResult = await crawlDom({ url: params.url });

  status = { ...status, phase: 'generating' };
  const generateResult = await generateSteps({ /* ... */ });

  status = { ...status, phase: 'validating' };
  const validateResult = await validateSteps({ /* ... */ });

  // Fan out to child workflows for parallel viewport execution
  status = { ...status, phase: 'executing' };
  const viewportResults = await Promise.all(
    params.viewports.map((viewport) =>
      executeChild(viewportExecutionWorkflow, {
        args: [{ url: params.url, steps: validateResult.validatedSteps, viewport }],
        workflowId: `${params.testRunId}-viewport-${viewport}`,
      })
    )
  );

  // Persist results
  status = { ...status, phase: 'persisting', viewportsComplete: params.viewports.length };
  await persistResults({ testRunId: params.testRunId, results: viewportResults });

  status = { ...status, phase: 'complete' };
  return { /* aggregated results */ };
}
```

### Pattern 2: Child Workflow per Viewport
**What:** Each viewport gets its own child workflow with independent retry and event history.
**When to use:** For the viewport fan-out step in the parent workflow.
**Example:**
```typescript
// Source: Temporal official docs on child workflows
import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '../activities/index.js';

const { executeStepsActivity } = proxyActivities<typeof activities>({
  startToCloseTimeout: '10 minutes',
  heartbeatTimeout: '30s',
  retry: {
    initialInterval: '2s',
    backoffCoefficient: 2,
    maximumInterval: '1m',
    maximumAttempts: 3,
  },
});

export async function viewportExecutionWorkflow(params: {
  url: string;
  steps: TestStep[];
  viewport: ViewportConfig;
}): Promise<ExecutionResult> {
  return await executeStepsActivity({
    url: params.url,
    steps: params.steps,
    viewport: params.viewport,
  });
}
```

### Pattern 3: Activity Dependency Injection (for DB and Pool)
**What:** Use factory functions to inject shared dependencies (db connection, browser pool) into activities.
**When to use:** For the persist-results activity that needs the db client.
**Example:**
```typescript
// Source: Temporal official docs on dependency injection
import type { Database } from '@validater/db';

export const createPersistActivities = (db: Database) => ({
  async persistResults(params: PersistResultsParams): Promise<void> {
    await db.insert(testRuns).values({ /* ... */ });
    // ...
  },
});

// In worker.ts:
import { db } from '@validater/db';
const persistActivities = createPersistActivities(db);

const worker = await Worker.create({
  workflowsPath: require.resolve('./workflows/test-run.workflow'),
  activities: { ...coreActivities, ...persistActivities },
  taskQueue: 'test-pipeline',
});
```

### Pattern 4: Server Function Triggers Workflow (Non-Blocking)
**What:** The TanStack Start server function starts a workflow and returns the workflow ID immediately, rather than waiting for completion.
**When to use:** For the user-facing API that triggers test runs.
**Example:**
```typescript
// In packages/web/src/server/run-test.ts
export const runTest = createServerFn({ method: 'POST' })
  .inputValidator(RunTestInputSchema)
  .handler(async ({ data }) => {
    const { createTemporalClient } = await import('@validater/worker');
    const { testRunWorkflow } = await import('@validater/worker/workflows');

    const client = await createTemporalClient();
    const testRunId = nanoid();

    // Non-blocking: returns immediately
    const handle = await client.workflow.start(testRunWorkflow, {
      args: [{ testRunId, url: data.url, testDescription: data.testDescription, viewports: data.viewports }],
      taskQueue: 'test-pipeline',
      workflowId: testRunId,
    });

    return { testRunId, workflowId: handle.workflowId };
  });
```

### Anti-Patterns to Avoid
- **Importing activity implementations in workflow files:** Always use `import type` for activities in workflow files. The Temporal sandbox only allows deterministic code. Use `proxyActivities<typeof activities>()` to create proxied handles.
- **Running all viewports in a single activity:** The existing `executeViewportsActivity` runs viewports sequentially in one activity. For Phase 4, use child workflows instead -- each viewport gets independent retry, its own event history, and can run in parallel.
- **Blocking server function on workflow completion:** Use `client.workflow.start()` not `client.workflow.execute()` from server functions. Workflow execution can take minutes; the HTTP request should return immediately with a workflow/run ID.
- **Putting non-deterministic code in workflows:** No `Date.now()`, `Math.random()`, or network calls in workflow files. These break replay. Use activities for any side effects.
- **Giant monolithic workflow:** Don't put all activity calls in one massive workflow. Keep the parent workflow thin -- it calls activities and spawns child workflows. Heavy logic lives in activities.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Retry with backoff | Custom setTimeout retry loops | Temporal retry policies (`retry: { initialInterval, backoffCoefficient, maximumAttempts }`) | Temporal handles retry scheduling, preserves state across retries, and resumes from heartbeat checkpoints |
| Workflow status tracking | Custom polling/SSE status system | Temporal queries (`defineQuery` + `setHandler`) | Queries are built into the Temporal protocol, work across restarts, and require zero infrastructure |
| Task fan-out + aggregation | Custom Promise.all with error handling | `executeChild` + `Promise.all` in parent workflow | Child workflows have independent event histories, retry policies, and cancellation scopes |
| Activity progress reporting | Custom progress table in DB | `heartbeat()` from `@temporalio/activity` | Heartbeats are throttled automatically, checkpoint progress for retry resumption, and trigger timeout detection |
| Non-retryable error marking | Custom error classification | `ApplicationFailure.create({ nonRetryable: true })` from `@temporalio/common` | Integrates with Temporal's retry policy; errors marked non-retryable stop retries immediately |

**Key insight:** Temporal's value proposition IS handling retry, state, fan-out, and progress tracking. Building custom versions of these features defeats the purpose of using Temporal and creates two sources of truth for workflow state.

## Common Pitfalls

### Pitfall 1: Non-Deterministic Code in Workflow Files
**What goes wrong:** Using `Date.now()`, `Math.random()`, `setTimeout`, or direct I/O in workflow files causes replay failures. Temporal replays workflow event history on recovery, and non-deterministic operations produce different results on replay.
**Why it happens:** Developers treat workflow files like normal TypeScript. Temporal workflow files run in a sandboxed V8 isolate with deterministic replacements for timers and random.
**How to avoid:** All side effects go in activities. Workflows only call `proxyActivities` proxies, `executeChild`, `sleep` (Temporal's), `defineQuery`, `setHandler`, `defineSignal`.
**Warning signs:** Build-time warnings from Temporal's workflow bundler about disallowed imports; runtime "Nondeterminism" errors in Temporal UI.

### Pitfall 2: Activity Type-Only Import Violation
**What goes wrong:** Importing activity implementations (not just types) in workflow files pulls Node.js modules into the sandbox, causing bundling failures or runtime errors.
**Why it happens:** Easy to forget the `type` keyword in `import type * as activities from ...`.
**How to avoid:** Every workflow file that references activities MUST use `import type`. The existing hello workflow already demonstrates this pattern correctly. Use `proxyActivities<typeof activities>()` for the runtime proxy.
**Warning signs:** Worker fails to start with sandbox errors; `require` of node builtins fails.

### Pitfall 3: Exceeding Event History Limits
**What goes wrong:** A single workflow execution exceeds 51,200 events or 50 MB, causing Temporal to terminate it.
**Why it happens:** Running too many activities (especially viewport executions) within a single parent workflow. Each activity call adds ~5-10 events.
**How to avoid:** Use child workflows for the viewport fan-out. Each child has its own event history. The parent's event history only records child workflow start/complete events. With 3 viewports and ~10 steps each, the parent workflow should stay well under 1,000 events.
**Warning signs:** Temporal warns after 10,240 events or 10 MB. A parent should not spawn more than 1,000 child workflows.

### Pitfall 4: Browser Pool Not Available to Activities
**What goes wrong:** The `crawlDom` and `validateSteps` activities currently launch standalone browsers (not using the pool). If the worker process also runs pool-based execute activities, there are competing browser launches.
**Why it happens:** Phase 2 activities were written before the browser pool existed (Phase 3).
**How to avoid:** Update `crawlDom` and `validateSteps` activities to use `getDefaultPool()` like `executeStepsActivity` does. This ensures consistent browser lifecycle management.
**Warning signs:** Memory spikes from too many browser processes; "browser disconnected" errors.

### Pitfall 5: Forgetting heartbeatTimeout on Long-Running Activities
**What goes wrong:** Without `heartbeatTimeout`, Temporal cannot detect if an activity worker has crashed mid-execution. The activity runs until `startToCloseTimeout` expires, potentially wasting minutes.
**Why it happens:** `heartbeatTimeout` is optional and not set by default. Developers set `startToCloseTimeout` but forget heartbeats.
**How to avoid:** Set `heartbeatTimeout: '30s'` on activities that take more than 30 seconds (especially `executeStepsActivity` and `crawlDom`). Call `heartbeat()` periodically from those activities.
**Warning signs:** Stuck activities that take full timeout to fail; no heartbeat events in Temporal UI.

### Pitfall 6: Workflow ID Collisions
**What goes wrong:** Starting a workflow with a duplicate `workflowId` when a previous execution is still running causes a `WorkflowExecutionAlreadyStartedError`.
**Why it happens:** Using predictable IDs like `test-run-${userId}` without uniqueness.
**How to avoid:** Use `nanoid()` for test run IDs, which become the `workflowId`. For child workflows, use `${parentRunId}-viewport-${viewportName}` which is unique per parent execution.
**Warning signs:** "Workflow execution already started" errors from the client.

### Pitfall 7: Missing createRequire for workflowsPath in ESM
**What goes wrong:** `require.resolve()` is not available in ESM modules. The worker setup needs `createRequire(import.meta.url)` to resolve the workflow file path.
**Why it happens:** The project uses `"type": "module"` in package.json.
**How to avoid:** Already handled in the existing `worker.ts`. When updating the worker to point to new workflow files, continue using the `createRequire` pattern.
**Warning signs:** `ReferenceError: require is not defined` at worker startup.

## Code Examples

### Defining and Querying Workflow Status
```typescript
// Source: Temporal official docs (message-passing) + samples-typescript/state
// In workflow file:
import { defineQuery, setHandler } from '@temporalio/workflow';

export type TestRunPhase = 'pending' | 'crawling' | 'generating' | 'validating' | 'executing' | 'persisting' | 'complete' | 'failed';

export interface TestRunStatus {
  phase: TestRunPhase;
  viewportsComplete: number;
  viewportsTotal: number;
  error?: string;
}

export const getTestRunStatus = defineQuery<TestRunStatus>('getTestRunStatus');

// Inside workflow function:
let status: TestRunStatus = { phase: 'pending', viewportsComplete: 0, viewportsTotal: 3 };
setHandler(getTestRunStatus, () => status);

// Update status as pipeline progresses:
status = { ...status, phase: 'generating' };
```

```typescript
// Source: Temporal official docs (WorkflowHandle.query)
// Querying from client:
const handle = client.workflow.getHandle(testRunId);
const status = await handle.query(getTestRunStatus);
// status.phase => 'generating'
```

### Activity with Heartbeat
```typescript
// Source: Temporal official docs (failure-detection) + activity namespace API
import { heartbeat, activityInfo } from '@temporalio/activity';
import type { TestStep, ExecutionResult, ViewportConfig } from '@validater/core';
import { executeSteps } from '@validater/core';
import { getDefaultPool } from '../browser/pool.js';

export async function executeStepsActivity(params: {
  url: string;
  steps: TestStep[];
  viewport: ViewportConfig;
}): Promise<ExecutionResult> {
  const pool = getDefaultPool();
  const pooled = await pool.acquire();
  try {
    const context = await pooled.browser.newContext({
      viewport: { width: params.viewport.width, height: params.viewport.height },
      // ...
    });
    try {
      const page = await context.newPage();
      await page.goto(params.url, { waitUntil: 'networkidle', timeout: 30_000 });

      // Heartbeat before long execution
      heartbeat({ step: 0, total: params.steps.length });

      const stepResults = await executeSteps(page, params.steps, {
        // Could add per-step heartbeat callback here
      });

      return { /* ... */ };
    } finally {
      await context.close();
    }
  } finally {
    pooled.pagesProcessed++;
    await pool.release(pooled);
  }
}
```

### Non-Retryable Error for Invalid Input
```typescript
// Source: Temporal official docs (ApplicationFailure)
import { ApplicationFailure } from '@temporalio/common';

export async function crawlDom(options: CrawlOptions) {
  if (!options.url || !options.url.startsWith('http')) {
    throw ApplicationFailure.create({
      message: `Invalid URL: ${options.url}`,
      nonRetryable: true,
    });
  }
  // ... proceed with crawling
}
```

### Retry Policy Configuration
```typescript
// Source: Temporal official docs (RetryPolicy interface)
// For AI generation activities (expensive, rate-limited):
const { generateSteps } = proxyActivities<typeof activities>({
  startToCloseTimeout: '2 minutes',
  retry: {
    initialInterval: '5s',        // Wait 5s before first retry
    backoffCoefficient: 2,         // Double wait time each retry
    maximumInterval: '1 minute',   // Cap at 1 minute between retries
    maximumAttempts: 3,            // Max 3 attempts (1 initial + 2 retries)
    nonRetryableErrorTypes: ['InvalidInput'], // Don't retry bad input
  },
});

// For browser execution activities (may crash, need heartbeat):
const { executeStepsActivity } = proxyActivities<typeof activities>({
  startToCloseTimeout: '10 minutes',
  heartbeatTimeout: '30s',
  retry: {
    initialInterval: '2s',
    backoffCoefficient: 2,
    maximumInterval: '30s',
    maximumAttempts: 3,
  },
});

// For DB persistence (fast, reliable):
const { persistResults } = proxyActivities<typeof activities>({
  startToCloseTimeout: '30s',
  retry: {
    initialInterval: '1s',
    backoffCoefficient: 2,
    maximumInterval: '10s',
    maximumAttempts: 5,
  },
});
```

### Worker Setup with All Activities
```typescript
// Source: Project existing worker.ts + Temporal docs on dependency injection
import { createRequire } from 'node:module';
import { Worker } from '@temporalio/worker';
import { db } from '@validater/db';

// Activity imports (runtime -- not workflow sandbox)
import * as crawlActivities from './activities/crawl-dom.activity.js';
import * as generateActivities from './activities/generate-steps.activity.js';
import * as validateActivities from './activities/validate-steps.activity.js';
import * as executeActivities from './activities/execute-steps.activity.js';
import { createPersistActivities } from './activities/persist-results.activity.js';

const require = createRequire(import.meta.url);

async function run() {
  const persistActivities = createPersistActivities(db);

  const worker = await Worker.create({
    workflowsPath: require.resolve('./workflows/test-run.workflow'),
    activities: {
      ...crawlActivities,
      ...generateActivities,
      ...validateActivities,
      ...executeActivities,
      ...persistActivities,
    },
    taskQueue: 'test-pipeline',
  });

  console.log('Worker started on task queue: test-pipeline');
  await worker.run();
}

run().catch((err) => {
  console.error('Worker failed:', err);
  process.exit(1);
});
```

### Database Schema for Test Run Persistence
```typescript
// Source: Project DB conventions (drizzle-orm/pg-core)
import { pgTable, text, timestamp, integer, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const testRunStatusEnum = pgEnum('test_run_status', [
  'pending', 'crawling', 'generating', 'validating', 'executing', 'persisting', 'complete', 'failed'
]);

export const testRuns = pgTable('test_runs', {
  id: text('id').primaryKey(),                    // nanoid, also used as workflowId
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  testDescription: text('test_description').notNull(),
  status: testRunStatusEnum('status').notNull().default('pending'),
  viewports: jsonb('viewports').notNull(),         // string[] of viewport names
  error: text('error'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
});

export const testRunResults = pgTable('test_run_results', {
  id: text('id').primaryKey(),
  testRunId: text('test_run_id').notNull().references(() => testRuns.id, { onDelete: 'cascade' }),
  viewport: text('viewport').notNull(),
  url: text('url').notNull(),
  totalDurationMs: integer('total_duration_ms').notNull(),
  startedAt: timestamp('started_at').notNull(),
  completedAt: timestamp('completed_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const testRunSteps = pgTable('test_run_steps', {
  id: text('id').primaryKey(),
  resultId: text('result_id').notNull().references(() => testRunResults.id, { onDelete: 'cascade' }),
  stepId: text('step_id').notNull(),
  stepOrder: integer('step_order').notNull(),
  status: text('status').notNull(),                // 'pass' | 'fail'
  errorMessage: text('error_message'),
  errorExpected: text('error_expected'),
  errorActual: text('error_actual'),
  screenshotBase64: text('screenshot_base64'),
  durationMs: integer('duration_ms').notNull(),
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Temporal SDK < 1.0 `Workflow.execute` | SDK 1.x `proxyActivities` + `executeChild` | SDK 1.0 (2023) | All project code uses 1.x patterns correctly |
| Signals for status tracking | Queries preferred for read-only state | Always in SDK, docs clarified 2024 | Queries are simpler -- no async handler needed, no workflow mutation |
| `wf.condition()` for waiting | `setHandler` on queries | Ongoing | Condition is for signal-driven waits; queries are for external reads |
| Manual retry loops | Built-in `RetryPolicy` on activities | SDK 1.x | Never hand-roll retry logic in activities or workflows |

**Deprecated/outdated:**
- `@temporalio/testing` `TestWorkflowEnvironment` has replaced older testing approaches -- relevant for Phase 10 but not Phase 4
- `versioningIntent` in ActivityOptions is marked deprecated in the API docs

## Open Questions

1. **Separate task queues per worker type (INFR-03)**
   - What we know: `proxyActivities` accepts a `taskQueue` option to route activities to different queues. The parent workflow can route AI activities to one queue and browser activities to another.
   - What's unclear: Whether the complexity of running multiple worker processes (one per queue) is justified at this stage. The project has 3 viewports and moderate load.
   - Recommendation: Start with a single `test-pipeline` task queue. Document where to split later (AI activities vs browser activities). The code change is minimal -- add `taskQueue: 'ai-pipeline'` to the AI activity proxy and run a second worker.

2. **Screenshot storage strategy**
   - What we know: `screenshotBase64` is currently an in-memory base64 string on `StepResult`. With 3 viewports x 10 steps = 30 screenshots per test run, this could be significant.
   - What's unclear: Whether base64 in PostgreSQL `text` columns is acceptable for the MVP or if file storage (S3/disk) should be introduced now.
   - Recommendation: Store base64 in DB for now (Phase 4 MVP). Phase 7 (Video and Reporting) will likely introduce proper file storage. Base64 in Postgres works fine for low-moderate volume.

3. **Updating crawlDom and validateSteps to use browser pool**
   - What we know: These activities currently `chromium.launch()` their own browsers. Phase 3 introduced the browser pool.
   - What's unclear: Whether updating these activities is in scope for Phase 4 or was expected as Phase 3 cleanup.
   - Recommendation: Update them in Phase 4 as part of wiring activities into the production workflow. They need pool access anyway for consistent resource management.

## Sources

### Primary (HIGH confidence)
- Temporal official docs: [Core Application](https://docs.temporal.io/develop/typescript/core-application) -- workflow/activity definitions, worker setup, dependency injection
- Temporal official docs: [Child Workflows](https://docs.temporal.io/develop/typescript/child-workflows) -- executeChild, ParentClosePolicy
- Temporal official docs: [Message Passing](https://docs.temporal.io/develop/typescript/message-passing) -- defineQuery, setHandler, query from client
- Temporal official docs: [Failure Detection](https://docs.temporal.io/develop/typescript/failure-detection) -- retry policies, heartbeats, timeouts
- Temporal API reference: [ActivityOptions](https://typescript.temporal.io/api/interfaces/common.ActivityOptions) -- full interface
- Temporal API reference: [RetryPolicy](https://typescript.temporal.io/api/interfaces/common.RetryPolicy) -- all retry parameters
- Temporal API reference: [Activity namespace](https://typescript.temporal.io/api/namespaces/activity) -- heartbeat, activityInfo
- Temporal API reference: [WorkflowHandle](https://typescript.temporal.io/api/interfaces/client.WorkflowHandle) -- query, signal, result
- Temporal samples: [state/src/workflows.ts](https://github.com/temporalio/samples-typescript/blob/main/state/src/workflows.ts) -- defineQuery + setHandler pattern
- Temporal official docs: [Workflow Execution Limits](https://docs.temporal.io/workflow-execution/limits) -- 51,200 events, 50 MB
- Project codebase: packages/worker/ -- existing activities, workflows, browser pool, client

### Secondary (MEDIUM confidence)
- Temporal official docs: [Task Queues](https://docs.temporal.io/task-queue) -- multi-queue patterns, task routing
- Temporal community: [Multiple worker entities](https://community.temporal.io/t/worker-process-with-multiple-worker-entities-how-to/8498) -- running multiple workers in one process

### Tertiary (LOW confidence)
- None -- all findings verified with primary sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- SDK already installed at v1.15.0, all APIs verified against official docs and API reference
- Architecture: HIGH -- parent-child workflow pattern verified with official docs and already spiked in project (hello-world)
- Pitfalls: HIGH -- all pitfalls are documented in official Temporal docs or observed in the existing codebase
- DB schema: MEDIUM -- follows project conventions but exact column choices may need adjustment during implementation

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (Temporal SDK is stable; 30-day validity)
