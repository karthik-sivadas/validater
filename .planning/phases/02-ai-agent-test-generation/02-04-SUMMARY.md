---
phase: 02-ai-agent-test-generation
plan: 04
subsystem: api
tags: [playwright, locators, selectors, self-healing, validation, ai-sdk, structured-output]

# Dependency graph
requires:
  - phase: 02-ai-agent-test-generation
    provides: TestStep/LocatorStrategy types, ValidationResult/LocatorVerification types, Zod schemas, AI client (generateObject), buildValidationPrompt, Playwright dependency
affects: [02-05-integration]
provides:
  - verifyLocator function mapping 7 locator types to Playwright Page methods
  - verifyStepLocators for batch validation of all locators in a test step
  - healLocator with 2-tier strategy (free alternatives, then AI healing)
  - healStepLocators for batch self-healing across multiple steps

# Tech tracking
tech-stack:
  added: []
  patterns: [cheapest-first healing strategy (alternatives before AI), type-only Playwright imports for zero runtime dependency]

key-files:
  created:
    - packages/core/src/locators/validator.ts
    - packages/core/src/locators/healer.ts
    - packages/core/src/locators/index.ts
  modified:
    - packages/core/src/index.ts

key-decisions:
  - "verifyLocator wraps .count() in try/catch -- invalid selectors return found: false instead of throwing"
  - "healLocator tries unique+found alternatives first, then any found, then AI healing as last resort"
  - "healStepLocators returns new array (no mutation) -- downstream consumers decide what to do with unhealed steps"
  - "AI healing uses buildValidationPrompt (co-located in ai/prompts/templates.ts) + generateObject with HealingResponseSchema"
  - "Role locator parsing supports 'roleName' and 'roleName: accessible name' formats"

patterns-established:
  - "Cheapest-first healing: try existing alternatives (free), then AI-generated locators (expensive API call)"
  - "Defensive locator verification: all selector operations wrapped in try/catch, no throws on invalid selectors"
  - "Non-mutating step updates: healStepLocators returns new array, original steps preserved"

# Metrics
duration: 2min
completed: 2026-03-06
---

# Phase 2 Plan 4: Selector Validation and Self-Healing Summary

**Locator validator mapping 7 Playwright selector types with 2-tier self-healing (free alternative fallback, then Claude-powered locator regeneration)**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-06T17:32:55Z
- **Completed:** 2026-03-06T17:35:02Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Built verifyLocator that maps all 7 locator types (role, text, label, placeholder, testId, css, xpath) to Playwright Page methods with error-safe .count() checking
- Created verifyStepLocators for batch validation of all locators in a test step with primary/overall validity reporting
- Implemented 2-tier healLocator: tries working alternatives first (zero cost), falls back to Claude-generated alternatives only when all locators fail
- healStepLocators batch-processes step arrays, updating primaryLocatorIndex or adding AI-healed locators
- Full monorepo typecheck passes (all 4 packages, 6 tasks)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create selector validator** - `6930f59` (feat)
2. **Task 2: Create self-healing locator system and barrel exports** - `ccc0ce9` (feat)

## Files Created/Modified
- `packages/core/src/locators/validator.ts` - verifyLocator (7 locator types to Playwright methods) and verifyStepLocators (batch validation)
- `packages/core/src/locators/healer.ts` - healLocator (2-tier: alternatives then AI) and healStepLocators (batch healing)
- `packages/core/src/locators/index.ts` - Barrel re-exports for all locator functions
- `packages/core/src/index.ts` - Added locators/index.js re-export

## Decisions Made
- verifyLocator wraps Playwright `.count()` in try/catch so invalid selectors (malformed CSS, bad XPath) return `found: false` instead of throwing -- callers don't need error handling
- healLocator implements cheapest-first strategy: unique+found alternatives > any found alternatives > AI healing -- most healing happens via existing alternatives (free), AI is last resort
- Role locator parsing supports both "button" and "button: Submit" formats (split on first colon for accessible name)
- healStepLocators returns a new array without mutating originals -- downstream consumers (pipeline, UI) decide what to do with unhealed steps
- AI healing schema (HealingResponseSchema) is a simple `{ locators: LocatorStrategy[] }` wrapper -- minimal schema for focused response
- healWithAI fetches fresh DOM+ARIA snapshot from the live page before asking Claude, ensuring locator suggestions are grounded in current state

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. ANTHROPIC_API_KEY environment variable needed at runtime for AI healing but not for compilation.

## Next Phase Readiness
- Locator validation and self-healing ready for 02-05 (integration pipeline)
- `import { verifyLocator, verifyStepLocators, healLocator, healStepLocators } from '@validater/core'` works
- All functions accept Playwright Page (type-only) -- worker provides the actual Page at runtime
- Healing pipeline: verifyStepLocators (check) -> healStepLocators (fix) is the expected call pattern

---
*Phase: 02-ai-agent-test-generation*
*Completed: 2026-03-06*
