---
phase: 09-test-suite-generation-and-accessibility
plan: 01
subsystem: database, testing, accessibility
tags: [axe-core, playwright, drizzle, postgresql, wcag, accessibility, test-suites]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: users table for FK references
  - phase: 03-browser-execution-engine
    provides: ExecutionResult type, executeSteps pipeline
  - phase: 04-workflow-orchestration
    provides: factory DI pattern for activities, Temporal workflow
  - phase: 06.1-step-details
    provides: staging table pattern, createExecuteActivities factory
provides:
  - test_suites, test_cases, accessibility_results database tables
  - testCaseCategoryEnum and testCasePriorityEnum enums
  - AccessibilityData and AccessibilityViolation types in @validater/core
  - axe-core WCAG 2.0/2.1 AA scanning in execution pipeline
  - Accessibility result persistence via persist-results activity
affects:
  - 09-02 (suite generation workflow uses test_suites/test_cases tables)
  - 09-03 (frontend suite management reads from new tables)
  - 09-04 (accessibility panel displays accessibility_results data)
  - 07-video-and-reporting (reports may include accessibility summary)

# Tech tracking
tech-stack:
  added: ["@axe-core/playwright@4.11.1"]
  patterns: ["best-effort accessibility scanning in execution pipeline", "accessibility data in ExecutionResult flow"]

key-files:
  created:
    - packages/db/src/schema/test-suites.ts
  modified:
    - packages/db/src/schema/index.ts
    - packages/db/drizzle.config.ts
    - packages/core/src/execution/types.ts
    - packages/worker/src/activities/execute-steps.activity.ts
    - packages/worker/src/activities/persist-results.activity.ts
    - packages/worker/package.json

key-decisions:
  - "Return accessibility data via ExecutionResult instead of staging table -- avoids extra DB round-trip and is small enough for Temporal payload"
  - "Named import { AxeBuilder } instead of default import -- required for NodeNext module resolution compatibility"
  - "Hoist accessibilityData variable to outer scope alongside lightResults -- inner try block scoping would make it inaccessible at return"
  - "Cap violations at 10 nodes per violation and HTML at 500 chars -- prevents payload bloat while preserving actionable data"

patterns-established:
  - "Best-effort accessibility scanning: axe-core runs after step execution, wrapped in try/catch, never blocks test results"
  - "Accessibility data flow: execute-steps scans -> returns in ExecutionResult -> persist-results writes to DB with real resultId FK"

# Metrics
duration: 4min
completed: 2026-03-07
---

# Phase 9 Plan 01: Database Schema and axe-core Accessibility Integration Summary

**Three new DB tables (test_suites, test_cases, accessibility_results) with @axe-core/playwright WCAG scanning integrated into execution pipeline**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-07T05:26:39Z
- **Completed:** 2026-03-07T05:31:02Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Created test_suites, test_cases, and accessibility_results tables with proper FK references and enums
- Integrated @axe-core/playwright into executeStepsActivity for WCAG 2.0/2.1 AA scanning on final page state
- Added AccessibilityData type to ExecutionResult for clean data flow through Temporal activities
- Accessibility results persisted in persist-results activity with real resultId FK (no staging table needed)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Phase 9 database schema and push to PostgreSQL** - `bcbd277` (feat)
2. **Task 2: Integrate axe-core scanning into execution pipeline and persist results** - `f4a8d0b` (feat)

## Files Created/Modified
- `packages/db/src/schema/test-suites.ts` - New schema: test_suites, test_cases, accessibility_results tables + 2 enums
- `packages/db/src/schema/index.ts` - Added barrel export for test-suites.js
- `packages/db/drizzle.config.ts` - Added test-suites.ts to schema array
- `packages/core/src/execution/types.ts` - Added AccessibilityData, AccessibilityViolation interfaces to ExecutionResult
- `packages/worker/src/activities/execute-steps.activity.ts` - Added axe-core scan after step execution (best-effort)
- `packages/worker/src/activities/persist-results.activity.ts` - Added accessibility_results DB insert per viewport
- `packages/worker/package.json` - Added @axe-core/playwright dependency

## Decisions Made
- **ExecutionResult over staging table:** Accessibility data is small enough (violations capped at 10 nodes, HTML truncated to 500 chars) to flow through Temporal's ExecutionResult without hitting the 2MB payload limit. This avoids the complexity of a staging table and keeps the data flow clean.
- **Named import for AxeBuilder:** The default import `import AxeBuilder from '@axe-core/playwright'` fails with NodeNext module resolution. Using `import { AxeBuilder }` works correctly.
- **Variable scoping fix:** Hoisted `accessibilityData` declaration to the same scope as `lightResults` and `totalDurationMs` so it survives the inner try block and is accessible at the return statement.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed AxeBuilder import style for NodeNext compatibility**
- **Found during:** Task 2 (axe-core integration)
- **Issue:** `import AxeBuilder from '@axe-core/playwright'` produces TS2351 "not constructable" error with NodeNext module resolution
- **Fix:** Changed to named import `import { AxeBuilder } from '@axe-core/playwright'`
- **Files modified:** packages/worker/src/activities/execute-steps.activity.ts
- **Verification:** TypeScript compiles cleanly
- **Committed in:** f4a8d0b (Task 2 commit)

**2. [Rule 1 - Bug] Fixed accessibilityData variable scoping**
- **Found during:** Task 2 (axe-core integration)
- **Issue:** Plan showed `accessibilityData` declared inside inner try block, but the return statement is in the outer scope after try/finally -- variable would be inaccessible
- **Fix:** Hoisted `let accessibilityData` declaration to outer scope alongside `lightResults` and `totalDurationMs`
- **Files modified:** packages/worker/src/activities/execute-steps.activity.ts
- **Verification:** TypeScript compiles, variable accessible at return point
- **Committed in:** f4a8d0b (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes were necessary for TypeScript compilation. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Database schema ready for suite generation workflow (09-02)
- Accessibility scanning integrated and will produce results on next test execution
- All TypeScript type checks pass across db, core, and worker packages
- No blockers for remaining Phase 9 plans

---
*Phase: 09-test-suite-generation-and-accessibility*
*Completed: 2026-03-07*
