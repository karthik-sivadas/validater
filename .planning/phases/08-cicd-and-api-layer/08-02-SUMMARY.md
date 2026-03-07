---
phase: 08-cicd-and-api-layer
plan: 02
subsystem: api
tags: [rest-api, tanstack-start, api-key, server-routes, zod]

# Dependency graph
requires:
  - phase: 08-cicd-and-api-layer
    provides: verifyApiKey() helper, API key infrastructure
  - phase: 04-workflow-orchestration
    provides: Temporal workflow, testRunWorkflow, getTestRunStatus query
  - phase: 06.1-step-details
    provides: screenshotBase64 in test_run_steps table
provides:
  - "POST /api/v1/runs endpoint for programmatic test run creation"
  - "GET /api/v1/runs/:id endpoint for status polling and result retrieval"
  - "triggerTestRun() shared core logic in run-test-core.ts"
  - "Inline screenshotBase64 in API response for CI/CD consumers"
affects: [08-03-github-action]

# Tech tracking
tech-stack:
  added: []
  patterns: ["TanStack Start server route handlers for REST API", "Shared core logic extraction for server function / API route reuse"]

key-files:
  created:
    - "packages/web/src/server/run-test-core.ts"
    - "packages/web/src/routes/api/v1/runs/index.ts"
    - "packages/web/src/routes/api/v1/runs/$runId.ts"
  modified:
    - "packages/web/src/server/run-test.ts"
    - "packages/web/src/routeTree.gen.ts"

key-decisions:
  - "Extracted triggerTestRun() to run-test-core.ts for server function and API route reuse"
  - "Route files use index.ts and $runId.ts in runs/ directory for TanStack file-based routing"
  - "screenshotBase64 included inline (not URL-based) for single-request CI/CD consumption"
  - "Ownership check returns 404 (not 403) to avoid leaking test run existence"
  - "Invalid viewport errors surfaced as 400 (not 500) for actionable client feedback"

patterns-established:
  - "Pattern: TanStack Start server route with createFileRoute for REST API endpoints"
  - "Pattern: Dynamic imports inside server route handlers to avoid client bundling"
  - "Pattern: Shared core logic (run-test-core.ts) between server functions and API routes"

# Metrics
duration: 3min
completed: 2026-03-07
---

# Phase 8 Plan 2: REST API Endpoints Summary

**POST /api/v1/runs and GET /api/v1/runs/:id with API key auth, shared triggerTestRun core logic, and inline screenshotBase64 results**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-07T04:56:55Z
- **Completed:** 2026-03-07T04:59:57Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Extracted shared triggerTestRun() from run-test.ts into run-test-core.ts, eliminating business logic duplication between frontend and API
- Created POST /api/v1/runs with Zod validation, API key auth, and 201 response for programmatic test run creation
- Created GET /api/v1/runs/:id with live Temporal status queries, DB fallback, and full results with inline screenshotBase64 for completed runs
- Ownership verification ensures API key users can only access their own test runs

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract shared core logic and create POST /api/v1/runs** - `ea18f74` (feat)
2. **Task 2: Create GET /api/v1/runs/:id endpoint with status and results** - `29f2215` (feat)

## Files Created/Modified
- `packages/web/src/server/run-test-core.ts` - Shared triggerTestRun() core logic
- `packages/web/src/server/run-test.ts` - Refactored to delegate to shared core
- `packages/web/src/routes/api/v1/runs/index.ts` - POST /api/v1/runs endpoint
- `packages/web/src/routes/api/v1/runs/$runId.ts` - GET /api/v1/runs/:id endpoint
- `packages/web/src/routeTree.gen.ts` - Auto-generated route tree updated

## Decisions Made
- **Shared core extraction:** Created run-test-core.ts with triggerTestRun() that handles nanoid generation, viewport resolution, DB insert, and Temporal workflow start. Both the existing createServerFn (session auth) and the new API route (API key auth) call this same function.
- **Directory-based routing:** Used `runs/index.ts` for the collection endpoint and `runs/$runId.ts` for the resource endpoint, matching TanStack Start file-based routing conventions.
- **Inline screenshots:** screenshotBase64 is returned directly in the API response (not as separate URL endpoints). CI/CD consumers (GitHub Actions) get complete results in a single request.
- **404 for unauthorized access:** Ownership check returns 404 (not 403) to avoid leaking that a test run ID exists but belongs to another user. Same pattern as getTestRunDetail.
- **Viewport validation as 400:** Invalid viewport names throw from triggerTestRun, caught and returned as 400 with descriptive message rather than 500.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- REST API endpoints complete, ready for GitHub Action integration (Plan 08-03)
- Both endpoints use Bearer token auth via verifyApiKey() from 08-01
- Response format includes testRunId for polling and inline screenshotBase64 for result consumption

---
*Phase: 08-cicd-and-api-layer*
*Completed: 2026-03-07*
