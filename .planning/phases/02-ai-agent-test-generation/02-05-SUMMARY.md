---
phase: 02-ai-agent-test-generation
plan: 05
subsystem: api
tags: [pipeline, orchestration, temporal, activities, server-function, tanstack-start, playwright, integration]

# Dependency graph
requires:
  - phase: 02-ai-agent-test-generation
    provides: DOM crawler/simplifier (02-02), AI client/generation (02-03), locator validation/self-healing (02-04), types/schemas (02-01)
provides:
  - End-to-end generation pipeline orchestrator (generateAndValidateTestSteps)
  - Three Temporal activities (crawlDom, generateSteps, validateSteps) for Phase 4 workflow composition
  - User-facing server function (generateTest) for URL + description input
affects: [03-browser-management, 04-temporal-workflows, 05-test-generation-ui]

# Tech tracking
tech-stack:
  added: []
  patterns: [pipeline orchestrator with dependency injection (Page object), Temporal activity wrappers with browser lifecycle management, TanStack Start server function with dynamic imports]

key-files:
  created:
    - packages/core/src/generation/pipeline.ts
    - packages/core/src/generation/index.ts
    - packages/worker/src/activities/crawl-dom.activity.ts
    - packages/worker/src/activities/generate-steps.activity.ts
    - packages/worker/src/activities/validate-steps.activity.ts
    - packages/web/src/server/generate-test.ts
  modified:
    - packages/core/src/index.ts
    - packages/core/src/types/dom.ts
    - packages/core/src/dom/simplifier.ts
    - packages/core/src/dom/extractor.ts
    - packages/web/package.json
    - packages/worker/package.json
    - pnpm-lock.yaml

key-decisions:
  - "Pipeline accepts Page via dependency injection -- caller manages browser lifecycle"
  - "Added html field to SimplifiedDom type for pipeline data flow (simplifyDom returns simplified HTML string)"
  - "Server function uses inputValidator (not validator) -- TanStack Start v1.166.2 API"
  - "Server function uses dynamic imports for playwright and @validater/core to avoid client bundling"
  - "Playwright added as runtime dependency in @validater/web for server-side browser automation"
  - "Server function placed in src/server/ (not app/server/) to match existing web package structure"

patterns-established:
  - "Pipeline orchestrator: composes multiple modules (crawl, simplify, generate, validate, heal) into single end-to-end function"
  - "Temporal activity pattern: wrap core functions + browser lifecycle in simple launch/try/finally/close"
  - "Server function pattern: createServerFn with inputValidator for Zod schema validation + dynamic imports for server-only deps"

# Metrics
duration: 5min
completed: 2026-03-06
---

# Phase 2 Plan 5: Generation Pipeline Integration Summary

**End-to-end pipeline orchestrator wiring crawl, simplify, AI generate, validate, and self-heal stages with Temporal activities and TanStack Start server function for URL + description input**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-06T17:37:31Z
- **Completed:** 2026-03-06T17:42:45Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments
- Built generateAndValidateTestSteps pipeline orchestrator composing all Phase 2 modules into a single end-to-end flow: crawl -> simplify -> AI generate -> assign IDs -> validate locators -> self-heal -> return with cost tracking
- Created three Temporal activities (crawlDom, generateSteps, validateSteps) with browser lifecycle management ready for Phase 4 workflow composition
- Implemented generateTest server function using TanStack Start createServerFn with Zod input validation and dynamic imports for server-only dependencies
- Full monorepo typecheck passes across all 4 packages (6 tasks)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create generation pipeline orchestrator** - `f5cab0a` (feat)
2. **Task 2: Create Temporal activities and user-facing server function** - `4114a40` (feat)

## Files Created/Modified
- `packages/core/src/generation/pipeline.ts` - generateAndValidateTestSteps: full pipeline orchestrator accepting Page via DI
- `packages/core/src/generation/index.ts` - Barrel re-export for generation module
- `packages/core/src/index.ts` - Added generation/index.js re-export
- `packages/core/src/types/dom.ts` - Added html field to SimplifiedDom interface
- `packages/core/src/dom/simplifier.ts` - Updated simplifyDom to return simplified HTML string
- `packages/core/src/dom/extractor.ts` - Fixed unused parameter (pre-existing TS6133)
- `packages/worker/src/activities/crawl-dom.activity.ts` - Temporal activity wrapping crawlPage + simplifyDom with browser lifecycle
- `packages/worker/src/activities/generate-steps.activity.ts` - Temporal activity wrapping generateTestSteps with rate limiting + ID assignment
- `packages/worker/src/activities/validate-steps.activity.ts` - Temporal activity wrapping verifyStepLocators + healStepLocators with browser lifecycle
- `packages/web/src/server/generate-test.ts` - TanStack Start server function with Zod input validation
- `packages/web/package.json` - Added playwright as runtime dependency
- `packages/worker/package.json` - Added nanoid as direct dependency
- `pnpm-lock.yaml` - Updated lockfile

## Decisions Made
- Pipeline uses dependency injection: accepts Playwright Page object rather than creating its own browser. The caller (server function or activity) manages the browser lifecycle. This follows the established pattern from 02-02 where crawlPage accepts Page, not Browser.
- Added `html` field to `SimplifiedDom` type and updated `simplifyDom` to return the simplified HTML string. This was needed because `generateTestSteps` requires `simplifiedDomHtml: string` but the original type only returned structured data (elements, interactiveElements).
- Used `inputValidator` instead of `validator` for TanStack Start server function -- v1.166.2 API uses `inputValidator` method name on ServerFnBuilder.
- Server function placed in `packages/web/src/server/` (not `app/server/` as plan specified) to match existing project structure where all web source is under `src/`.
- Playwright added as runtime dependency in web package (not just devDependency) because the server function dynamically imports it at runtime for browser automation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added html field to SimplifiedDom type**
- **Found during:** Task 1 (pipeline orchestrator)
- **Issue:** generateTestSteps requires `simplifiedDomHtml: string` but SimplifiedDom type had no html field -- simplifyDom returned structured data but not the simplified HTML string
- **Fix:** Added `html: string` to SimplifiedDom interface; updated simplifyDom to include `$.html()` in return
- **Files modified:** packages/core/src/types/dom.ts, packages/core/src/dom/simplifier.ts
- **Verification:** pnpm turbo typecheck passes (6/6 tasks)
- **Committed in:** f5cab0a (Task 1 commit)

**2. [Rule 1 - Bug] Fixed TanStack Start API method name**
- **Found during:** Task 2 (server function)
- **Issue:** Plan specified `.validator()` but TanStack Start v1.166.2 ServerFnBuilder uses `.inputValidator()` method
- **Fix:** Changed `.validator(GenerateTestInputSchema)` to `.inputValidator(GenerateTestInputSchema)`
- **Files modified:** packages/web/src/server/generate-test.ts
- **Verification:** pnpm --filter @validater/web typecheck passes
- **Committed in:** 4114a40 (Task 2 commit)

**3. [Rule 3 - Blocking] Added nanoid dependency to worker package**
- **Found during:** Task 2 (generate-steps activity)
- **Issue:** generate-steps.activity.ts imports nanoid directly but worker package.json didn't list it
- **Fix:** Added `"nanoid": "^5.1.6"` to worker dependencies
- **Files modified:** packages/worker/package.json, pnpm-lock.yaml
- **Verification:** pnpm --filter @validater/worker typecheck passes
- **Committed in:** 4114a40 (Task 2 commit)

**4. [Rule 3 - Blocking] Corrected server function path to match project structure**
- **Found during:** Task 2 (server function)
- **Issue:** Plan specified `packages/web/app/server/generate-test.ts` but web package uses `src/` directory structure (no `app/` directory exists)
- **Fix:** Created file at `packages/web/src/server/generate-test.ts` instead
- **Files modified:** packages/web/src/server/generate-test.ts
- **Verification:** File created in correct location, typecheck passes
- **Committed in:** 4114a40 (Task 2 commit)

**5. [Rule 1 - Bug] Fixed unused parameter in extractor.ts**
- **Found during:** Task 2 (web typecheck)
- **Issue:** Pre-existing TS6133 error: `$` parameter in generateXPath declared but never read (surfaced when web typechecks through core)
- **Fix:** Renamed `$` to `_$` to indicate intentionally unused
- **Files modified:** packages/core/src/dom/extractor.ts
- **Verification:** pnpm turbo typecheck passes
- **Committed in:** 4114a40 (Task 2 commit)

---

**Total deviations:** 5 auto-fixed (2 bugs, 3 blocking)
**Impact on plan:** All fixes necessary for correct compilation and data flow. No scope creep.

## Issues Encountered

None beyond the auto-fixed deviations above.

## User Setup Required

None - no external service configuration required. ANTHROPIC_API_KEY environment variable will be needed at runtime but is not required for compilation.

## Next Phase Readiness
- Phase 2 is now complete: all 5 plans delivered types, DOM pipeline, AI generation, locator validation, and end-to-end integration
- Success Criterion #1 satisfiable: generateTest server function accepts URL + description and returns validated test steps
- Three Temporal activities ready for Phase 4 workflow composition: crawlDom, generateSteps, validateSteps
- All functions exported from @validater/core: `import { generateAndValidateTestSteps } from '@validater/core'`
- Phase 3 (Browser Management) can build browser pooling to replace simple launch/close in activities
- Phase 5 (Test Generation UI) can build form around generateTest server function

---
*Phase: 02-ai-agent-test-generation*
*Completed: 2026-03-06*
