---
phase: 09-test-suite-generation-and-accessibility
plan: 03
subsystem: worker, workflow, ai
tags: [temporal, workflow, activities, proxyActivities, factory-di, suite-generation, rate-limiter]

# Dependency graph
requires:
  - phase: 02-ai-agent-test-generation
    provides: "generateSteps activity, rate limiter queue, AI cost tracking"
  - phase: 03-browser-execution-engine
    provides: "crawlDom activity for page crawling"
  - phase: 04-workflow-orchestration
    provides: "Temporal workflow patterns, factory DI, worker registration"
  - phase: 09-01
    provides: "test_suites, test_cases DB tables with category/priority enums"
  - phase: 09-02
    provides: "generateSuiteSpecs core AI function, TestSuiteSpec types"
provides:
  - "testSuiteWorkflow Temporal workflow for full suite generation pipeline"
  - "generateSuiteSpecsActivity wrapping core AI with rate limiting"
  - "createPersistSuiteActivities factory DI for suite DB persistence"
  - "Suite workflow types exported from @validater/worker (TestSuiteParams, SuiteStatus, etc.)"
affects:
  - 09-04 (frontend triggers testSuiteWorkflow via Temporal client)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Suite generation workflow: crawl once, fan out step generation sequentially per test case"
    - "proxyActivities reuse: same generateSteps activity used by both test-run and test-suite workflows"

key-files:
  created:
    - packages/worker/src/activities/generate-suite.activity.ts
    - packages/worker/src/activities/persist-suite.activity.ts
    - packages/worker/src/workflows/test-suite.workflow.ts
  modified:
    - packages/worker/src/workflows/test-run.workflow.ts
    - packages/worker/src/worker.ts
    - packages/worker/src/index.ts

key-decisions:
  - "Sequential step generation per test case to respect rate limiter (not parallel) -- avoids overwhelming API"
  - "testSuiteWorkflow re-exported from test-run.workflow.ts for Temporal bundle registration (same pattern as viewportExecutionWorkflow)"
  - "updateSuiteStatus activity for progress tracking mirrors updateTestRunStatus pattern"

patterns-established:
  - "Workflow reuse: testSuiteWorkflow reuses crawlDom and generateSteps from test-run pipeline"
  - "Status query pattern: getSuiteStatus query with SuitePhase tracking mirrors getTestRunStatus"

# Metrics
duration: 3min
completed: 2026-03-07
---

# Phase 9 Plan 3: Temporal Workflow and Activities for Suite Generation Summary

**testSuiteWorkflow orchestrates full suite generation pipeline (crawl -> AI specs -> per-case step generation -> DB persist) with rate-limited sequential processing and factory DI persistence**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-07T05:33:38Z
- **Completed:** 2026-03-07T05:36:07Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Created generateSuiteSpecsActivity wrapping core AI function with shared rate limiter queue and cost tracking
- Created createPersistSuiteActivities factory with persistSuite (writes test cases + updates suite status) and updateSuiteStatus (progress tracking)
- Built testSuiteWorkflow with 4-stage pipeline: crawl DOM once, generate specs, generate steps per case sequentially, persist to DB
- Registered all suite activities in worker.ts and re-exported workflow for Temporal bundle registration
- Exported suite workflow types (TestSuiteParams, TestSuiteResult, SuiteStatus, SuitePhase) from @validater/worker package

## Task Commits

Each task was committed atomically:

1. **Task 1: Create generate-suite and persist-suite activities** - `35677c9` (feat)
2. **Task 2: Create test-suite workflow and register in worker** - `26c963d` (feat)

## Files Created/Modified
- `packages/worker/src/activities/generate-suite.activity.ts` - Temporal activity wrapping generateSuiteSpecs with rate limiting
- `packages/worker/src/activities/persist-suite.activity.ts` - Factory DI activity for suite + test case DB persistence
- `packages/worker/src/workflows/test-suite.workflow.ts` - Parent workflow: crawl -> specs -> steps per case -> persist
- `packages/worker/src/workflows/test-run.workflow.ts` - Added testSuiteWorkflow re-export for Temporal bundle
- `packages/worker/src/worker.ts` - Registered suiteGenActivities and persistSuiteActivities
- `packages/worker/src/index.ts` - Exported suite workflow types and functions

## Decisions Made
- Sequential step generation per test case (not parallel) to respect the shared rate limiter queue -- each generateSteps call goes through defaultApiQueue naturally
- testSuiteWorkflow re-exported from test-run.workflow.ts following the established pattern for Temporal bundle registration (same as viewportExecutionWorkflow, exportVideoWorkflow)
- updateSuiteStatus activity mirrors updateTestRunStatus pattern for consistent progress tracking

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- testSuiteWorkflow can be triggered via Temporal client with { suiteId, url, featureDescription }
- Suite workflow types exported from @validater/worker for use in web server functions (plan 09-04)
- All TypeScript type checks pass across the worker package
- No blockers for remaining Phase 9 plans

---
*Phase: 09-test-suite-generation-and-accessibility*
*Completed: 2026-03-07*
