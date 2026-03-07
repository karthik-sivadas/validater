---
phase: 10-quality-and-coverage
plan: 03
subsystem: testing
tags: [vitest, testing-library, coverage, jsdom, integration-test, component-test]

# Dependency graph
requires:
  - phase: 10-quality-and-coverage
    provides: Test infrastructure (vitest configs, shared mock utilities, coverage v8)
provides:
  - Web package UI tests for AccessibilityPanel, useTestRunPolling, cn utility
  - Core package generation pipeline integration test with full orchestration coverage
  - Worker package execution-to-persistence integration test verifying data shape compatibility
  - Tuned coverage thresholds based on actual coverage levels with regression buffer
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: ["Testing-library render+screen pattern for React component tests", "vi.advanceTimersByTimeAsync for fake-timer hook tests", "Factory DI mock pattern for persist activity integration tests"]

key-files:
  created:
    - packages/web/src/components/__tests__/accessibility-panel.test.tsx
    - packages/web/src/hooks/__tests__/use-test-run-polling.test.ts
    - packages/web/src/lib/__tests__/utils.test.ts
    - packages/core/src/generation/__tests__/pipeline.test.ts
    - packages/worker/src/activities/__tests__/execute-persist-integration.test.ts
  modified:
    - packages/web/vitest.config.ts
    - vitest.config.ts

key-decisions:
  - "vi.advanceTimersByTimeAsync instead of waitFor for hook tests -- waitFor uses real timers internally, causing deadlock with vi.useFakeTimers"
  - "Coverage thresholds set at actual minus 5%: lines 27%, branches 74%, functions 63%, statements 27% -- prevents regression without aspirational failures"
  - "vite-tsconfig-paths plugin added to web vitest.config.ts for @ alias resolution in jsdom test environment"
  - "Factory override pattern with 'key in overrides' check instead of ?? operator to support null values in mock factories"

patterns-established:
  - "Pattern 1: vi.advanceTimersByTimeAsync(0) for flushing microtasks in fake-timer tests (avoids waitFor deadlock)"
  - "Pattern 2: Realistic ExecutionResult fixtures matching actual runtime shapes for integration testing"
  - "Pattern 3: Mock chain inspection via values.mock.calls for verifying DB insert arguments"

# Metrics
duration: 7min
completed: 2026-03-07
---

# Phase 10 Plan 03: UI Tests, Integration Tests, and Coverage Thresholds Summary

**React component tests with testing-library, pipeline/persist integration tests with mocked deps, and coverage thresholds tuned to actual levels (291 tests, all passing, exit 0)**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-07T06:23:12Z
- **Completed:** 2026-03-07T06:30:16Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- 60 new tests across 5 test files (16 component, 10 hook, 9 utility, 11 pipeline, 14 persist integration)
- Full generation pipeline orchestration test verifying crawl -> simplify -> generate -> validate -> heal flow with all dependencies mocked
- Execution-to-persistence integration test verifying realistic ExecutionResult shapes (including accessibility data, video paths, step errors) flow through persistResults
- Coverage thresholds tuned to actual levels: 291 total tests, pnpm test:coverage exits 0

## Task Commits

Each task was committed atomically:

1. **Task 1: Web UI tests, pipeline integration test, and execute-persist integration test** - `f03dc76` (test)
2. **Task 2: Tune coverage thresholds to actual levels** - `48bd1d7` (feat)

## Files Created/Modified
- `packages/web/src/components/__tests__/accessibility-panel.test.tsx` - 16 tests: violations display, severity badges, expand/collapse toggle, null impact, help URLs
- `packages/web/src/hooks/__tests__/use-test-run-polling.test.ts` - 10 tests: polling lifecycle, terminal states, unmount cleanup, error resilience, testRunId changes
- `packages/web/src/lib/__tests__/utils.test.ts` - 9 tests: cn() class merging, Tailwind deduplication, conditional/object/array inputs
- `packages/core/src/generation/__tests__/pipeline.test.ts` - 11 tests: full pipeline orchestration, nanoid ID assignment, cost tracking, healer invocation logic
- `packages/worker/src/activities/__tests__/execute-persist-integration.test.ts` - 14 tests: data shape compatibility, multi-viewport, error mapping, staging table lookup, accessibility persistence
- `packages/web/vitest.config.ts` - Added vite-tsconfig-paths plugin for @ alias resolution
- `vitest.config.ts` - Tuned global coverage thresholds: lines 27%, branches 74%, functions 63%, statements 27%

## Decisions Made
- Used `vi.advanceTimersByTimeAsync` instead of testing-library's `waitFor` for hook tests -- `waitFor` internally uses real timers which deadlocks with `vi.useFakeTimers()`, causing 5s timeouts
- Set coverage thresholds based on actual measured values minus 5% buffer (lines 33.2% actual -> 27% threshold) -- the purpose is regression prevention, not aspiration
- Added `vite-tsconfig-paths` plugin to web vitest.config.ts (was only in vite.config.ts) -- `defineProject` in vitest doesn't inherit Vite plugins, so the `@/` path alias wasn't resolving
- Used `'impact' in overrides` pattern instead of `??` in mock factories to correctly handle explicit `null` values (JavaScript `null ?? default` returns `default`)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added vite-tsconfig-paths plugin to web vitest.config.ts**
- **Found during:** Task 1 (Web UI tests)
- **Issue:** Web component and hook tests failed with "Failed to resolve import @/components/ui/badge" -- the `@/` path alias from tsconfig.json was not being resolved in the Vitest test environment
- **Fix:** Added `vite-tsconfig-paths` plugin to `packages/web/vitest.config.ts` (matching what `vite.config.ts` already had)
- **Files modified:** packages/web/vitest.config.ts
- **Verification:** All 35 web tests pass
- **Committed in:** f03dc76 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed mock factory null handling for impact field**
- **Found during:** Task 1 (accessibility-panel tests)
- **Issue:** `makeViolation({ impact: null })` used `overrides.impact ?? 'serious'` which returns `'serious'` for `null` (since `??` treats `null` as nullish), making the null-impact test case impossible to create
- **Fix:** Changed to `'impact' in overrides ? overrides.impact : 'serious'` to check key presence rather than value
- **Files modified:** packages/web/src/components/__tests__/accessibility-panel.test.tsx
- **Verification:** Null impact test passes, renders "unknown" as expected
- **Committed in:** f03dc76 (Task 1 commit)

**3. [Rule 1 - Bug] Fixed hook test timeouts from fake timer / waitFor conflict**
- **Found during:** Task 1 (use-test-run-polling tests)
- **Issue:** `waitFor` from testing-library uses real timers internally for polling, but `vi.useFakeTimers()` replaced all timers, causing `waitFor` to hang until 5s test timeout
- **Fix:** Replaced `waitFor` with `vi.advanceTimersByTimeAsync(0)` wrapped in `act()` to manually flush pending microtasks
- **Files modified:** packages/web/src/hooks/__tests__/use-test-run-polling.test.ts
- **Verification:** All 10 hook tests pass in < 50ms total
- **Committed in:** f03dc76 (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 bugs)
**Impact on plan:** All auto-fixes necessary for tests to pass. No scope creep.

## Issues Encountered
- Pre-existing test failures in core package (simplifier.test.ts, healer.test.ts) appear intermittently when tests run in randomized order due to vi.mock() leakage between test files. Tests pass individually and with stable ordering. This is not caused by plan 10-03 changes.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 10 (Quality and Coverage) is fully complete: test infrastructure, core/worker unit tests, UI/integration tests, and coverage thresholds
- 291 tests across 24 test files, all passing
- Coverage thresholds prevent regression: any code deletion or breakage that drops coverage below thresholds will fail CI
- No blockers for any future work

---
*Phase: 10-quality-and-coverage*
*Completed: 2026-03-07*
