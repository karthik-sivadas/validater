---
phase: 04-workflow-orchestration
plan: 03
subsystem: worker, web
tags: [temporal, worker-registration, server-functions, tanstack-start, dynamic-imports, graceful-shutdown]

# Dependency graph
requires:
  - phase: 04-workflow-orchestration
    plan: 01
    provides: test_runs schema, pool-based crawlDom and validateSteps activities
  - phase: 04-workflow-orchestration
    plan: 02
    provides: persist-results activity (factory DI), testRunWorkflow, viewportExecutionWorkflow, getTestRunStatus query
  - phase: 03-browser-execution-engine
    provides: executeStepsActivity with browser pool, shutdownPool
  - phase: 02-ai-agent
    provides: generateSteps activity
provides:
  - Production worker registering all activities on test-pipeline queue with graceful shutdown
  - runTest server function starting end-to-end workflow non-blocking
  - getTestRunStatusFn server function querying live workflow status with DB fallback
  - @validater/worker public API exporting createTemporalClient, testRunWorkflow, getTestRunStatus
affects: [05-results-dashboard (frontend needs runTest and getTestRunStatusFn to trigger and poll runs)]

# Tech tracking
tech-stack:
  added: [nanoid (web dependency), drizzle-orm (web dependency for eq() in DB fallback)]
  patterns:
    - "Dynamic imports in server functions for all server-only deps (Temporal, db, core, nanoid)"
    - "Workflow non-blocking start with immediate testRunId return"
    - "Status query fallback: Temporal query -> database record"
    - "Graceful worker shutdown: SIGINT/SIGTERM -> shutdownPool -> process.exit"

key-files:
  created:
    - packages/web/src/server/run-test.ts
  modified:
    - packages/worker/src/worker.ts
    - packages/worker/src/index.ts
    - packages/web/package.json

key-decisions:
  - "@validater/worker added as web dependency for TypeScript type resolution of dynamic imports"
  - "nanoid and drizzle-orm added as direct web dependencies (dynamic imports still need type declarations)"
  - "DB fallback uses db.select().from().where(eq()) builder API, not relational query API"
  - "Anonymous userId placeholder in test_runs insert -- Phase 5 wires auth context"

patterns-established:
  - "Server function dynamic import pattern: all server-only deps imported inside handler, only createServerFn and zod at top level"
  - "Non-blocking workflow start: client.workflow.start() returns handle, frontend polls getTestRunStatusFn"
  - "Worker activity registration: spread all activity namespace imports + factory-injected activities into single activities map"

# Metrics
duration: 3min
completed: 2026-03-06
---

# Phase 4 Plan 3: Worker Registration and Server Functions Summary

**Production worker registering all 6 activities on test-pipeline queue with server functions to start workflows non-blocking and query real-time status via Temporal queries with DB fallback**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-06T19:00:54Z
- **Completed:** 2026-03-06T19:03:42Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Rewired worker.ts from hello-world spike to production configuration registering all 6 activities (crawlDom, generateSteps, validateSteps, executeStepsActivity, persistResults, updateTestRunStatus)
- Added graceful shutdown handlers draining browser pool on SIGINT/SIGTERM
- Created runTest server function that inserts test_runs record and starts testRunWorkflow non-blocking
- Created getTestRunStatusFn server function with Temporal query -> DB fallback pattern
- Exported createTemporalClient, testRunWorkflow, getTestRunStatus from @validater/worker for consumer packages

## Task Commits

Each task was committed atomically:

1. **Task 1: Update worker.ts to register all activities and workflows** - `f6e67c2` (feat)
2. **Task 2: Create runTest and getTestRunStatus server functions** - `ec1c9e8` (feat)

## Files Created/Modified
- `packages/worker/src/worker.ts` - Production worker with all activity imports, factory DI for persist, test-pipeline queue, graceful shutdown
- `packages/worker/src/index.ts` - Re-exports createTemporalClient, testRunWorkflow, getTestRunStatus, and type exports for consumer packages
- `packages/web/src/server/run-test.ts` - runTest (POST, starts workflow) and getTestRunStatusFn (GET, queries status) server functions
- `packages/web/package.json` - Added @validater/worker, nanoid, drizzle-orm dependencies
- `pnpm-lock.yaml` - Updated lockfile for new web dependencies

## Decisions Made
- **@validater/worker as web dependency:** Even though all imports are dynamic, TypeScript needs the package installed to resolve types for `await import('@validater/worker')`. Added as workspace dependency.
- **drizzle-orm as web dependency:** The DB fallback in getTestRunStatusFn uses `eq()` from drizzle-orm. TypeScript requires the package for type resolution of the dynamic import.
- **nanoid as direct web dependency:** Used for generating testRunId in runTest. Not available through workspace dependency chain for TypeScript resolution.
- **db.select() builder API over relational query:** The status fallback uses `db.select().from(testRuns).where(eq(...))` rather than `db.query.testRuns.findFirst()`. The builder API uses standalone `eq()` which is clearer than the relational API's callback-style where clause.
- **Anonymous userId placeholder:** Phase 5 will wire authenticated user context. Current placeholder allows pipeline to work without auth wiring.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] drizzle-orm not in web dependencies**
- **Found during:** Task 2 (run-test.ts creation)
- **Issue:** `import("drizzle-orm")` in getTestRunStatusFn failed typecheck -- drizzle-orm not in web package.json
- **Fix:** Added drizzle-orm as web dependency via `pnpm --filter @validater/web add drizzle-orm`
- **Files modified:** packages/web/package.json, pnpm-lock.yaml
- **Verification:** `pnpm --filter @validater/web typecheck` passes (only pre-existing vite.config.ts error remains)
- **Committed in:** ec1c9e8 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary dependency addition for TypeScript resolution. No scope creep.

## Issues Encountered
- Pre-existing typecheck error in @validater/web package (vite.config.ts `test` property type mismatch) -- unrelated to this plan, does not affect new server functions

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Full pipeline is now triggerable via `runTest({ url, testDescription, viewports })` server function
- Real-time status queryable via `getTestRunStatusFn({ testRunId })` with Temporal + DB fallback
- Phase 4 (Workflow Orchestration) is complete -- all 3 plans delivered
- Next phase (05-results-dashboard) can call runTest from UI and poll getTestRunStatusFn for live status updates
- Worker starts with `pnpm --filter @validater/worker start` (requires Temporal dev server running)

---
*Phase: 04-workflow-orchestration*
*Completed: 2026-03-06*
