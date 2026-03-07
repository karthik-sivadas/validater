---
phase: 10-quality-and-coverage
plan: 01
subsystem: testing
tags: [vitest, coverage, v8, monorepo, test-infrastructure]

# Dependency graph
requires:
  - phase: 01-foundation-and-infrastructure
    provides: monorepo structure with pnpm workspaces and Turborepo
provides:
  - Root vitest.config.ts with projects aggregation across core, worker, web
  - Per-package vitest configs (core: node, worker: node, web: jsdom)
  - Shared mock utilities (createMockPage, createMockLocator, createMockDb)
  - Unified coverage reporting via pnpm test:coverage with 50% global floor thresholds
  - Turbo test:coverage task with build dependency chain
affects: [10-quality-and-coverage plans 02 and 03]

# Tech tracking
tech-stack:
  added: ["@vitest/coverage-v8@3.2.4", "@testing-library/user-event", "@testing-library/jest-dom"]
  patterns: ["Vitest projects for monorepo test aggregation", "Shared __test-utils__ with factory mock functions", "v8 coverage with global floor thresholds"]

key-files:
  created:
    - vitest.config.ts
    - packages/core/vitest.config.ts
    - packages/worker/vitest.config.ts
    - packages/web/vitest.config.ts
    - packages/web/vitest-setup.ts
    - packages/core/src/__test-utils__/mock-page.ts
    - packages/core/src/__test-utils__/mock-db.ts
    - packages/core/src/__test-utils__/index.ts
  modified:
    - package.json
    - packages/core/package.json
    - packages/worker/package.json
    - packages/web/package.json
    - packages/web/vite.config.ts
    - turbo.json
    - .gitignore
    - pnpm-lock.yaml

key-decisions:
  - "Vitest 3.2.4 pinned across all packages (not 4.x) to match web package's existing vitest version"
  - "coverage.enabled: false in root config -- coverage only runs when --coverage flag is passed explicitly"
  - "50% global floor thresholds will cause exit code 1 until tests are written in plans 10-02 and 10-03"
  - "__test-utils__ subpath export on @validater/core for cross-package mock imports"

patterns-established:
  - "Pattern 1: Vitest projects aggregation via root test.projects array (replaces deprecated vitest.workspace.ts)"
  - "Pattern 2: Shared mock factories in core/__test-utils__/ with vi.fn() and as unknown as casts"
  - "Pattern 3: Per-package vitest.config.ts with defineProject for isolated config"

# Metrics
duration: 5min
completed: 2026-03-07
---

# Phase 10 Plan 01: Test Infrastructure Summary

**Vitest monorepo test infrastructure with projects aggregation, v8 coverage, shared mock factories, and 50% global floor thresholds**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-07T06:13:52Z
- **Completed:** 2026-03-07T06:18:24Z
- **Tasks:** 2
- **Files modified:** 18

## Accomplishments
- Unified test infrastructure across core, worker, and web packages via Vitest projects
- v8 coverage reporting with include/exclude patterns covering all source files except generated code, types, and Temporal workflows
- Shared mock factories (createMockPage, createMockLocator, createMockDb) ready for use by all test plans
- Turbo integration with test:coverage task for CI pipeline

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies and create per-package Vitest configs** - `29e9990` (chore)
2. **Task 2: Root Vitest projects config with coverage thresholds, shared test utilities, and Turbo integration** - `8740fdc` (feat)

## Files Created/Modified
- `vitest.config.ts` - Root Vitest config with projects, coverage thresholds, and include/exclude patterns
- `packages/core/vitest.config.ts` - Core package test config (node env, __tests__ pattern)
- `packages/worker/vitest.config.ts` - Worker package test config (node env, __tests__ pattern)
- `packages/web/vitest.config.ts` - Web package test config (jsdom env, __tests__ pattern, setup file)
- `packages/web/vitest-setup.ts` - Setup file importing @testing-library/jest-dom/vitest matchers
- `packages/web/vite.config.ts` - Removed test block (replaced by separate vitest.config.ts)
- `packages/core/src/__test-utils__/mock-page.ts` - createMockPage and createMockLocator factories
- `packages/core/src/__test-utils__/mock-db.ts` - createMockDb factory with chainable mock methods
- `packages/core/src/__test-utils__/index.ts` - Re-export barrel for test utilities
- `package.json` - Added test (vitest run) and test:coverage (vitest run --coverage) scripts
- `packages/core/package.json` - Added vitest/coverage-v8 devDeps, test script, __test-utils__ export
- `packages/worker/package.json` - Added vitest/coverage-v8 devDeps, test script
- `packages/web/package.json` - Added coverage-v8, user-event, jest-dom devDeps
- `turbo.json` - Added test:coverage task with ^build dependency and coverage outputs
- `.gitignore` - Added coverage/ directory

## Decisions Made
- Pinned vitest@3.2.4 and @vitest/coverage-v8@3.2.4 across all packages to match the web package's existing vitest version (4.x had peer dependency conflicts)
- Set `coverage.enabled: false` in root config so `pnpm test` runs fast without coverage overhead; coverage only activates when `--coverage` flag is explicitly passed
- 50% global floor thresholds are in place but will error until tests are written (plans 10-02 and 10-03) -- this is expected and correct behavior for threshold enforcement
- Changed root `test` script from `turbo test` to `vitest run` for direct Vitest invocation with projects aggregation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed @vitest/coverage-v8 version mismatch**
- **Found during:** Task 1 (dependency installation)
- **Issue:** `pnpm add -Dw @vitest/coverage-v8` installed 4.0.18 which has peer dependency on vitest 4.0.18, conflicting with web's vitest 3.2.4
- **Fix:** Explicitly pinned `@vitest/coverage-v8@^3.2.4` across all packages
- **Files modified:** package.json, pnpm-lock.yaml
- **Verification:** No peer dependency warnings for vitest
- **Committed in:** 29e9990 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed coverage running on every test invocation**
- **Found during:** Task 2 (root config creation)
- **Issue:** Setting `coverage.enabled: true` caused `pnpm test` (without --coverage flag) to run full coverage collection, slowing down test runs
- **Fix:** Changed to `coverage.enabled: false` so coverage only runs when `--coverage` flag is passed
- **Files modified:** vitest.config.ts
- **Verification:** `pnpm test` runs without coverage overhead; `pnpm test:coverage` produces full report
- **Committed in:** 8740fdc (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both auto-fixes necessary for correct operation. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Test infrastructure is ready for plans 10-02 (core/worker unit tests) and 10-03 (web tests + threshold tuning)
- Shared mock utilities are importable via `@validater/core/__test-utils__`
- Coverage thresholds will enforce minimums once tests achieve 50%+ coverage
- No blockers for next plans

---
*Phase: 10-quality-and-coverage*
*Completed: 2026-03-07*
