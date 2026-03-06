---
phase: 04-workflow-orchestration
plan: 02
subsystem: worker, database
tags: [temporal, workflows, parent-child, proxyActivities, executeChild, drizzle, nanoid]

# Dependency graph
requires:
  - phase: 04-workflow-orchestration
    plan: 01
    provides: test_runs/test_run_results/test_run_steps tables, pool-based crawlDom and validateSteps activities
  - phase: 03-browser-execution-engine
    provides: executeStepsActivity with browser pool, ExecutionResult type
  - phase: 02-ai-agent
    provides: generateSteps activity, validateSteps activity with heal
provides:
  - persist-results activity with DI factory pattern (createPersistActivities)
  - PersistActivities type alias for workflow proxyActivities
  - testRunWorkflow parent workflow orchestrating full pipeline
  - viewportExecutionWorkflow child workflow for per-viewport execution
  - getTestRunStatus query for real-time status monitoring
affects: [04-03 (worker registration needs to wire activities and register workflows)]

# Tech tracking
tech-stack:
  added: [drizzle-orm (worker dependency for eq operator)]
  patterns:
    - "Factory pattern for activities needing injected dependencies (createPersistActivities)"
    - "Separate proxyActivities per activity file with differentiated retry policies"
    - "PersistActivities type alias for factory-produced activities in proxyActivities"
    - "Dual status tracking: in-memory query state + database updates"

key-files:
  created:
    - packages/worker/src/activities/persist-results.activity.ts
    - packages/worker/src/workflows/test-run.workflow.ts
    - packages/worker/src/workflows/viewport-execution.workflow.ts
  modified:
    - packages/worker/package.json

key-decisions:
  - "drizzle-orm added as worker dependency for eq() operator in persist activity"
  - "Factory pattern (createPersistActivities) for db dependency injection rather than direct import"
  - "Separate proxyActivities calls per activity file for differentiated retry policies"
  - "PersistActivities type alias (ReturnType<typeof createPersistActivities>) for workflow proxy typing"
  - "as TestStep[] explicit cast for intersection-to-interface compatibility in generateSteps output"

patterns-established:
  - "Factory DI pattern: createXActivities(deps) returns activity object + exported type alias"
  - "Per-activity-file proxyActivities with specific retry: crawl/validate (2-3min, 3 retries), AI (2min, longer interval), DB (30s, 5 retries)"
  - "Deterministic child workflow IDs: {parentId}-viewport-{viewportName}"
  - "Future queue separation via taskQueue param documented in code comments"

# Metrics
duration: 2min
completed: 2026-03-06
---

# Phase 4 Plan 2: Core Pipeline Workflows Summary

**Parent/child Temporal workflows orchestrating crawl -> generate -> validate -> fan-out execute -> persist with queryable status and differentiated retry policies**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-06T18:56:19Z
- **Completed:** 2026-03-06T18:58:38Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created persist-results activity with factory DI pattern for database operations
- Built parent testRunWorkflow orchestrating 5-stage pipeline with real-time status queries
- Built child viewportExecutionWorkflow for per-viewport execution with independent retry
- Established differentiated retry policies: AI gets longer intervals, DB gets more retries, browser ops get heartbeats

## Task Commits

Each task was committed atomically:

1. **Task 1: Create persist-results activity with dependency injection** - `31aee9d` (feat)
2. **Task 2: Create parent and child Temporal workflows** - `d5fbc33` (feat)

## Files Created/Modified
- `packages/worker/src/activities/persist-results.activity.ts` - Factory function returning persistResults and updateTestRunStatus activities
- `packages/worker/src/workflows/test-run.workflow.ts` - Parent workflow: crawl -> generate -> validate -> fan-out -> persist with getTestRunStatus query
- `packages/worker/src/workflows/viewport-execution.workflow.ts` - Child workflow for single-viewport step execution
- `packages/worker/package.json` - Added drizzle-orm dependency

## Decisions Made
- **drizzle-orm as worker dependency:** The persist activity uses `eq()` from drizzle-orm for WHERE clauses. Added as direct dependency rather than re-exporting from @validater/db to keep imports clean.
- **Factory DI pattern for persist activities:** Unlike other activities that import pool singletons, persist activities need an injected db client. The factory pattern (createPersistActivities) enables testability and worker-controlled lifecycle.
- **Per-file proxyActivities:** Each activity file gets its own proxyActivities call with tailored retry config, rather than a single combined type. This avoids needing a barrel activities index.
- **Explicit TestStep[] cast:** generateSteps returns `Array<{ id: string } & RawTestStep>` which is structurally identical to TestStep[] but TypeScript may not resolve intersection-to-interface compatibility. Added `as TestStep[]` for safety.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] drizzle-orm not in worker dependencies**
- **Found during:** Task 1 (persist-results activity creation)
- **Issue:** `import { eq } from 'drizzle-orm'` failed typecheck -- drizzle-orm not in worker package.json
- **Fix:** Added drizzle-orm as worker dependency via `pnpm --filter @validater/worker add drizzle-orm`
- **Files modified:** packages/worker/package.json, pnpm-lock.yaml
- **Verification:** `pnpm --filter @validater/worker typecheck` passes
- **Committed in:** 31aee9d (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary dependency addition. No scope creep.

## Issues Encountered
- Pre-existing typecheck error in @validater/web package (vite.config.ts `test` property type mismatch) -- unrelated to this plan, does not affect worker/db/core packages

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All activities (crawlDom, generateSteps, validateSteps, executeSteps, persistResults, updateTestRunStatus) ready for worker registration
- Parent/child workflows ready for registration with Temporal Worker
- Worker registration (Plan 04-03) needs to: wire createPersistActivities with db client, register both workflow files, configure task queue
- PersistActivities type exported for any future workflow that needs persist activity proxies

---
*Phase: 04-workflow-orchestration*
*Completed: 2026-03-06*
