# Architecture Research

**Domain:** AI-powered testing platform (URL + natural language -> test generation -> browser execution -> video results)
**Researched:** 2026-03-06
**Updated:** 2026-03-06 (API layer decision: TanStack Start server functions + Hono sidecar)
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         PRESENTATION LAYER                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                   │
│  │  React SPA   │  │  Live Stream │  │   Results    │                   │
│  │  (shadcn/ui) │  │   Viewer     │  │   Viewer     │                   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                   │
│         │ Server Fns       │ WebSocket        │ Server Fns               │
├─────────┴──────────────────┴─────────────────┴───────────────────────────┤
│                           API LAYER                                      │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐       │
│  │  TanStack Start  │  │   Hono Sidecar   │  │   Auth Middleware │       │
│  │  Server Functions │  │   (WebSocket/SSE)│  │   (Better Auth)  │       │
│  └────────┬─────────┘  └────────┬─────────┘  └──────────────────┘       │
├───────────┴──────────────────────┴───────────────────────────────────────┤
│                      ORCHESTRATION LAYER                                 │
│  ┌────────────────────────────────────────────────────────────────┐      │
│  │                    Temporal Server                              │      │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │      │
│  │  │ Test Run     │  │ Test Suite   │  │ Video       │           │      │
│  │  │ Workflow     │  │ Workflow     │  │ Processing  │           │      │
│  │  └──────┬──────┘  └──────┬──────┘  │ Workflow    │           │      │
│  │         │                │         └──────┬──────┘           │      │
│  └─────────┴────────────────┴────────────────┴───────────────────┘      │
├──────────────────────────────────────────────────────────────────────────┤
│                        WORKER LAYER                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │ AI Agent    │  │ Browser     │  │ Video       │  │ Notification│   │
│  │ Worker      │  │ Worker      │  │ Worker      │  │ Worker      │   │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────────────┘   │
│         │                │                │                             │
│    Claude API      Playwright        FFmpeg/                            │
│    Pi Agent        CDP Session       Processing                         │
├──────────────────────────────────────────────────────────────────────────┤
│                       DATA LAYER                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐               │
│  │ Postgres │  │ Redis    │  │ S3/Minio │  │ Temporal │               │
│  │ (app DB) │  │ (cache/  │  │ (videos/ │  │ (workflow│               │
│  │          │  │  pubsub) │  │  screens)│  │  state)  │               │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘               │
└──────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| React SPA | Dashboard, test creation, results display | React + shadcn/ui + TanStack Router/Query/Table |
| Live Stream Viewer | Real-time browser view during test execution | WebSocket client (connects to Hono sidecar) rendering CDP screencast frames |
| TanStack Start Server Functions | Type-safe API for all CRUD + query operations | `createServerFn()` with Zod validation and auth middleware |
| Hono Streaming Sidecar | WebSocket/SSE for live browser frame streaming | Hono server running alongside TanStack Start, subscribes to Redis pub/sub |
| Auth Middleware | Session management, route protection | Better Auth + TanStack Start middleware chain |
| Temporal Server | Workflow state, task queues, retry coordination | Self-hosted Temporal (Podman) or Temporal Cloud |
| Test Run Workflow | Orchestrates single test: generate -> execute -> record | Temporal workflow (deterministic orchestration) |
| Test Suite Workflow | Fan-out across viewports/browsers, fan-in results | Temporal child workflows for parallelism |
| AI Agent Worker | Generates test steps from URL + description | Pi agent + Claude API, Temporal activity |
| Browser Worker | Executes Playwright actions, captures screenshots/video | Playwright + CDP screencast, Temporal activity |
| Video Worker | Post-processes recordings into polished exports | FFmpeg, resolution conversion, Temporal activity |
| Postgres | Users, test runs, test results, test suites | Drizzle ORM, primary application database |
| Redis | Streaming pub/sub, caching, rate limiting | Used for fan-out of live stream frames to Hono sidecar |
| S3/MinIO | Video files, screenshots, trace files | Object storage with presigned URLs |

## Recommended Project Structure

```
validater/
├── packages/
│   ├── web/                    # TanStack Start app (frontend + API + streaming)
│   │   ├── src/
│   │   │   ├── routes/         # TanStack Router file-based routes
│   │   │   ├── components/     # shadcn/ui + custom components
│   │   │   ├── hooks/          # Custom React hooks
│   │   │   ├── server/         # Server functions (API layer)
│   │   │   │   ├── fns/        # Server function definitions (test, suite, user, etc.)
│   │   │   │   ├── middleware/ # Auth, rate limiting, logging middleware
│   │   │   │   └── services/   # Business logic called by server functions
│   │   │   ├── streaming/      # Hono sidecar for WebSocket/SSE
│   │   │   │   ├── server.ts   # Hono server entry point
│   │   │   │   └── handlers/   # WebSocket/SSE route handlers
│   │   │   ├── lib/            # Utilities, Temporal client
│   │   │   └── main.tsx
│   │   └── package.json
│   │
│   ├── worker/                 # Temporal workflows + activities
│   │   ├── src/
│   │   │   ├── workflows/      # Workflow definitions (deterministic)
│   │   │   │   ├── test-run.workflow.ts
│   │   │   │   ├── test-suite.workflow.ts
│   │   │   │   └── video-process.workflow.ts
│   │   │   ├── activities/     # Activity implementations
│   │   │   │   ├── ai-generate.activity.ts
│   │   │   │   ├── browser-execute.activity.ts
│   │   │   │   ├── screenshot.activity.ts
│   │   │   │   └── video-process.activity.ts
│   │   │   └── workers/        # Worker entry points
│   │   │       ├── ai-worker.ts
│   │   │       ├── browser-worker.ts
│   │   │       └── video-worker.ts
│   │   └── package.json
│   │
│   ├── agent/                  # AI agent logic
│   │   ├── src/
│   │   │   ├── prompts/        # System prompts, templates
│   │   │   ├── tools/          # Agent tools (browse, extract, analyze)
│   │   │   ├── schemas/        # Zod schemas for test step output
│   │   │   └── agent.ts        # Pi agent configuration
│   │   └── package.json
│   │
│   ├── core/                   # Shared types + utilities
│   │   ├── src/
│   │   │   ├── types/          # Shared TypeScript types
│   │   │   ├── schemas/        # Shared Zod schemas (test steps, results)
│   │   │   └── constants/      # Shared constants
│   │   └── package.json
│   │
│   └── db/                     # Database schema + migrations
│       ├── src/
│       │   ├── schema/         # Drizzle table definitions
│       │   ├── migrations/     # Generated migrations
│       │   └── client.ts       # Database client singleton
│       └── package.json
│
├── docker/                     # Container configs (Podman-compatible)
│   ├── temporal/               # Temporal server + dependencies
│   ├── playwright/             # Browser worker with Playwright
│   └── docker-compose.yml
│
├── turbo.json                  # Turborepo config
├── pnpm-workspace.yaml
└── package.json
```

### Structure Rationale

- **packages/web/:** Full-stack TanStack Start app. Server functions handle all API operations (auth, validation, Temporal dispatch). Hono streaming sidecar runs as a separate process from the same package for WebSocket/SSE live browser streaming. No separate API package needed.
- **packages/worker/:** All Temporal workflow and activity code isolated. Workflows are deterministic; activities contain all side effects. Separate worker processes per concern (AI, browser, video). Runs on Node.js 22 (required by Temporal SDK).
- **packages/agent/:** AI agent logic separate from Temporal. Temporal activity calls into this package. Allows testing agent logic independently.
- **packages/core/:** Types and schemas shared across all packages. Server functions infer types from here for end-to-end type safety.
- **packages/db/:** Drizzle ORM schema, migrations, and database client. Shared between web (server functions) and worker (activities).
- **Monorepo with Turborepo:** Enables shared types, parallel builds, and consistent tooling across packages. Bun as package manager, Node.js 22 as runtime.

## Architectural Patterns

### Pattern 1: Temporal Workflow as Orchestration Spine

**What:** Every user-initiated operation (run test, generate suite, process video) is a Temporal workflow. The server functions' only job is to start workflows and query their status.

**When to use:** Always -- this is the core architectural decision. Temporal owns all durable state and sequencing.

**Trade-offs:**
- (+) Automatic retries, timeouts, and failure handling
- (+) Full observability via Temporal UI
- (+) Resumable: if a worker crashes mid-test, another picks up
- (-) Adds infrastructure complexity (Temporal server, task queues)
- (-) Workflow code must be deterministic (no I/O, no randomness)
- (-) Local dev requires running Temporal (Podman)

**Example:**
```typescript
// workflows/test-run.workflow.ts
import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '../activities';

const ai = proxyActivities<typeof activities.aiActivities>({
  startToCloseTimeout: '2m',
  retry: { maximumAttempts: 3 },
});

const browser = proxyActivities<typeof activities.browserActivities>({
  startToCloseTimeout: '5m',
  heartbeatTimeout: '30s',
  retry: { maximumAttempts: 2 },
});

export async function testRunWorkflow(input: TestRunInput): Promise<TestRunResult> {
  // Step 1: AI generates test steps
  const testSteps = await ai.generateTestSteps({
    url: input.url,
    description: input.description,
  });

  // Step 2: Execute across viewports (parallel child workflows)
  const results = await Promise.all(
    input.viewports.map(viewport =>
      browser.executeTest({ steps: testSteps, viewport, url: input.url })
    )
  );

  // Step 3: Post-process results
  return { testSteps, results };
}
```

### Pattern 2: CDP Screencast for Live Streaming

**What:** Use Chrome DevTools Protocol `Page.startScreencast` to capture JPEG frames from the browser during Playwright execution, then stream them via Redis pub/sub to the Hono sidecar, which fans out over WebSocket to the frontend for real-time viewing.

**When to use:** When displaying live test execution to users. This is the only viable approach since Playwright does not support live video streaming (only post-execution video).

**Trade-offs:**
- (+) Real-time browser view with low latency (~100-200ms per frame)
- (+) No additional screen capture software needed
- (-) Chromium-only (Firefox/WebKit do not support CDP screencast)
- (-) Adds ~50-100KB per frame at 1280x720 JPEG quality 80
- (-) Requires managing CDP session lifecycle alongside Playwright

**Data flow:**
```
Browser Worker                  Hono Sidecar                   Frontend
     │                               │                              │
     │ CDP Page.startScreencast      │                              │
     │──────────────────────┐        │                              │
     │ screencastFrame event│        │                              │
     │<─────────────────────┘        │                              │
     │                               │                              │
     │ base64 JPEG frame ──Redis──> │ ────── WebSocket ──────────> │
     │                               │                              │ render
     │ ack frame ──────────────────> │                              │ <img>
     │                               │                              │
```

**Implementation notes:**
- Worker sends frames to Hono sidecar via Redis pub/sub (decouples worker from WebSocket connections)
- Hono sidecar subscribes to Redis channel for the test run ID and fans out to connected WebSocket clients
- Frontend receives frames and renders as `<img>` with `src={data:image/jpeg;base64,...}`
- Frame acknowledgment implements backpressure to avoid overwhelming clients
- Quality/framerate tunable: `everyNthFrame: 2` and `quality: 60` for bandwidth savings

### Pattern 3: Thin Server Functions, Fat Workers

**What:** TanStack Start server functions are intentionally thin: they handle auth (via middleware), input validation (via Zod), and workflow dispatch (via Temporal client). All business logic lives in Temporal workflows and activities (the workers).

**When to use:** Always. This prevents the web server from becoming a bottleneck and keeps business logic testable independently of HTTP concerns.

**Trade-offs:**
- (+) Web server is simple and stateless -- easy to scale horizontally
- (+) Workers can be scaled independently per resource type (AI workers need API quota, browser workers need memory)
- (+) Business logic is testable via Temporal's testing framework
- (-) Requires discipline to not leak logic into server function handlers

**Example:**
```typescript
// server/fns/test.ts
import { createServerFn } from '@tanstack/react-start';
import { authMiddleware } from '../middleware/auth';
import { createTestSchema } from '@validater/core/schemas';

export const createTest = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(createTestSchema)
  .handler(async ({ data, context }) => {
    // 1. Persist test run record
    const testRun = await db.insert(testRuns).values({
      userId: context.userSession.user.id,
      url: data.url,
      description: data.description,
      status: 'pending',
    });

    // 2. Start Temporal workflow (all logic lives there)
    const handle = await temporalClient.workflow.start(testRunWorkflow, {
      taskQueue: 'test-runs',
      workflowId: `test-run-${testRun.id}`,
      args: [{ testRunId: testRun.id, ...data }],
    });

    return { testRunId: testRun.id, workflowId: handle.workflowId };
  });

export const getTestStatus = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(z.object({ testRunId: z.string() }))
  .handler(async ({ data }) => {
    // Query Temporal for live status
    const handle = temporalClient.workflow.getHandle(`test-run-${data.testRunId}`);
    return handle.query(getStatusQuery);
  });
```

### Pattern 4: Separate Task Queues per Worker Type

**What:** Use distinct Temporal task queues for AI, browser, and video workers. This allows independent scaling and resource isolation.

**When to use:** Always. Browser workers need significant memory (Playwright browsers), AI workers need API quota management, video workers need CPU for FFmpeg.

**Trade-offs:**
- (+) Scale each worker type independently based on demand
- (+) Resource isolation: a spike in video processing does not starve browser execution
- (+) Can deploy different worker types on different hardware
- (-) More operational complexity (multiple worker processes to manage)

## Data Flow

### Primary Flow: User Input to Test Results

```
User enters URL + description
        │
        ▼
┌─────────────────────┐
│   React SPA          │  createServerFn() call
│   (TanStack Form)    │──────────────────────────────────┐
└─────────────────────┘                                   │
                                                          ▼
                                              ┌─────────────────────┐
                                              │   Server Function     │
                                              │   1. Auth middleware   │
                                              │   2. Zod validation   │
                                              │   3. Create DB record │
                                              │   4. Start workflow   │
                                              └──────────┬──────────┘
                                                         │
                            Temporal workflow.start()     │
                                                         ▼
                                              ┌─────────────────────┐
                                              │   Temporal Server    │
                                              │   (schedules tasks)  │
                                              └──────────┬──────────┘
                                                         │
                    ┌────────────────────────────────────┤
                    │                                    │
                    ▼                                    ▼
         ┌──────────────────┐                 ┌──────────────────┐
         │  AI Agent Worker  │                 │  (waits for AI    │
         │  1. Fetch URL     │                 │   to complete)    │
         │  2. Analyze page  │                 └──────────────────┘
         │  3. Claude API    │
         │  4. Generate steps│
         └────────┬─────────┘
                  │ returns TestStep[]
                  ▼
         ┌──────────────────────────────────────────────┐
         │  Temporal fans out to Browser Workers         │
         │  (one per viewport: mobile, tablet, desktop) │
         └──┬──────────┬──────────┬─────────────────────┘
            │          │          │
            ▼          ▼          ▼
    ┌────────────┐ ┌────────────┐ ┌────────────┐
    │ Browser    │ │ Browser    │ │ Browser    │
    │ Worker     │ │ Worker     │ │ Worker     │
    │ (375px)    │ │ (768px)    │ │ (1440px)   │
    │            │ │            │ │            │
    │ Playwright │ │ Playwright │ │ Playwright │
    │ + CDP      │ │ + CDP      │ │ + CDP      │
    │ screencast │ │ screencast │ │ screencast │
    └─────┬──────┘ └─────┬──────┘ └─────┬──────┘
          │              │              │
          │  frames via Redis pub/sub   │
          ▼              ▼              ▼
    ┌──────────────────────────────────────┐
    │  Hono Streaming Sidecar              │
    │  → subscribes to Redis channels      │
    │  → fans out via WebSocket to         │
    │    connected frontend clients        │
    └──────────────────────────────────────┘
          │
          │  results + video paths
          ▼
    ┌──────────────────────────────────────┐
    │  Test results saved to Postgres       │
    │  Videos + screenshots saved to S3     │
    │  Workflow completes                   │
    └──────────────────────────────────────┘
          │
          │  TanStack Query invalidation / subscription
          ▼
    ┌──────────────────────────────────────┐
    │  Frontend displays:                   │
    │  - Step-by-step results               │
    │  - Screenshots per step               │
    │  - Video replay                       │
    │  - Pass/fail across viewports         │
    └──────────────────────────────────────┘
```

### State Management

```
Frontend State (TanStack Query):
  - Server state: test runs, results, user data (cached, invalidated on mutation)
  - No client-side state store needed (Query IS the state manager)
  - WebSocket updates from Hono sidecar trigger query invalidation for real-time updates

Backend State (Temporal):
  - Workflow execution state (durable, survives crashes)
  - Activity results (memoized, not re-executed on replay)
  - Query handlers expose current status to server functions

Database State (Postgres):
  - Permanent record: users, test runs, test results, test steps
  - Temporal is authoritative during execution; DB is authoritative after completion

File State (S3/MinIO):
  - Videos, screenshots, trace files
  - Referenced by URL in Postgres records
  - Presigned URLs for frontend access (time-limited)
```

### Key Data Flows

1. **Test Creation:** User form -> server function (createServerFn) -> DB insert -> Temporal workflow.start() -> returns workflow ID
2. **Live Streaming:** CDP screencastFrame -> Redis pub/sub -> Hono sidecar -> WebSocket -> frontend `<img>` render
3. **Status Polling:** TanStack Query -> server function (GET) -> Temporal workflow.query() -> returns current step/status
4. **Results Retrieval:** TanStack Query -> server function (GET) -> Postgres join (test_run + steps + results) -> S3 presigned URLs for media
5. **Video Export:** User requests export -> server function (POST) -> Temporal video processing workflow -> FFmpeg -> S3 -> presigned URL

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-100 users | Single TanStack Start instance, 1-2 browser workers, single Temporal server (Podman), Postgres + MinIO local. Good enough for launch. |
| 100-1K users | Add Redis for pub/sub + caching. Scale browser workers to 3-5. Move to managed Postgres (e.g., Neon, Supabase). S3 for storage. |
| 1K-10K users | Multiple TanStack Start instances behind load balancer. Browser worker pool (10+). Temporal Cloud instead of self-hosted. Dedicated video processing workers. CDN for video delivery. |
| 10K+ users | Queue-based job admission to prevent overload. Worker autoscaling. Regional browser worker pools for latency. Rate limiting per user tier. Consider browser-as-a-service (Browserless, Browserbase) instead of self-managed Playwright. |

### Scaling Priorities

1. **First bottleneck: Browser workers.** Each Playwright browser context uses ~100-200MB RAM. With 3 viewports per test, a single test needs ~600MB. Scale browser workers first and limit concurrent tests per worker.
2. **Second bottleneck: AI API rate limits.** Claude API has rate limits. Queue test generation requests. Consider caching similar URL+description pairs.
3. **Third bottleneck: Video storage costs.** Videos accumulate fast. Implement retention policies, tiered storage (hot/cold), and user quotas early.

## Anti-Patterns

### Anti-Pattern 1: Long-Running Activities Without Heartbeats

**What people do:** Create a single Temporal activity that runs the entire Playwright test (all steps, all viewports) without heartbeating.
**Why it's wrong:** If the activity runs for 5+ minutes and the worker dies, Temporal has no way to know progress. The entire test restarts from scratch. Also, no visibility into which step is executing.
**Do this instead:** Either heartbeat frequently within the activity (reporting current step), or break execution into one activity per step. Heartbeating is simpler and more practical for browser automation since Playwright sessions are stateful.

### Anti-Pattern 2: Business Logic in Server Functions

**What people do:** Put test generation logic, browser orchestration, or result processing directly in server function handlers.
**Why it's wrong:** Loses all benefits of Temporal (durability, retries, observability). Web server becomes a single point of failure. Cannot scale AI and browser work independently.
**Do this instead:** Server functions do three things: auth, validation, dispatch to Temporal. Nothing else.

### Anti-Pattern 3: Treating Playwright as Stateless

**What people do:** Create a new browser context for each Playwright activity, attempting fine-grained activity decomposition (one activity per click/type action).
**Why it's wrong:** Browser context creation is expensive (~2-5 seconds). Page state (cookies, session, DOM) is lost between activities. Playwright sessions are inherently stateful.
**Do this instead:** One activity per test execution (per viewport). The activity owns the full browser lifecycle: launch -> navigate -> execute all steps -> capture results -> close. Heartbeat to report progress.

### Anti-Pattern 4: Streaming Video via WebSocket Instead of Presigned URLs

**What people do:** Stream completed video files through WebSocket or server function responses.
**Why it's wrong:** Wastes server bandwidth and memory. Videos can be 50-200MB.
**Do this instead:** Upload videos to S3/MinIO from the worker. Return presigned URLs to the frontend. Browser streams directly from object storage. Server never touches video bytes.

### Anti-Pattern 5: Storing Test Steps as Unstructured Blobs

**What people do:** Store AI-generated test steps as a JSON blob in a single database column.
**Why it's wrong:** Cannot query, filter, or report on individual steps. Cannot show per-step results with screenshots. Makes step-level retry impossible.
**Do this instead:** Structured schema: `test_runs` -> `test_steps` (ordered) -> `step_results` (per viewport). Each step has an action type, selector, value, and expected outcome. Each step result has status, screenshot URL, timing, and error message.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Claude API | HTTP via Anthropic SDK, called from AI agent activity | Rate limit: pool requests, implement backoff. Cost: track token usage per user. |
| Temporal Cloud (production) | gRPC, managed by Temporal SDK | Self-hosted Podman for dev, Temporal Cloud for production SaaS. |
| S3/MinIO | AWS SDK v3, presigned URLs for frontend access | MinIO for local dev (S3-compatible). Lifecycle policies for retention. |
| Email (notifications) | SMTP or service like Resend, called from notification activity | Optional: notify on test completion, failures. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Frontend <-> Server Functions | Server function RPC (HTTP/fetch under the hood) | Type-safe via `createServerFn()` with Zod validators; auto code-split |
| Frontend <-> Live Stream | WebSocket (via Hono sidecar) | Hono sidecar handles WebSocket connections for live browser frames |
| Server Functions <-> Temporal | Temporal Client SDK (gRPC) | Server functions start workflows, query status, send signals |
| Temporal <-> Workers | Task queue polling (gRPC) | Workers poll Temporal for tasks, never called directly |
| Browser Worker -> Hono Sidecar | Redis pub/sub | Screencast frames published to Redis, Hono subscribes and fans out to WebSockets |
| Workers -> S3 | AWS SDK (HTTP) | Workers upload directly; frontend downloads via presigned URLs |
| Workers -> Postgres | Drizzle ORM (TCP) | Activities write results directly to DB |

### Communication Protocol Summary

```
Frontend ──Server Fns──> TanStack Start ──Temporal Client──> Temporal Server
                                                                │
                                              task queue poll   │
                                                                │
                              AI Worker <──────────────────────┤
                              Browser Worker <─────────────────┤
                              Video Worker <───────────────────┘
                                   │
                                   │──Redis pub/sub──> Hono Sidecar ──WebSocket──> Frontend
                                   │──S3 upload──> S3 ──presigned URL──> Frontend
                                   │──Drizzle──> Postgres <──Drizzle──── Server Fns
```

## Build Order (Dependencies)

Understanding component dependencies determines phase ordering in the roadmap.

### Dependency Graph

```
shared types (core) ──────────────────────────────────────────────┐
     │                                                             │
     ├──> database schema (db/Drizzle) ──> server functions ──────>│
     │         │                            (in packages/web)      │
     │         │                                  │                │
     │         │                           auth middleware         │
     │         │                                  │                │
     │         ├──> Temporal workflows ───────────┤                │
     │         │         │                        │                │
     │         │    AI activities ────────────────┤                │
     │         │    Browser activities ───────────┤                │
     │         │    Video activities ─────────────┤                │
     │         │                                  │                │
     │         └──> React SPA ────────────────────┘                │
     │              (depends on server functions existing)         │
     │                                                             │
     └──> live streaming (depends on browser workers + Hono sidecar)│
```

### Suggested Build Order

1. **Foundation:** Monorepo setup (via `bunx --bun shadcn@latest create` + convert), shared types/schemas, database schema, Temporal dev environment
2. **Server Functions:** TanStack Start server functions with auth middleware, basic CRUD for test runs
3. **AI Agent:** Test step generation from URL + description (can develop independently)
4. **Browser Execution:** Playwright activities, screenshot capture, video recording
5. **Orchestration:** Wire AI + browser activities into Temporal workflows
6. **Frontend Core:** Dashboard, test creation form, results viewer (using server functions)
7. **Live Streaming:** CDP screencast -> Redis -> Hono sidecar (WebSocket) -> frontend viewer
8. **Video Processing:** Polished export pipeline with FFmpeg
9. **Polish:** Multi-viewport fan-out, test suites, reporting

**Rationale:** The AI agent and browser execution can be developed in parallel (steps 3-4). The frontend can start once server functions exist (step 6 after step 2). Live streaming is additive and not needed for core functionality (step 7). Video export is a separate concern (step 8).

## Sources

- [Temporal workflow patterns and documentation](https://docs.temporal.io/evaluate/use-cases-design-patterns)
- [Temporal + Browserbase: Durable browser automation architecture](https://www.browserbase.com/blog/temporal-browserbase)
- [Temporal + TypeScript for AI agent workflows](https://medium.com/@sylvesterranjithfrancis/temporal-typescript-building-bulletproof-ai-agent-workflows-4863317144ce)
- [Vercel agent-browser: CDP screencasting architecture](https://deepwiki.com/vercel-labs/agent-browser/6.2-screencasting-and-live-preview)
- [Playwright video recording documentation](https://playwright.dev/docs/videos)
- [Playwright live video streaming limitation (Issue #35463)](https://github.com/microsoft/playwright/issues/35463)
- [TanStack Start server functions](https://tanstack.com/start/latest/docs/framework/react/guide/server-functions) -- primary API layer for typed client-server RPC
- [TanStack Start middleware](https://tanstack.com/start/latest/docs/framework/react/guide/middleware) -- composable, typed middleware chain
- [AI test generation with Playwright](https://www.stickyminds.com/article/prompt-playwright-how-i-built-ai-assistant-automate-browser-testing)
- [Playwright Test Agents architecture](https://codoid.com/ai-testing/playwright-test-agent-the-future-of-ai-driven-test-automation/)
- [Browserless screencast API](https://docs.browserless.io/baas/interactive-browser-sessions/screencasting)

---
*Architecture research for: AI-powered testing platform (Validater)*
*Researched: 2026-03-06*
*Updated: 2026-03-06 (API layer: TanStack Start server functions + Hono sidecar)*
