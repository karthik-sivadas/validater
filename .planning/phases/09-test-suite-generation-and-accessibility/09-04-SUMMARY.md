---
phase: 09-test-suite-generation-and-accessibility
plan: 04
subsystem: ui, api
tags: [tanstack-start, server-functions, file-based-routing, accessibility, axe-core, shadcn, tailwind]

# Dependency graph
requires:
  - phase: 05-frontend-dashboard-and-results
    provides: "route patterns (runs layout, list, detail), shadcn components, polling hooks"
  - phase: 09-01
    provides: "test_suites, test_cases, accessibility_results DB tables"
  - phase: 09-02
    provides: "TestSuiteSpec types, generateSuiteSpecs AI function"
  - phase: 09-03
    provides: "testSuiteWorkflow Temporal workflow, getSuiteStatus query, suite types"
  - phase: 08-02
    provides: "triggerTestRun shared core for running individual test cases"
provides:
  - "Suite management server functions (generateSuite, getSuiteList, getSuiteDetail, getSuiteStatusFn, runTestCase)"
  - "Suite management UI (list, generation form with progress polling, detail with run buttons)"
  - "AccessibilityPanel reusable component for violation display"
  - "Accessibility insights integrated into test run results page per viewport"
affects:
  - 10-polish-and-deployment (UI may need refinement)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Suite status polling with interpolated progress during generating_steps phase"
    - "jsonb field casting for dynamic import Promise type compatibility (same pattern as 05-01)"
    - "Category-grouped test case display with collapsible reasoning"

key-files:
  created:
    - packages/web/src/server/test-suites.ts
    - packages/web/src/components/accessibility-panel.tsx
    - packages/web/src/routes/_authed/suites.tsx
    - packages/web/src/routes/_authed/suites/index.tsx
    - packages/web/src/routes/_authed/suites/new.tsx
    - packages/web/src/routes/_authed/suites/$suiteId.tsx
  modified:
    - packages/web/src/server/test-runs.ts
    - packages/web/src/routes/_authed/runs/$runId.tsx
    - packages/web/src/routeTree.gen.ts

key-decisions:
  - "jsonb violations field cast to typed array in getTestRunDetail to avoid dynamic import Promise type incompatibility"
  - "Test cases grouped by category (happy_path, edge_case, error_state, boundary) with section headers on detail page"
  - "Suite generation progress interpolates between 50-85% during generating_steps phase based on testCasesGenerated/testCasesTotal"
  - "runTestCase reuses triggerTestRun from run-test-core.ts and updates test_cases.testRunId for result linking"

patterns-established:
  - "Suite management follows exact same patterns as test run management (list/detail/polling)"
  - "AccessibilityPanel as reusable component can be used in future report views"

# Metrics
duration: 5min
completed: 2026-03-07
---

# Phase 9 Plan 4: Frontend Suite Management and Accessibility Panel Summary

**Suite management UI with generation form, progress polling, category-grouped test cases with run buttons, and accessibility insights panel integrated into results page**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-07T05:38:23Z
- **Completed:** 2026-03-07T05:43:53Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Created 5 server functions for suite CRUD: generateSuite, getSuiteList, getSuiteDetail, getSuiteStatusFn, runTestCase
- Built AccessibilityPanel component displaying violations by severity (critical/serious/moderate/minor) with help links and collapsible list
- Created full suite management UI: list page with status badges, generation form with progress polling, detail page with category-grouped test cases
- Integrated accessibility results into test run results page (per-viewport panel + summary card totals)
- Updated getTestRunDetail to fetch accessibility_results per viewport with typed jsonb cast

## Task Commits

Each task was committed atomically:

1. **Task 1: Create server functions for suite management and accessibility data** - `3d1a4dc` (feat)
2. **Task 2: Create suite management pages and accessibility panel** - `f3561b5` (feat)

## Files Created/Modified
- `packages/web/src/server/test-suites.ts` - 5 server functions: generateSuite, getSuiteList, getSuiteDetail, getSuiteStatusFn, runTestCase
- `packages/web/src/server/test-runs.ts` - getTestRunDetail now includes accessibility results per viewport
- `packages/web/src/components/accessibility-panel.tsx` - Reusable component: severity badges, violation list, collapsible, help links
- `packages/web/src/routes/_authed/suites.tsx` - Layout with Outlet for directory-based routing
- `packages/web/src/routes/_authed/suites/index.tsx` - Paginated suite list with status badges and empty state
- `packages/web/src/routes/_authed/suites/new.tsx` - Generation form with URL + feature description and progress polling
- `packages/web/src/routes/_authed/suites/$suiteId.tsx` - Suite detail with test cases grouped by category, run/view buttons
- `packages/web/src/routes/_authed/runs/$runId.tsx` - Results page with AccessibilityPanel per viewport + summary totals
- `packages/web/src/routeTree.gen.ts` - Auto-generated route tree updated with suite routes

## Decisions Made
- jsonb `violations` field cast to typed array in getTestRunDetail to resolve dynamic import Promise type incompatibility (same pattern as existing viewports cast from 05-01)
- Test cases grouped by category with color-coded section headers (happy_path=emerald, edge_case=blue, error_state=red, boundary=purple)
- Suite generation progress uses interpolation during generating_steps phase (50-85% range based on testCasesGenerated/testCasesTotal ratio)
- runTestCase delegates to existing triggerTestRun infrastructure and updates test_cases.testRunId for result linking
- Accessibility panel renders violations as collapsible list (initially collapsed if >5 violations) with impact severity badges and learn-more links

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 9 complete: all 4 plans executed (DB schema, core AI, Temporal workflow, frontend)
- Suite management accessible at /suites with full CRUD lifecycle
- Accessibility insights visible on every test run results page
- All TypeScript type checks pass (only pre-existing vite.config.ts and e2e errors remain)
- Ready for Phase 10: Polish and Deployment

---
*Phase: 09-test-suite-generation-and-accessibility*
*Completed: 2026-03-07*
