---
phase: 02-ai-agent-test-generation
plan: 03
subsystem: api
tags: [ai-sdk, anthropic, claude, structured-output, rate-limiting, prompt-caching, cost-tracking]

# Dependency graph
requires:
  - phase: 02-ai-agent-test-generation
    provides: Zod schemas (TestGenerationSchema), TypeScript types (RawTestStep, TokenUsage, CostEstimate), ai SDK dependency
affects: [02-04-validation, 02-05-integration]

provides:
  - AI client factory with Anthropic provider (createAIClient)
  - generateTestSteps function with structured output via AI SDK generateObject
  - System prompt with locator strategy guidelines, confidence scoring, and 3 in-context examples
  - User prompt templates (buildUserPrompt, buildValidationPrompt)
  - Rate-limited API queue with p-queue (createApiQueue, queuedRequest, defaultApiQueue)
  - Cost tracker with per-model pricing (calculateCost, CostTracker)

# Tech tracking
tech-stack:
  added: []
  patterns: [AI SDK generateObject with Zod schema for guaranteed structured output, prompt caching via ephemeral cacheControl, rate-limited singleton queue pattern]

key-files:
  created:
    - packages/core/src/ai/client.ts
    - packages/core/src/ai/prompts/system.ts
    - packages/core/src/ai/prompts/templates.ts
    - packages/core/src/ai/rate-limiter.ts
    - packages/core/src/ai/cost-tracker.ts
    - packages/core/src/ai/index.ts
  modified:
    - packages/core/src/index.ts

key-decisions:
  - "AI SDK generateObject (not generateText + Output.object) for direct Zod schema structured output"
  - "System prompt ~16K chars (~4K tokens) exceeds 1024-token Anthropic cache threshold"
  - "LanguageModel return type annotation on createAIClient to avoid non-portable type inference"
  - "Token usage mapped from AI SDK's LanguageModelUsage (inputTokens/outputTokens + inputTokenDetails) to our TokenUsage type"
  - "Rate limiter defaults: concurrency 5, intervalCap 40, interval 60s (conservative Tier 1)"
  - "Singleton defaultApiQueue ensures all API calls share rate limits application-wide"

patterns-established:
  - "AI client pattern: factory function returns LanguageModel, generation function wraps generateObject with schema"
  - "Prompt caching: system prompt as separate parameter with providerOptions.anthropic.cacheControl"
  - "Rate limiting: singleton p-queue with configurable concurrency and interval caps"
  - "Cost tracking: in-memory CostTracker with per-model pricing and summary aggregation"

# Metrics
duration: 6min
completed: 2026-03-06
---

# Phase 2 Plan 3: AI Client Integration Summary

**Claude API client with AI SDK structured output, 4K-token cached system prompt, p-queue rate limiter, and per-model cost tracking**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-06T17:23:16Z
- **Completed:** 2026-03-06T17:29:29Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Built AI client using AI SDK's generateObject with Zod schema for guaranteed structured output (RawTestStep[])
- Created 16K-char system prompt (~4K tokens) with locator strategy guidelines, confidence scoring, and 3 in-context examples for Anthropic prompt caching
- Implemented rate-limited API queue with p-queue (5 concurrent, 40/minute) and singleton pattern
- Added cost tracker with Sonnet 4.5 and Haiku 3.5 pricing including cache read/write cost breakdown

## Task Commits

Each task was committed atomically:

1. **Task 1: AI client with structured output and prompt caching** - `b48027f` (feat)
2. **Task 2: Rate limiter, cost tracker, and barrel re-exports** - `5d7f54e` (feat)

## Files Created/Modified
- `packages/core/src/ai/client.ts` - createAIClient factory and generateTestSteps with AI SDK generateObject
- `packages/core/src/ai/prompts/system.ts` - SYSTEM_PROMPT constant (16K chars, cache-eligible)
- `packages/core/src/ai/prompts/templates.ts` - buildUserPrompt and buildValidationPrompt template builders
- `packages/core/src/ai/rate-limiter.ts` - createApiQueue, queuedRequest, defaultApiQueue singleton
- `packages/core/src/ai/cost-tracker.ts` - calculateCost and CostTracker class with per-model pricing
- `packages/core/src/ai/index.ts` - Barrel re-exports for all AI module exports
- `packages/core/src/index.ts` - Added ai/index.js re-export

## Decisions Made
- Used AI SDK's `generateObject` with `schema` parameter (not `Output.object()` which is for `generateText`) for direct Zod schema structured output
- Added explicit `LanguageModel` return type annotation on `createAIClient` to avoid TS2742 non-portable type inference error from `@ai-sdk/provider`
- Mapped AI SDK's `LanguageModelUsage` fields (`inputTokens`, `outputTokens`, `inputTokenDetails.cacheWriteTokens`, `inputTokenDetails.cacheReadTokens`) to our `TokenUsage` type
- Removed `throwOnTimeout` from `queue.add()` options -- not available in p-queue v9.1.0's `QueueAddOptions`
- System prompt includes 3 comprehensive examples (login form, adding item to list, dropdown navigation) to both improve in-context learning and ensure the prompt exceeds the 1024-token cache threshold

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed AI SDK API usage for generateObject**
- **Found during:** Task 1 (AI client creation)
- **Issue:** Plan specified `output: Output.object({ schema })` but AI SDK v6 expects `schema` directly on `generateObject` options (Output.object is for generateText)
- **Fix:** Changed to `schema: TestGenerationSchema` directly; mapped usage fields from `inputTokens`/`outputTokens` (not `promptTokens`/`completionTokens`)
- **Files modified:** `packages/core/src/ai/client.ts`
- **Verification:** `pnpm --filter @validater/core typecheck` passes with 0 errors
- **Committed in:** b48027f (Task 1 commit)

**2. [Rule 3 - Blocking] Added LanguageModel return type annotation**
- **Found during:** Task 1 (AI client creation)
- **Issue:** TypeScript TS2742 error -- inferred return type requires reference to non-portable `@ai-sdk/provider` internal module
- **Fix:** Added explicit `LanguageModel` return type from `ai` package to `createAIClient`
- **Files modified:** `packages/core/src/ai/client.ts`
- **Verification:** Typecheck passes
- **Committed in:** b48027f (Task 1 commit)

**3. [Rule 1 - Bug] Removed throwOnTimeout from queue.add() options**
- **Found during:** Task 2 (rate limiter creation)
- **Issue:** `throwOnTimeout` does not exist in p-queue v9.1.0's `QueueAddOptions` type
- **Fix:** Removed the option; p-queue v9 handles timeouts via separate `timeout` option on queue construction
- **Files modified:** `packages/core/src/ai/rate-limiter.ts`
- **Verification:** Typecheck passes
- **Committed in:** 5d7f54e (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 blocking)
**Impact on plan:** All fixes necessary for TypeScript compilation. No scope creep.

## Issues Encountered

None beyond the auto-fixed deviations above.

## User Setup Required

None - no external service configuration required. ANTHROPIC_API_KEY environment variable will be needed at runtime but is not required for compilation.

## Next Phase Readiness
- AI client and generation function ready for use in 02-04 (validation/self-healing) and 02-05 (integration pipeline)
- `import { generateTestSteps, createApiQueue, calculateCost, CostTracker } from '@validater/core'` works
- buildValidationPrompt already defined for self-healing use in 02-04
- Full monorepo typecheck passes (all 4 packages)

---
*Phase: 02-ai-agent-test-generation*
*Completed: 2026-03-06*
