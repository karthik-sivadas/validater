---
phase: 07-video-and-reporting
plan: 01
subsystem: video
tags: [playwright, recordVideo, webm, ffmpeg-static, filesystem-storage]

# Dependency graph
requires:
  - phase: 03-browser-execution-engine
    provides: BrowserContext and pool management in execute-steps activity
  - phase: 06.1-step-details
    provides: Factory DI pattern (createExecuteActivities), staging table pattern
provides:
  - Debug video recording for every viewport execution
  - Video storage module (saveVideo, getVideoPath, VIDEOS_DIR)
  - videoPath column on testRunResults table
  - ffmpeg-static dependency for future polished video processing
affects: [07-02-report-generation, 07-03-video-playback]

# Tech tracking
tech-stack:
  added: [ffmpeg-static, "@types/ffmpeg-static"]
  patterns: [filesystem-video-storage-with-db-path-reference, best-effort-video-recording]

key-files:
  created:
    - packages/worker/src/video/storage.ts
  modified:
    - packages/core/src/execution/types.ts
    - packages/db/src/schema/test-runs.ts
    - packages/worker/src/activities/execute-steps.activity.ts
    - packages/worker/src/activities/persist-results.activity.ts
    - packages/worker/package.json

key-decisions:
  - "readFile+writeFile instead of rename for cross-device temp-to-permanent video copy"
  - "Video reference captured before context.close(), file read after -- Playwright only finalizes on close"
  - "All video operations best-effort (try/catch) -- never break test execution"
  - "videoPath stored as relative path (testRunId/viewport.webm) -- VIDEOS_DIR prefix resolved at read time"

patterns-established:
  - "Filesystem video storage: store binary on disk under data/videos/, persist relative path in DB"
  - "Temp dir lifecycle: mkdtemp before context creation, rm after copy to permanent storage"

# Metrics
duration: 4min
completed: 2026-03-07
---

# Phase 7 Plan 01: Debug Video Recording Backend Summary

**Playwright recordVideo wired into executeStepsActivity with filesystem storage module and DB path persistence**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-07T03:33:22Z
- **Completed:** 2026-03-07T03:37:09Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Every viewport execution now records a debug .webm video via Playwright's built-in recordVideo
- Video files stored on filesystem at data/videos/{testRunId}/{viewport}.webm with relative path in DB
- ffmpeg-static installed for future polished video processing (Plan 03)
- All video operations are best-effort -- recording/save failures never break test execution

## Task Commits

Each task was committed atomically:

1. **Task 1: DB schema, video storage module, and dependency installation** - `49149f4` (feat)
2. **Task 2: Wire recordVideo into executeStepsActivity and persist video path** - `bfd3b51` (feat)

## Files Created/Modified
- `packages/worker/src/video/storage.ts` - Video filesystem storage helpers (saveVideo, getVideoPath, VIDEOS_DIR)
- `packages/core/src/execution/types.ts` - Added optional videoPath field to ExecutionResult interface
- `packages/db/src/schema/test-runs.ts` - Added nullable videoPath column to testRunResults table
- `packages/worker/src/activities/execute-steps.activity.ts` - Added recordVideo to BrowserContext, video capture/save after context.close(), temp dir lifecycle
- `packages/worker/src/activities/persist-results.activity.ts` - Persist videoPath in testRunResults insert
- `packages/worker/package.json` - Added ffmpeg-static and @types/ffmpeg-static dependencies

## Decisions Made
- Used readFile+writeFile instead of rename for video copy (temp dir may be on different filesystem than data dir)
- Captured video reference (page.video()) before context.close() but read file path after close (Playwright only finalizes video on context close)
- Stored videoPath as relative path (testRunId/viewport.webm) in DB -- VIDEOS_DIR prefix resolved at read time via getVideoPath()
- All video operations wrapped in try/catch at the activity level -- video save failure must never break test execution pipeline
- Installed ffmpeg-static now (needed by Plan 03) to avoid a second schema push later

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused rm import from storage.ts**
- **Found during:** Task 2 (full turbo typecheck)
- **Issue:** Plan spec included rm in storage.ts imports, but rm is only used in the activity (temp dir cleanup), not in the storage module
- **Fix:** Removed unused rm from the import statement in storage.ts
- **Files modified:** packages/worker/src/video/storage.ts
- **Verification:** pnpm turbo typecheck passes (worker package and web package no longer report unused import error)
- **Committed in:** bfd3b51 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor fix for TypeScript strictness. No scope creep.

## Issues Encountered
None -- plan executed smoothly.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Debug video files are now produced for every test execution
- videoPath is persisted in test_run_results table
- Ready for Plan 07-02 (report generation) and Plan 07-03 (video playback UI and polished video export)
- ffmpeg-static is already installed for the polished video processing in Plan 03

---
*Phase: 07-video-and-reporting*
*Completed: 2026-03-07*
