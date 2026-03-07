---
phase: 07-video-and-reporting
plan: 03
subsystem: video
tags: [video-playback, ffmpeg, polished-video-export, temporal-workflow, mp4, drawtext, h264]

# Dependency graph
requires:
  - phase: 07-video-and-reporting
    provides: Debug video recording, video storage module (saveVideo, getVideoPath), videoPath column, ffmpeg-static dependency
  - phase: 07-video-and-reporting
    provides: Report export server functions (exports.ts), blob download pattern
  - phase: 06.1-step-details
    provides: Step action/description fields in test_run_steps for annotations
provides:
  - Debug video playback in results page per viewport
  - Polished video export with FFmpeg annotations, dead time trimming, and resolution scaling
  - Export video Temporal workflow (exportVideoWorkflow) for non-blocking processing
  - Video serving, export triggering, status polling, and download server functions
affects: [10-polish]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "FFmpeg spawn wrapper with drawtext filter for timed text annotations"
    - "Trim+setpts+concat filter chain for dead time removal"
    - "Temporal workflow for non-blocking video processing with polling-based status"
    - "Base64 video transfer via server function (same pattern as PDF export)"

key-files:
  created:
    - packages/worker/src/video/processor.ts
    - packages/worker/src/activities/export-video.activity.ts
    - packages/worker/src/workflows/export-video.workflow.ts
  modified:
    - packages/web/src/server/exports.ts
    - packages/web/src/routes/_authed/runs/$runId.tsx
    - packages/worker/src/workflows/test-run.workflow.ts
    - packages/worker/src/worker.ts
    - packages/worker/src/index.ts

key-decisions:
  - "ffmpeg-static default export cast through unknown for TypeScript compatibility (module vs string type)"
  - "FFmpeg drawtext colon escape + right single quote substitution avoids nested escaping complexity"
  - "Trim segments built from step timing with 0.5s padding and merged overlapping segments"
  - "Resolution options as interface (not const assertion) to avoid SetStateAction type narrowing issues"
  - "Export controls embedded in video card section (not separate card) for visual grouping"
  - "exportId used for Temporal workflow ID prefix -- status polling uses handle.describe()"

patterns-established:
  - "Temporal export workflow pattern: trigger via server function -> poll status -> download on complete"
  - "FFmpeg filter_complex for trim+concat+scale+drawtext pipeline"

# Metrics
duration: 6min
completed: 2026-03-07
---

# Phase 7 Plan 03: Video Playback and Polished Export Summary

**Debug video playback in results page with FFmpeg-powered polished video export featuring annotations, dead time trimming, and resolution scaling via Temporal workflow**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-07T03:40:20Z
- **Completed:** 2026-03-07T03:45:52Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- Per-viewport "Play Debug Video" button loads .webm recording inline with native browser controls
- FFmpeg processor applies timed text annotations (drawtext), dead time trimming (trim+setpts+concat), and resolution scaling (scale) to produce H.264 MP4
- Export video Temporal workflow enables non-blocking polished video processing with polling-based status updates
- Full export UI with resolution picker (720p/1080p), annotation toggle, trim toggle, processing indicator, and auto-download

## Task Commits

Each task was committed atomically:

1. **Task 1: Video serving, playback UI, and FFmpeg processor** - `8442e61` (feat)
2. **Task 2: Export video Temporal activity, workflow, and worker registration** - `819595e` (feat)
3. **Task 3: Export server functions and polished video export UI** - `8a309f6` (feat)

## Files Created/Modified
- `packages/worker/src/video/processor.ts` - FFmpeg wrapper for polished video processing (annotations, trimming, scaling)
- `packages/worker/src/activities/export-video.activity.ts` - Temporal activity building annotations and trim segments from step data
- `packages/worker/src/workflows/export-video.workflow.ts` - Export video workflow with 5-minute timeout
- `packages/web/src/server/exports.ts` - getVideoFile, triggerVideoExport, getExportStatus, downloadExportedVideo server functions
- `packages/web/src/routes/_authed/runs/$runId.tsx` - Video player, export controls with resolution picker, polling UI
- `packages/worker/src/workflows/test-run.workflow.ts` - Re-export exportVideoWorkflow for Temporal bundle
- `packages/worker/src/worker.ts` - Register exportVideoActivities in Worker.create()
- `packages/worker/src/index.ts` - Export getVideoPath, exportVideoWorkflow, and types

## Decisions Made
- Used `ffmpegStatic as unknown as string | null` cast because ffmpeg-static's default export type doesn't match the expected `string` parameter for `spawn()` -- the module type system represents it as the module namespace, not the string path it actually exports
- FFmpeg drawtext filter text escaping replaces single quotes with right single quote character to avoid nested escaping complexity (colons, backslashes, brackets also escaped)
- Trim segments are built from step timing data with 0.5s padding before and after each step, with overlapping segments merged
- Used `ResolutionOption` interface instead of `as const` assertion for RESOLUTION_OPTIONS to avoid TypeScript's SetStateAction narrowing on literal types
- Export controls are grouped visually inside the video card (alongside debug playback) rather than as a separate section
- `exportId` is used as the Temporal workflowId suffix (`export-{exportId}`), and status polling uses `handle.describe()` to check workflow state
- Path traversal prevention on downloadExportedVideo rejects any path containing `..`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ffmpeg-static TypeScript type incompatibility**
- **Found during:** Task 1 (typecheck)
- **Issue:** `ffmpeg-static` default export type is the module namespace type, not `string | null` as the @types declaration suggests when used with ESM imports
- **Fix:** Cast through `unknown` to `string | null` explicitly
- **Files modified:** packages/worker/src/video/processor.ts
- **Verification:** pnpm --filter @validater/worker typecheck passes
- **Committed in:** 8442e61 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed const assertion causing SetStateAction type error**
- **Found during:** Task 3 (typecheck)
- **Issue:** `RESOLUTION_OPTIONS` with `as const` creates readonly literal types that are incompatible with `useState`'s SetStateAction generic inference
- **Fix:** Changed to `ResolutionOption` interface with mutable `ResolutionOption[]` array
- **Files modified:** packages/web/src/routes/_authed/runs/$runId.tsx
- **Verification:** pnpm --filter @validater/web typecheck passes (only pre-existing errors remain)
- **Committed in:** 8a309f6 (Task 3 commit)

**3. [Rule 1 - Bug] Removed unused exportId state variable**
- **Found during:** Task 3 (typecheck)
- **Issue:** `exportId` state was declared but the value was only needed transiently in the callback, not as persistent state
- **Fix:** Removed the state variable, used `res.exportId` directly in the polling closure
- **Files modified:** packages/web/src/routes/_authed/runs/$runId.tsx
- **Verification:** No TS6133 unused variable error
- **Committed in:** 8a309f6 (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (3 bugs)
**Impact on plan:** All fixes required for TypeScript compilation. No scope creep.

## Issues Encountered
None -- plan executed smoothly.

## User Setup Required
None - no external service configuration required. FFmpeg-static was already installed in Plan 01.

## Next Phase Readiness
- Phase 7 (Video and Reporting) is now fully complete (3/3 plans)
- All video and reporting features implemented: debug video recording, HTML/PDF reports, video playback, polished video export
- Ready for Phase 8 (Account Settings and Management)

---
*Phase: 07-video-and-reporting*
*Completed: 2026-03-07*
