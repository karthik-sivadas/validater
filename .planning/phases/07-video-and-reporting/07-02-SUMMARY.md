---
phase: 07-video-and-reporting
plan: 02
subsystem: reporting
tags: [html-report, pdf-export, playwright-pdf, mustache-template, blob-download]

# Dependency graph
requires:
  - phase: 06.1-step-details
    provides: step screenshots, action/description fields in test_run_steps
  - phase: 05-frontend-dashboard
    provides: results page, test run detail server function
provides:
  - HTML report export from completed test run results
  - PDF report export via Playwright Chromium rendering
  - Report generators reusable from worker package
affects: [08-account-settings, 10-polish]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Mustache-style HTML template with inline CSS for standalone reports
    - Playwright Chromium page.pdf() for server-side PDF generation
    - Blob download trigger pattern for client-side file downloads
    - Base64 PDF transfer via server functions (no file streaming needed)

key-files:
  created:
    - packages/worker/src/reports/templates/report.html
    - packages/worker/src/reports/html-generator.ts
    - packages/worker/src/reports/pdf-generator.ts
    - packages/web/src/server/exports.ts
  modified:
    - packages/worker/src/index.ts
    - packages/web/src/routes/_authed/runs/$runId.tsx

key-decisions:
  - "Standalone HTML with inline CSS (no external deps) for universal browser rendering"
  - "Fresh Chromium launch per PDF (not browser pool) since PDF generation is infrequent"
  - "Base64 PDF transfer via server function return value (not file streaming)"
  - "Shared buildReportData helper in exports.ts for DRY HTML/PDF generation"
  - "Export buttons only visible for status=complete test runs"

patterns-established:
  - "Mustache-style template pattern: {{placeholder}} replaced via string.replace()"
  - "Blob download pattern: Blob + createObjectURL + click + revokeObjectURL"

# Metrics
duration: 4min
completed: 2026-03-07
---

# Phase 7 Plan 02: Report Export Summary

**HTML and PDF report export with standalone template, Playwright PDF rendering, and download buttons on results page**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-07T03:33:32Z
- **Completed:** 2026-03-07T03:37:08Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Standalone HTML report template with professional styling (Inter font, emerald/red colors, print media queries)
- generateHtmlReport builds complete HTML from test run data with summary stats, viewport sections, step cards, and inline base64 screenshots
- generatePdfReport converts HTML to A4 PDF via Playwright Chromium with page numbers and header/footer
- Server functions exportHtmlReport and exportPdfReport with auth, ownership check, and dynamic imports
- Export HTML and Export PDF buttons on results page, visible only for completed test runs

## Task Commits

Each task was committed atomically:

1. **Task 1: HTML report template and generators** - `a8041e9` (feat)
2. **Task 2: Report export server functions and results page export buttons** - `2118dbd` (feat)

## Files Created/Modified
- `packages/worker/src/reports/templates/report.html` - Standalone HTML report template with inline CSS and mustache placeholders
- `packages/worker/src/reports/html-generator.ts` - Generates complete HTML report from ReportData, replacing template placeholders
- `packages/worker/src/reports/pdf-generator.ts` - Converts HTML to PDF via fresh Playwright Chromium instance
- `packages/web/src/server/exports.ts` - exportHtmlReport and exportPdfReport server functions with auth and data fetching
- `packages/worker/src/index.ts` - Re-exports report generators for consumer packages
- `packages/web/src/routes/_authed/runs/$runId.tsx` - Added export buttons with loading state and blob download

## Decisions Made
- Used standalone HTML with all CSS inline (no external dependencies) so reports render in any browser without network access
- Fresh Chromium launch per PDF generation (not browser pool) since exports are infrequent user-triggered actions
- Transfer PDF as base64 string in server function return rather than file streaming -- simpler, and reports are typically small
- Shared buildReportData helper extracts common auth + data fetching logic for both HTML and PDF exports
- Export buttons conditionally rendered only when run.status === "complete"

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Report export complete and ready for use
- HTML and PDF generators are re-exported from @validater/worker, available for any future consumer
- Pre-existing web typecheck errors remain (vite.config.ts test property, e2e KNOWN_ACTIONS unused) -- unrelated to this plan

---
*Phase: 07-video-and-reporting*
*Completed: 2026-03-07*
