---
phase: 09-test-suite-generation-and-accessibility
plan: 02
subsystem: ai
tags: [ai-sdk, zod, generateObject, suite-generation, structured-output, openrouter]

# Dependency graph
requires:
  - phase: 02-ai-agent-test-generation
    provides: "generateTestSteps pattern, AI client, system prompt architecture"
provides:
  - "TestSuiteSpec and TestCaseSpec types for suite generation output"
  - "TestSuiteSpecSchema Zod schema with min(4)/max(8) constraint"
  - "SUITE_GENERATION_SYSTEM_PROMPT with category/priority/dedup guidelines"
  - "buildSuiteUserPrompt with DOM/ARIA truncation"
  - "generateSuiteSpecs function using AI SDK generateObject"
affects:
  - 09-03 (worker activities will call generateSuiteSpecs)
  - 09-04 (frontend will display suite generation results)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-stage suite generation: Stage 1 produces test case specs, Stage 2 reuses existing generateTestSteps"
    - "DOM/ARIA truncation in user prompt builder to prevent token budget explosion"

key-files:
  created:
    - packages/core/src/types/test-suite.ts
    - packages/core/src/schemas/test-suite.ts
    - packages/core/src/ai/prompts/suite-generation.ts
  modified:
    - packages/core/src/ai/client.ts
    - packages/core/src/ai/index.ts
    - packages/core/src/types/index.ts
    - packages/core/src/schemas/index.ts

key-decisions:
  - "System prompt enforces 4 categories (happy_path, edge_case, error_state, boundary) with at least one happy_path and one error_state required"
  - "Zod schema min(4).max(8) constrains AI output to 4-8 test cases"
  - "DOM truncated at 30K chars, ARIA at 15K chars in user prompt to avoid token budget issues"
  - "generateSuiteSpecs follows identical pattern to generateTestSteps: same provider detection, cache control, usage tracking"

patterns-established:
  - "Suite generation prompt pattern: system prompt defines categories/guidelines, user prompt provides feature + page context"
  - "buildSuiteUserPrompt with truncation: same approach usable for any future AI prompt needing page context"

# Metrics
duration: 3min
completed: 2026-03-07
---

# Phase 9 Plan 2: Core AI Suite Generation Summary

**Types, Zod schemas, system prompt, and generateSuiteSpecs function for producing 4-8 categorized test cases from feature descriptions via AI SDK generateObject**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-07T05:26:39Z
- **Completed:** 2026-03-07T05:29:45Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Created TestCaseSpec and TestSuiteSpec types with category (happy_path/edge_case/error_state/boundary) and priority (critical/high/medium/low) enums
- Built TestSuiteSpecSchema with min(4)/max(8) array constraint for structured AI output validation
- Wrote comprehensive SUITE_GENERATION_SYSTEM_PROMPT (~4K+ chars for Anthropic cache eligibility) with category definitions, coverage requirements, description quality guidelines, and deduplication rules
- Implemented generateSuiteSpecs function following the exact same pattern as generateTestSteps (provider detection, Anthropic cache control, usage tracking)
- All exports reachable through the barrel chain: @validater/core -> ai/index -> client.ts, schemas/index -> test-suite.ts, types/index -> test-suite.ts

## Task Commits

Each task was committed atomically:

1. **Task 1: Create test suite types and Zod schemas** - `6a496cf` (feat)
2. **Task 2: Create suite generation AI prompt and generateSuiteSpecs function** - `1a638a5` (feat)

## Files Created/Modified
- `packages/core/src/types/test-suite.ts` - TestCaseSpec, TestSuiteSpec interfaces with category/priority type unions
- `packages/core/src/schemas/test-suite.ts` - TestCaseSpecSchema, TestSuiteSpecSchema Zod schemas with describe() annotations for AI
- `packages/core/src/ai/prompts/suite-generation.ts` - System prompt + buildSuiteUserPrompt with DOM/ARIA truncation
- `packages/core/src/ai/client.ts` - Added generateSuiteSpecs function
- `packages/core/src/ai/index.ts` - Barrel exports for generateSuiteSpecs, SUITE_GENERATION_SYSTEM_PROMPT, buildSuiteUserPrompt
- `packages/core/src/types/index.ts` - Added test-suite.js barrel export
- `packages/core/src/schemas/index.ts` - Added test-suite.js barrel export

## Decisions Made
- System prompt enforces all four test case categories with mandatory happy_path + error_state representation
- Zod schema min(4).max(8) constraint ensures reasonable suite size without over-generating
- DOM truncated at 30,000 characters and ARIA at 15,000 characters to prevent token budget explosion on complex pages
- Followed identical generateObject pattern from generateTestSteps for consistency: same provider detection, same Anthropic cacheControl, same TokenUsage extraction

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- generateSuiteSpecs is ready for use in Temporal worker activities (plan 09-03)
- Each TestCaseSpec.description feeds directly into the existing generateTestSteps pipeline
- All types and schemas are exported from @validater/core for use by worker and web packages

---
*Phase: 09-test-suite-generation-and-accessibility*
*Completed: 2026-03-07*
