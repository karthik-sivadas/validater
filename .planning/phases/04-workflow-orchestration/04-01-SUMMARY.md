---
phase: 04-workflow-orchestration
plan: 01
subsystem: database, worker
tags: [drizzle, postgresql, browser-pool, temporal-activities, generic-pool]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: users table, drizzle-orm setup, PostgreSQL on port 5433
  - phase: 03-browser-execution-engine
    provides: browser pool (getDefaultPool), BrowserContext per viewport pattern
provides:
  - test_runs, test_run_results, test_run_steps database tables with enums and cascade FKs
  - Pool-based crawlDom activity (no standalone chromium)
  - Pool-based validateSteps activity (no standalone chromium)
affects: [04-02 (persist-results activity needs test_runs schema), 04-03 (worker registration)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "NODE_OPTIONS='--require tsx/cjs' for drizzle-kit cross-file .js import resolution"
    - "Nested try/finally for pool acquire/release and context close in all activities"

key-files:
  created:
    - packages/db/src/schema/test-runs.ts
    - packages/db/src/migrations/0000_tan_meggan.sql
  modified:
    - packages/db/src/schema/index.ts
    - packages/db/drizzle.config.ts
    - packages/db/package.json
    - packages/worker/src/activities/crawl-dom.activity.ts
    - packages/worker/src/activities/validate-steps.activity.ts

key-decisions:
  - "NODE_OPTIONS='--require tsx/cjs' needed for drizzle-kit to resolve .js imports to .ts files in cross-file schema references"
  - "drizzle-kit push used for schema application (migration file generated but push handles initial state better)"
  - "Baseline migration 0000_tan_meggan.sql includes all tables (users + test_runs) since no prior migrations existed"

patterns-established:
  - "Pool acquire/release pattern: pool.acquire() -> try { browser.newContext() -> try { work } finally { context.close() } } finally { pooled.pagesProcessed++; pool.release(pooled) }"
  - "Cross-file schema imports with .js extensions require tsx/cjs loader for drizzle-kit compatibility"

# Metrics
duration: 6min
completed: 2026-03-06
---

# Phase 4 Plan 1: Test Run Schema and Pool-Based Activities Summary

**Three test run DB tables (test_runs, test_run_results, test_run_steps) with pgEnum status tracking, plus crawlDom and validateSteps activities migrated from standalone chromium to browser pool**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-06T18:47:49Z
- **Completed:** 2026-03-06T18:53:42Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Created test_runs, test_run_results, test_run_steps tables with proper foreign keys and cascade deletes
- Added test_run_status pgEnum with 8 workflow phases (pending through failed)
- Migrated crawlDom activity from chromium.launch() to browser pool singleton
- Migrated validateSteps activity from chromium.launch() to browser pool singleton
- Fixed drizzle-kit cross-file import resolution by adding tsx/cjs loader to scripts

## Task Commits

Each task was committed atomically:

1. **Task 1: Create test run database schema and run migration** - `d01cb65` (feat)
2. **Task 2: Update crawlDom and validateSteps activities to use browser pool** - `ee34ea4` (feat)

## Files Created/Modified
- `packages/db/src/schema/test-runs.ts` - Three tables: testRuns, testRunResults, testRunSteps with testRunStatusEnum
- `packages/db/src/schema/index.ts` - Added barrel re-export for test-runs
- `packages/db/drizzle.config.ts` - Added test-runs.ts to schema array
- `packages/db/package.json` - Added NODE_OPTIONS='--require tsx/cjs' to drizzle-kit scripts
- `packages/db/src/migrations/0000_tan_meggan.sql` - Baseline migration for all tables
- `packages/worker/src/activities/crawl-dom.activity.ts` - Replaced chromium.launch with pool acquire/release
- `packages/worker/src/activities/validate-steps.activity.ts` - Replaced chromium.launch with pool acquire/release

## Decisions Made
- **NODE_OPTIONS='--require tsx/cjs' for drizzle-kit:** drizzle-kit v0.31.9 uses an internal CJS loader that cannot resolve .js extension imports to .ts files. Adding tsx/cjs loader via NODE_OPTIONS enables proper cross-file schema references while maintaining TypeScript NodeNext compatibility.
- **drizzle-kit push over migrate:** Since no prior migration history existed (Phase 1 used push directly), push was used for schema application. The generated migration file serves as a baseline for future incremental migrations.
- **Default viewport context for crawl/validate:** crawlDom and validateSteps use default BrowserContext (no viewport config) since crawling and validation don't need specific viewport dimensions. Only executeSteps uses viewport-specific contexts.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] drizzle-kit CJS loader cannot resolve .js imports to .ts files**
- **Found during:** Task 1 (migration generation)
- **Issue:** `import { users } from './users.js'` in test-runs.ts caused `Cannot find module './users.js'` error from drizzle-kit's CJS loader
- **Fix:** Added `NODE_OPTIONS='--require tsx/cjs'` to all drizzle-kit scripts in package.json, which registers tsx's CJS resolver that properly maps .js extensions to .ts files
- **Files modified:** packages/db/package.json
- **Verification:** `pnpm db:generate` and `pnpm db:push` succeed with cross-file imports
- **Committed in:** d01cb65 (Task 1 commit)

**2. [Rule 3 - Blocking] PostgreSQL container not running for migration**
- **Found during:** Task 1 (migration application)
- **Issue:** `ECONNREFUSED` when running drizzle-kit migrate -- Podman machine and containers were stopped
- **Fix:** Started podman machine and ran `podman compose up -d` from docker/ directory
- **Files modified:** None (infrastructure only)
- **Verification:** `psql` connection and `\dt` shows all 7 tables
- **Committed in:** N/A (no file changes)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes necessary to complete the migration task. No scope creep.

## Issues Encountered
- Pre-existing typecheck error in @validater/web package (vite.config.ts `test` property type mismatch) -- unrelated to this plan, does not affect db/core/worker packages

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Test run tables ready for persist-results activity (Plan 04-02)
- All activities now use browser pool -- consistent resource management for workflow orchestration
- Schema types available via `import { testRuns, testRunResults, testRunSteps } from '@validater/db'`
- Blocker: drizzle-kit cross-file imports require NODE_OPTIONS workaround (documented in scripts)

---
*Phase: 04-workflow-orchestration*
*Completed: 2026-03-06*
