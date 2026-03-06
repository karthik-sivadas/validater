---
phase: 05-frontend-dashboard-and-results
plan: 04
subsystem: ui
tags: [tanstack-router, zod-adapter, shadcn, table, pagination, filtering, url-state]

# Dependency graph
requires:
  - phase: 05-frontend-dashboard-and-results
    provides: "getTestRunList server function, shadcn table/tooltip/badge/select components, dashboard navigation layout"
provides:
  - "Test history page at /runs with paginated table of past test runs"
  - "URL-driven filtering by status and search by URL"
  - "Clickable rows navigating to /runs/$runId detail view"
  - "Empty states for no runs and no filter matches"
  - "Directory-based routing structure for runs/ with layout Outlet"
affects: [06-live-monitoring]

# Tech tracking
tech-stack:
  added: []
  patterns: ["z.catch() for search param defaults (avoids deep type instantiation from fallback())", "Directory-based routing with layout Outlet for nested runs routes", "Navigate with direct search object merge instead of reducer function"]

key-files:
  created:
    - "packages/web/src/routes/_authed/runs/index.tsx"
  modified:
    - "packages/web/src/routes/_authed/runs.tsx"
    - "packages/web/src/routeTree.gen.ts"
    - "packages/web/src/routes/_authed/runs/$runId.tsx (moved from flat format)"

key-decisions:
  - "Used z.catch() instead of fallback() from @tanstack/zod-adapter to avoid TS2589 deep type instantiation on search params"
  - "Navigate with direct search object { ...search, ...updates } instead of reducer (prev) => ... to satisfy TanStack Router strict typing"
  - "Cast loader result as unknown as typed interface to bypass dynamic import Promise type incompatibility"
  - "Moved $runId route from flat runs.$runId.tsx to directory runs/$runId.tsx for TanStack Router directory-based routing consistency"

patterns-established:
  - "URL-driven filter state: search params via validateSearch + zodValidator, no local state for filters except pre-submit search input"
  - "Directory routing for nested routes: layout file (runs.tsx) with Outlet, child routes in runs/ directory"
  - "onValueChange handler on base-ui Select accepts string | null -- guard with null check"

# Metrics
duration: 11min
completed: 2026-03-06
---

# Phase 5 Plan 4: Test History Page Summary

**Filterable, paginated test history table at /runs with URL-driven state, status badges, and clickable rows linking to detail view**

## Performance

- **Duration:** ~11 min
- **Started:** 2026-03-06T19:34:13Z
- **Completed:** 2026-03-06T19:45:47Z
- **Tasks:** 1
- **Files modified:** 4

## Accomplishments
- Created test history page with paginated table showing URL, description, status badge, viewports, and creation date
- Implemented URL-driven filtering (status dropdown, search by URL) with all state in search params for shareable URLs
- Added pagination controls (Previous/Next) with proper boundary disabling
- Built empty states for both "no runs yet" (with link to create test) and "no filter matches" (with clear filters button)
- Converted runs routing to directory-based structure with layout Outlet for proper nested routing

## Task Commits

Each task was committed atomically:

1. **Task 1: Create test history page with URL-driven filtering and pagination** - `2a23d4e` (feat)

## Files Created/Modified
- `packages/web/src/routes/_authed/runs/index.tsx` - Test history page with table, filters, pagination, empty states
- `packages/web/src/routes/_authed/runs.tsx` - Converted from stub page to layout route with Outlet
- `packages/web/src/routes/_authed/runs/$runId.tsx` - Moved from flat format runs.$runId.tsx (content unchanged)
- `packages/web/src/routeTree.gen.ts` - Regenerated with index and $runId as children of runs layout

## Decisions Made
- Used `z.catch()` instead of `fallback()` from `@tanstack/zod-adapter` -- the `fallback()` utility wraps schemas in `z.custom().pipe(schema.catch())` which causes TypeScript TS2589 "Type instantiation is excessively deep" errors when combined with TanStack Router's complex generic inference. Direct `.catch()` on zod schemas provides identical runtime behavior without the deep type nesting.
- Navigate with direct merged object `{ ...search, ...updates }` instead of reducer function `(prev) => ({ ...prev, ...updates })` -- TanStack Router's `useNavigate()` without route context has stricter typing for the search parameter that doesn't accept reducer functions from arbitrary routes.
- Cast loader result through `unknown` to typed interface to bypass Promise type incompatibility from dynamic imports (same pattern established in 05-01 for server function return types).
- Moved `$runId` route from flat `runs.$runId.tsx` format to directory `runs/$runId.tsx` -- TanStack Router's file-based routing requires child routes to be in the directory when a layout file (`runs.tsx`) uses Outlet for directory-based routing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Converted runs.tsx stub to layout route with Outlet**
- **Found during:** Task 1
- **Issue:** Creating `runs/index.tsx` requires `runs.tsx` to be a layout route that renders `<Outlet />`, otherwise child routes won't render
- **Fix:** Changed `runs.tsx` from rendering page content to rendering `<Outlet />`
- **Files modified:** packages/web/src/routes/_authed/runs.tsx
- **Verification:** Route tree generates correctly with index as child of runs layout
- **Committed in:** 2a23d4e

**2. [Rule 3 - Blocking] Moved $runId route from flat to directory format**
- **Found during:** Task 1
- **Issue:** With `runs/` directory for index.tsx, the flat `runs.$runId.tsx` route was not picked up by the route generator as a child of the runs layout
- **Fix:** Moved `runs.$runId.tsx` to `runs/$runId.tsx` (content unchanged)
- **Files modified:** packages/web/src/routes/_authed/runs/$runId.tsx (moved)
- **Verification:** Route tree includes both `/runs/` index and `/runs/$runId` as children of `/_authed/runs` layout
- **Committed in:** 2a23d4e

**3. [Rule 1 - Bug] Fixed deep type instantiation from fallback() utility**
- **Found during:** Task 1 (typecheck)
- **Issue:** `fallback()` from `@tanstack/zod-adapter` wraps schemas in `z.custom().pipe(schema.catch())` causing TS2589 "Type instantiation is excessively deep" with TanStack Router's generic inference
- **Fix:** Replaced `fallback(z.number().int().positive(), 1)` with `z.number().int().positive().catch(1)` for all search params
- **Files modified:** packages/web/src/routes/_authed/runs/index.tsx
- **Verification:** TypeScript compilation passes (0 errors excluding pre-existing vite.config.ts)
- **Committed in:** 2a23d4e

**4. [Rule 1 - Bug] Fixed Select onValueChange null parameter type**
- **Found during:** Task 1 (typecheck)
- **Issue:** base-ui Select's `onValueChange` passes `string | null` but handler was typed as `(val: string) => void`
- **Fix:** Added null guard: `(val: string | null) => { if (val) { ... } }`
- **Files modified:** packages/web/src/routes/_authed/runs/index.tsx
- **Verification:** TypeScript compilation passes
- **Committed in:** 2a23d4e

---

**Total deviations:** 4 auto-fixed (2 blocking, 2 bugs)
**Impact on plan:** All fixes necessary for correct routing structure and TypeScript compilation. No scope creep.

## Issues Encountered
- TypeScript OOM on first typecheck attempt -- required `NODE_OPTIONS="--max-old-space-size=8192"` to complete. This is a pre-existing project-wide issue, not specific to this plan.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Test history page complete at /runs with full filtering and pagination
- Ready for plan 05-03 (test run detail page) to expand the $runId stub into full implementation
- Directory-based routing structure established for all future runs/ child routes

---
*Phase: 05-frontend-dashboard-and-results*
*Completed: 2026-03-06*
