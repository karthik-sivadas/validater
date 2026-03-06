---
phase: 06-live-streaming
plan: 01
subsystem: streaming
tags: [cdp, screencast, redis, websocket, hono, ioredis, pub-sub, real-time]

# Dependency graph
requires:
  - phase: 03-browser-execution-engine
    provides: "Browser pool, step executor, Playwright Page lifecycle"
  - phase: 04-workflow-orchestration
    provides: "Temporal workflows, execute-steps activity, viewport fan-out"
provides:
  - "CDP screencast frame capture from Playwright pages"
  - "Redis pub/sub transport for streaming events"
  - "Hono WebSocket sidecar on port 3001 with /stream/:testRunId"
  - "StreamingConfig wired through workflow -> activity pipeline"
  - "Redis container in docker-compose.yml"
affects: [06-02-frontend-live-viewer, 07-reporting]

# Tech tracking
tech-stack:
  added: [ioredis, hono, "@hono/node-server", "@hono/node-ws", "Redis 7-alpine"]
  patterns: ["CDP screencast with immediate frame ack", "Redis pub/sub per test run channel", "Hono WebSocket sidecar (separate from TanStack Start)", "Best-effort streaming (try/catch, never breaks execution)", "Singleton Redis publisher with lazy init"]

key-files:
  created:
    - packages/worker/src/streaming/types.ts
    - packages/worker/src/streaming/screencast.ts
    - packages/worker/src/streaming/redis-publisher.ts
    - packages/worker/src/streaming/ws-sidecar.ts
  modified:
    - docker/docker-compose.yml
    - packages/worker/package.json
    - packages/worker/src/activities/execute-steps.activity.ts
    - packages/worker/src/workflows/viewport-execution.workflow.ts
    - packages/worker/src/workflows/test-run.workflow.ts
    - packages/worker/src/worker.ts

key-decisions:
  - "Hono WebSocket sidecar on port 3001 -- TanStack Start does not support WebSockets natively"
  - "Each WS connection gets its own Redis subscriber (ioredis requires separate pub/sub connections)"
  - "Streaming enabled only for first viewport to avoid overwhelming client with multiple streams"
  - "All streaming operations wrapped in try/catch -- streaming failures never break test execution"
  - "Frame ack sent immediately before processing to prevent CDP backpressure stalling"
  - "Step events published after executeSteps returns (core executor has no callback hooks)"

patterns-established:
  - "CDP screencast: page.context().newCDPSession(page) -> Page.startScreencast -> Page.screencastFrameAck -> cleanup"
  - "Redis channel naming: stream:${testRunId} for per-run isolation"
  - "Best-effort streaming: every publish/subscribe wrapped in .catch(() => {}) or try/catch"
  - "Singleton publisher pattern: lazy init with error handler, explicit shutdown on process exit"
  - "WS sidecar lifecycle: started in worker.ts run(), cleanup via shutdownRedis() in SIGINT/SIGTERM"

# Metrics
duration: 6min
completed: 2026-03-07
---

# Phase 6 Plan 1: Streaming Backend Summary

**CDP screencast capture with Redis pub/sub transport and Hono WebSocket sidecar on port 3001 for real-time browser frame streaming**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-06T20:48:07Z
- **Completed:** 2026-03-06T20:54:18Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Full streaming pipeline: CDP screencast -> Redis pub/sub -> WebSocket sidecar -> browser clients
- Redis 7-alpine container added to infrastructure with persistent volume
- Execute-steps activity conditionally starts CDP screencast and publishes frames/step events
- Test-run workflow enables streaming for first viewport only (index 0)
- Worker entry point starts WS sidecar and handles graceful Redis shutdown

## Task Commits

Each task was committed atomically:

1. **Task 1: Infrastructure, streaming types, CDP screencast, and Redis publisher** - `04513aa` (feat)
2. **Task 2: WebSocket sidecar, activity wiring, workflow updates, and worker entry** - `c973a4e` (feat)

## Files Created/Modified
- `packages/worker/src/streaming/types.ts` - ScreencastFrame, StepEvent, StreamMessage, StreamingConfig types and channelName helper
- `packages/worker/src/streaming/screencast.ts` - CDP Page.startScreencast with immediate frame ack and cleanup function
- `packages/worker/src/streaming/redis-publisher.ts` - Singleton Redis publisher with publishFrame, publishStepEvent, publishStreamEnd, shutdownRedis
- `packages/worker/src/streaming/ws-sidecar.ts` - Hono WebSocket server on port 3001 with /health and /stream/:testRunId routes
- `docker/docker-compose.yml` - Added Redis 7-alpine service with redis_data volume
- `packages/worker/package.json` - Added ioredis, hono, @hono/node-server, @hono/node-ws dependencies
- `packages/worker/src/activities/execute-steps.activity.ts` - Added optional streamingConfig, CDP screencast integration, step event publishing
- `packages/worker/src/workflows/viewport-execution.workflow.ts` - Added streamingConfig passthrough to activity
- `packages/worker/src/workflows/test-run.workflow.ts` - Enabled streaming for first viewport (index 0) in fan-out
- `packages/worker/src/worker.ts` - Added startWsSidecar() call and shutdownRedis() in shutdown handler

## Decisions Made
- Used Hono WebSocket sidecar on port 3001 because TanStack Start does not support WebSockets natively (srvx/h3 v2 transition broke WS support)
- Each WebSocket connection creates its own Redis subscriber instance because ioredis enters subscriber mode on a connection and can no longer send regular commands
- Streaming enabled only for the first viewport (index 0) in the fan-out to avoid multiple simultaneous CDP screencasts overwhelming the client
- All streaming operations wrapped in try/catch so failures never break test execution -- streaming is best-effort
- CDP frame acknowledgment sent immediately before processing to prevent backpressure stalling (frame delivery stops if previous frame not ack'd)
- Step events published by iterating over stepResults after executeSteps returns, since the core step executor has no callback hooks -- keeps core package unchanged

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ScreencastFrame.metadata.timestamp type to optional**
- **Found during:** Task 1 (streaming types)
- **Issue:** Plan specified `timestamp: number` but CDP protocol defines `timestamp?: Network.TimeSinceEpoch` (optional)
- **Fix:** Changed to `timestamp?: number` to match CDP `ScreencastFrameMetadata` type
- **Files modified:** packages/worker/src/streaming/types.ts
- **Verification:** tsc --noEmit passes
- **Committed in:** 04513aa (Task 1 commit)

**2. [Rule 3 - Blocking] Fixed ioredis import for NodeNext module resolution**
- **Found during:** Task 1 (Redis publisher)
- **Issue:** `import Redis from 'ioredis'` fails with NodeNext -- ioredis uses `export { default }` pattern which requires named import
- **Fix:** Changed to `import { Redis } from 'ioredis'` and added explicit `Error` type annotation on error handler parameter
- **Files modified:** packages/worker/src/streaming/redis-publisher.ts
- **Verification:** tsc --noEmit passes
- **Committed in:** 04513aa (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both auto-fixes necessary for TypeScript compilation. No scope creep.

## Issues Encountered
- Pre-existing TypeScript error in core/src/ai/client.ts (structuredOutputs property) -- unrelated to streaming work, documented in STATE.md

## User Setup Required
None - Redis container added to existing docker-compose.yml, started with `podman compose up`.

## Next Phase Readiness
- Streaming backend is complete and ready for frontend integration (Plan 06-02)
- Frontend needs `useLiveStream` hook connecting to `ws://localhost:3001/stream/:testRunId`
- Redis must be running for streaming to work -- `podman compose up redis` or full stack

---
*Phase: 06-live-streaming*
*Completed: 2026-03-07*
