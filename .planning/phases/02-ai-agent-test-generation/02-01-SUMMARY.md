---
phase: 02-ai-agent-test-generation
plan: 01
subsystem: api
tags: [zod, ai-sdk, playwright, cheerio, typescript, types, schemas]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: monorepo structure, core/worker packages, TypeScript config
provides:
  - Shared TypeScript types for DOM crawling, test steps, locators, generation pipeline
  - Zod schemas for AI SDK generateObject structured output
  - Phase 2 dependencies (ai, @ai-sdk/anthropic, cheerio, p-queue, nanoid, playwright)
affects: [02-02-dom-crawler, 02-03-ai-generation, 02-04-validation, 02-05-integration]

# Tech tracking
tech-stack:
  added: [ai@6.0.116, @ai-sdk/anthropic@3.0.58, cheerio@1.2.0, p-queue@9.1.0, nanoid@5.1.6, playwright@1.58.2]
  patterns: [type-first design with Zod schema mirrors, RawTestStep pattern for AI output + post-generation ID assignment]

key-files:
  created:
    - packages/core/src/types/dom.ts
    - packages/core/src/types/test-step.ts
    - packages/core/src/types/generation.ts
    - packages/core/src/schemas/locator.ts
    - packages/core/src/schemas/dom-element.ts
    - packages/core/src/schemas/test-step.ts
  modified:
    - packages/core/src/types/index.ts
    - packages/core/src/schemas/index.ts
    - packages/core/package.json
    - packages/worker/package.json
    - pnpm-lock.yaml

key-decisions:
  - "Playwright as devDependency in core (type-only) and runtime dependency in worker"
  - "RawTestStep = Omit<TestStep, 'id'> -- AI generates without IDs, nanoid assigned post-generation"
  - "SemanticElementSchema uses z.lazy() for recursive children"
  - "TestStepSchema locators require min(2) for fallback reliability"

patterns-established:
  - "Type-first design: define TypeScript interfaces, then mirror with Zod schemas"
  - "Barrel re-exports: types/index.ts and schemas/index.ts aggregate all exports"
  - "AI output pattern: schemas omit system-generated fields (id), added post-generation"

# Metrics
duration: 3min
completed: 2026-03-06
---

# Phase 2 Plan 1: Types and Schemas Summary

**19 shared TypeScript types and 5 Zod schemas for the AI test generation pipeline with ai-sdk, cheerio, and playwright dependencies**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-06T17:18:23Z
- **Completed:** 2026-03-06T17:21:09Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments
- Installed all Phase 2 dependencies across core and worker packages (ai, @ai-sdk/anthropic, cheerio, p-queue, nanoid, playwright)
- Defined 19+ TypeScript types covering DOM crawling, test step generation, locator strategies, and token/cost tracking
- Created 5 Zod schemas for AI SDK generateObject structured output with descriptions for LLM guidance
- Full monorepo typecheck passes across all 4 packages

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies** - `3681a8f` (chore)
2. **Task 2: Create shared types** - `35cb76f` (feat)
3. **Task 3: Create Zod schemas** - `dddced8` (feat)

## Files Created/Modified
- `packages/core/src/types/dom.ts` - CrawlOptions, CrawlResult, SimplifiedDom, SemanticElement, InteractiveElement, PageContext
- `packages/core/src/types/test-step.ts` - TestStep, RawTestStep, LocatorStrategy, LocatorType, TestStepAction, AssertionType
- `packages/core/src/types/generation.ts` - GenerationRequest, GenerationResult, ValidationResult, TokenUsage, CostEstimate
- `packages/core/src/types/index.ts` - Barrel re-exports for all type files
- `packages/core/src/schemas/locator.ts` - LocatorStrategySchema with confidence and reasoning descriptions
- `packages/core/src/schemas/dom-element.ts` - SemanticElementSchema (recursive via z.lazy), InteractiveElementSchema
- `packages/core/src/schemas/test-step.ts` - TestStepSchema, TestGenerationSchema for AI structured output
- `packages/core/src/schemas/index.ts` - Barrel re-exports for all schema files
- `packages/core/package.json` - Added ai, @ai-sdk/anthropic, cheerio, p-queue, nanoid; playwright as devDep
- `packages/worker/package.json` - Added playwright as runtime dependency
- `pnpm-lock.yaml` - Updated lockfile

## Decisions Made
- Playwright installed as devDependency in core (type-only imports for `import type { Page }`) and runtime dependency in worker (actual browser automation)
- RawTestStep type alias uses `Omit<TestStep, 'id'>` because the AI generates steps without IDs; nanoid assigns IDs post-generation
- SemanticElementSchema uses `z.lazy()` for recursive children property (DOM tree structure)
- TestStepTargetSchema requires minimum 2 locators (`.min(2)`) to ensure fallback strategies for resilient element targeting
- Zod schema field descriptions added as `.describe()` calls to guide LLM structured output generation

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All types and schemas are ready for import in plans 02-02 through 02-05
- `import { TestStep, CrawlResult, GenerationResult } from '@validater/core'` works
- `import { TestStepSchema, TestGenerationSchema } from '@validater/core/schemas'` works
- Dependencies (ai, cheerio, playwright) are installed and verified importable in ESM context

---
*Phase: 02-ai-agent-test-generation*
*Completed: 2026-03-06*
