---
phase: 03-browser-execution-engine
plan: 02
subsystem: testing
tags: [playwright, browser-pool, generic-pool, temporal-activities, viewport, memory-monitor]

# Dependency graph
requires:
  - phase: 03-browser-execution-engine
    provides: Step execution engine (executeSteps), ExecutionResult/ExecutionConfig types, ViewportConfig and VIEWPORT_PRESETS
  - phase: 02-ai-agent
    provides: TestStep types, Playwright runtime dependency in worker
provides:
  - BrowserPool with generic-pool lifecycle management (create/destroy/validate)
  - Memory health monitoring with configurable RSS and heap thresholds
  - executeStepsActivity for single-viewport step execution via Temporal
  - executeViewportsActivity for multi-viewport fan-out execution via Temporal
  - Lazy singleton pool with graceful shutdown
affects: [04-workflow-orchestration, 05-test-run-persistence]

# Tech tracking
tech-stack:
  added: [generic-pool]
  patterns:
    - "Browser pooling via generic-pool with testOnBorrow validation"
    - "Memory-aware pool validation -- reject acquire when RSS or heap exceeds threshold"
    - "BrowserContext-per-viewport isolation -- never resize, always new context"
    - "Sequential multi-viewport execution -- safer for memory than parallel pool drain"

key-files:
  created:
    - packages/worker/src/browser/pool.ts
    - packages/worker/src/browser/memory-monitor.ts
    - packages/worker/src/browser/index.ts
    - packages/worker/src/activities/execute-steps.activity.ts
    - packages/worker/src/activities/execute-viewports.activity.ts
  modified:
    - packages/worker/package.json

key-decisions:
  - "generic-pool with testOnBorrow validates browser health on every acquire (connected, lifetime, pages, memory)"
  - "Sequential viewport execution in multi-viewport activity -- pool has limited browsers, parallel would exhaust pool"
  - "BrowserContext per viewport (not page resize) for full isolation including cookies, storage, device emulation"
  - "Memory monitor uses process.memoryUsage() -- no external dependencies for health checks"

patterns-established:
  - "Pool acquire/release always paired via try/finally -- no leaked browsers"
  - "BrowserContext lifecycle in inner try/finally -- no leaked contexts even on step failure"
  - "Activity returns only plain serializable objects -- Temporal serialization requirement"
  - "Lazy singleton pool pattern with getDefaultPool() / shutdownPool()"

# Metrics
duration: 2min
completed: 2026-03-06
---

# Phase 3 Plan 2: Browser Pool and Temporal Activities Summary

**Browser pool via generic-pool with lifecycle retirement (5min/50pages) and Temporal activities for single/multi-viewport step execution**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-06T18:13:17Z
- **Completed:** 2026-03-06T18:15:42Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Built browser pool wrapping generic-pool with create/destroy/validate lifecycle management
- Pool validates on every acquire: browser connected, lifetime < 5min, pages < 50, memory healthy
- Memory monitor checks process RSS (< 1.5GB) and heap percentage (< 90%) with configurable thresholds
- executeStepsActivity acquires pooled browser, creates isolated BrowserContext per viewport, runs core step executor
- executeViewportsActivity resolves preset names to configs and sequentially runs all viewports
- Lazy singleton pool via getDefaultPool() with graceful shutdownPool() drain

## Task Commits

Each task was committed atomically:

1. **Task 1: Install generic-pool, create browser pool and memory monitor** - `a3fcbb4` (feat)
2. **Task 2: Temporal activities for single-viewport and multi-viewport execution** - `ce9937a` (feat)

## Files Created/Modified
- `packages/worker/src/browser/pool.ts` - BrowserPool with generic-pool factory, validate lifecycle, lazy singleton
- `packages/worker/src/browser/memory-monitor.ts` - Memory health check utility (RSS + heap thresholds)
- `packages/worker/src/browser/index.ts` - Barrel exports for browser pool module
- `packages/worker/src/activities/execute-steps.activity.ts` - Temporal activity for single-viewport step execution
- `packages/worker/src/activities/execute-viewports.activity.ts` - Temporal activity for multi-viewport fan-out
- `packages/worker/package.json` - Added generic-pool and @types/generic-pool dependencies

## Decisions Made
- Used generic-pool with testOnBorrow to validate browser health on every acquire -- catches disconnected, expired, and memory-pressured browsers before use
- Sequential viewport execution in multi-viewport activity -- parallel would exhaust the pool (max 3 browsers) and risk OOM
- BrowserContext per viewport instead of page resize -- provides full isolation (cookies, storage, device emulation)
- Memory monitor uses process.memoryUsage() with no external deps -- lightweight health check suitable for pool validation hot path
- navigate to URL in executeStepsActivity before running steps -- ensures page is loaded before step execution begins

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Browser pool and execution activities ready for Temporal workflow integration (03-03)
- executeStepsActivity can be called from any Temporal workflow with URL + steps + viewport
- executeViewportsActivity provides the multi-viewport fan-out that test run workflows will orchestrate
- Existing Phase 2 activities (crawl-dom, validate-steps) untouched -- pool migration deferred to Phase 4

---
*Phase: 03-browser-execution-engine*
*Completed: 2026-03-06*
