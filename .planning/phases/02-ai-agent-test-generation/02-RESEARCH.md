# Phase 2: AI Agent -- Test Generation - Research

**Researched:** 2026-03-06
**Domain:** AI-powered test step generation with DOM grounding, structured output, and self-healing locators
**Confidence:** HIGH

## Summary

Phase 2 builds the core AI engine that takes a URL and natural language test description, crawls the target page's DOM, feeds a semantically simplified representation to Claude, and produces structured test steps with multiple locator strategies and confidence scores. The phase spans four plans: DOM extraction pipeline, Claude API integration, test step generation, and self-healing validation.

The recommended approach uses the **Vercel AI SDK (`ai` + `@ai-sdk/anthropic`)** rather than the raw `@anthropic-ai/sdk`. The AI SDK provides `generateObject` with native Zod schema validation, built-in prompt caching support via `providerOptions`, streaming structured output, and a provider-agnostic abstraction that future-proofs against model changes. For DOM extraction, **Playwright** handles page loading and JavaScript rendering, while **Cheerio** parses and simplifies the raw HTML into a token-efficient representation for the LLM context window. The accessibility tree (via Playwright's `locator.ariaSnapshot()`) provides semantic element identification that maps directly to locator strategies.

The architecture follows a pipeline pattern: crawl (Playwright) -> simplify (Cheerio + custom DOM downsampling) -> generate (AI SDK + Claude) -> validate (Playwright selector verification) -> heal (retry with alternative locators). Each stage is a discrete function suitable for Temporal activity composition in Phase 4.

**Primary recommendation:** Use Vercel AI SDK with Anthropic provider for structured test step generation, Playwright for DOM crawling and selector verification, and Cheerio for DOM simplification. Build all pipeline stages as pure functions in `packages/core` that Temporal activities in `packages/worker` can wrap later.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `ai` | ^6.0.116 | AI SDK core -- `generateObject`, `streamText`, `Output` | Unified API for structured output, streaming, provider switching; 3700+ npm dependents |
| `@ai-sdk/anthropic` | ^3.0.58 | Anthropic provider for AI SDK | Direct API access with prompt caching via `providerOptions`, structured output modes |
| `playwright` | ^1.49.0 | DOM crawling, page rendering, selector verification | Industry standard for browser automation; ariaSnapshot, accessibility tree, all locator types |
| `cheerio` | ^1.0.0 | Server-side HTML parsing and DOM simplification | Fast jQuery-like API for stripping/transforming HTML; no browser overhead |
| `zod` | ^3.24.0 | Schema definitions for structured output | Already in project (`@validater/core`); native AI SDK integration via `zodOutputFormat` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `p-queue` | ^8.0.0 | Concurrency control with rate limiting | Queue Claude API calls with concurrency + interval-based rate limiting |
| `nanoid` | ^5.0.0 | Generate unique IDs for test steps and runs | Lightweight, URL-safe IDs for test step references |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| AI SDK (`ai`) | `@anthropic-ai/sdk` directly | Direct SDK gives lower-level control but requires manual structured output parsing, no built-in Zod integration, no provider abstraction. AI SDK adds ~50KB but saves significant implementation effort |
| Cheerio | `linkedom` or `happy-dom` | Full DOM implementations are heavier; Cheerio's jQuery API is sufficient for extraction/simplification |
| p-queue | Custom token bucket | p-queue already implements sliding window rate limiting with `intervalCap`; hand-rolling adds maintenance burden |
| Playwright for crawling | Puppeteer | Playwright has superior locator strategies, ariaSnapshot, and will be reused in Phase 3 for test execution |

**Installation:**
```bash
pnpm --filter @validater/core add ai @ai-sdk/anthropic cheerio p-queue nanoid
pnpm --filter @validater/core add -D @types/cheerio
```

Note: `playwright` is installed in `@validater/worker` (or a new `@validater/browser` package) since it requires browser binaries. The core package only needs the types for defining interfaces.

```bash
pnpm --filter @validater/worker add playwright
```

## Architecture Patterns

### Recommended Project Structure
```
packages/core/src/
  ai/
    client.ts           # AI SDK client factory (Anthropic provider config)
    prompts/
      system.ts         # System prompt for test generation (cached)
      templates.ts      # Prompt templates for different generation modes
    schemas/
      test-step.ts      # Zod schemas for generated test steps
      dom-element.ts    # Zod schemas for extracted DOM elements
      locator.ts        # Zod schemas for locator strategies
    cost-tracker.ts     # Token usage tracking and cost calculation
  dom/
    crawler.ts          # Playwright-based page crawling
    simplifier.ts       # DOM simplification for LLM context
    extractor.ts        # Semantic element extraction
    aria-snapshot.ts    # Accessibility tree extraction
  locators/
    strategies.ts       # Multiple locator strategy generation
    confidence.ts       # Confidence scoring for locators
    validator.ts        # Selector verification against live page
    healer.ts           # Self-healing retry with alternatives
  types/
    test-step.ts        # TestStep, LocatorStrategy, etc.
    dom.ts              # DomElement, SemanticInfo, etc.
    generation.ts       # GenerationRequest, GenerationResult

packages/core/src/schemas/
  test-steps.ts         # Zod schemas exported for AI SDK + DB

packages/worker/src/
  activities/
    crawl-dom.activity.ts       # Temporal activity: crawl page DOM
    generate-steps.activity.ts  # Temporal activity: generate test steps
    validate-steps.activity.ts  # Temporal activity: verify selectors
```

### Pattern 1: Pipeline Architecture
**What:** Each stage of test generation is a pure function that transforms input to output, composable into a pipeline
**When to use:** Always -- this is the core architectural pattern for Phase 2

```typescript
// Source: Architecture pattern for AI test generation pipeline

// Stage 1: Crawl
interface CrawlResult {
  html: string;
  ariaSnapshot: string;
  url: string;
  title: string;
  viewport: { width: number; height: number };
}

// Stage 2: Simplify
interface SimplifiedDom {
  elements: SemanticElement[];
  interactiveElements: InteractiveElement[];
  pageContext: PageContext;
  tokenEstimate: number;
}

// Stage 3: Generate
interface GenerationResult {
  steps: TestStep[];
  reasoning: string;
  usage: TokenUsage;
}

// Stage 4: Validate
interface ValidationResult {
  step: TestStep;
  primaryLocatorValid: boolean;
  alternativeLocatorsValid: boolean[];
  healedLocator?: LocatorStrategy;
}
```

### Pattern 2: Structured Output with Zod + AI SDK
**What:** Define test step schemas in Zod, use AI SDK's `generateObject` for guaranteed schema compliance
**When to use:** Every Claude API call that produces structured data

```typescript
// Source: Anthropic structured outputs docs + AI SDK docs
import { generateObject, Output } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';

const LocatorStrategySchema = z.object({
  type: z.enum(['role', 'text', 'label', 'placeholder', 'testId', 'css', 'xpath']),
  value: z.string(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

const TestStepSchema = z.object({
  order: z.number(),
  action: z.enum(['click', 'fill', 'select', 'check', 'navigate', 'assert', 'wait', 'hover']),
  description: z.string(),
  target: z.object({
    elementDescription: z.string(),
    locators: z.array(LocatorStrategySchema).min(1),
    primaryLocatorIndex: z.number(),
  }),
  value: z.string().optional(),
  assertion: z.object({
    type: z.enum(['visible', 'hidden', 'text', 'value', 'url', 'count', 'attribute']),
    expected: z.string(),
  }).optional(),
  reasoning: z.string(),
});

const TestGenerationSchema = z.object({
  steps: z.array(TestStepSchema),
  reasoning: z.string(),
});

const result = await generateObject({
  model: anthropic('claude-sonnet-4-5'),
  output: Output.object({ schema: TestGenerationSchema }),
  system: systemPrompt,  // cached via providerOptions
  prompt: userPromptWithDom,
  providerOptions: {
    anthropic: { cacheControl: { type: 'ephemeral' } },
  },
});
```

### Pattern 3: DOM Simplification for LLM Context
**What:** Strip raw HTML down to semantically meaningful elements that fit within token budget
**When to use:** Before every Claude API call that includes page DOM

```typescript
// Pattern: DOM downsampling for LLM context
import * as cheerio from 'cheerio';

function simplifyDom(html: string, maxTokenEstimate: number = 8000): SimplifiedDom {
  const $ = cheerio.load(html);

  // Remove non-semantic elements
  $('script, style, noscript, svg, path, meta, link, head').remove();
  $('[style]').removeAttr('style');
  $('[class]').each((_, el) => {
    // Keep only semantic class names, strip utility classes
    const classes = $(el).attr('class')?.split(/\s+/) || [];
    const semantic = classes.filter(c => !isUtilityClass(c));
    if (semantic.length) $(el).attr('class', semantic.join(' '));
    else $(el).removeAttr('class');
  });

  // Remove hidden elements
  $('[hidden], [aria-hidden="true"]').remove();

  // Collapse empty wrappers
  $('div:empty, span:empty').remove();

  // Extract interactive elements with full context
  const interactive = extractInteractiveElements($);

  return {
    elements: extractSemanticElements($),
    interactiveElements: interactive,
    pageContext: { title: $('title').text(), url: '' },
    tokenEstimate: estimateTokens($.html()),
  };
}
```

### Pattern 4: Multiple Locator Strategy Generation
**What:** For each target element, generate 3-6 locator strategies with confidence scores
**When to use:** Every test step that targets a DOM element

```typescript
// Pattern: Generate multiple locators from a semantic element
interface LocatorStrategy {
  type: 'role' | 'text' | 'label' | 'placeholder' | 'testId' | 'css' | 'xpath';
  value: string;
  confidence: number; // 0-1
  reasoning: string;
}

// Priority order matches Playwright best practices:
// 1. getByRole (highest confidence, accessibility-based)
// 2. getByText (visible text, user-facing)
// 3. getByLabel (form fields)
// 4. getByPlaceholder (form fields without labels)
// 5. getByTestId (data-testid attribute)
// 6. CSS selector (structural, lower confidence)
// 7. XPath (most brittle, lowest confidence)
```

### Pattern 5: Prompt Caching Strategy
**What:** Cache the system prompt (which includes instructions, examples, and schema documentation) across requests
**When to use:** All Claude API calls in the test generation pipeline

```typescript
// Source: Anthropic prompt caching docs
// System prompt is stable and large (>1024 tokens for Sonnet) -- ideal for caching
// DOM content changes per request -- goes in user message (not cached)

const systemPrompt = `You are a test generation agent...
[large instruction set with examples and guidelines]
[schema documentation]
[locator strategy guidelines]`; // 2000+ tokens, cached

// With AI SDK, cache control is automatic when set at top level
const result = await generateObject({
  model: anthropic('claude-sonnet-4-5'),
  output: Output.object({ schema: TestGenerationSchema }),
  system: systemPrompt,
  messages: [
    { role: 'user', content: `Page DOM:\n${simplifiedDom}\n\nTest description: ${description}` }
  ],
  providerOptions: {
    anthropic: { cacheControl: { type: 'ephemeral' } },
  },
});
// Cache hit: system prompt read from cache (0.1x cost)
// Only user message (DOM + description) counts as new input
```

### Anti-Patterns to Avoid
- **Sending raw HTML to Claude:** Raw page HTML can be 500K+ tokens. Always simplify first. Target 5-15K tokens for DOM context.
- **Single locator per element:** A single CSS selector breaks on any DOM change. Always generate 3+ locator strategies with confidence scores.
- **Hardcoding model names:** Use configuration/environment variables for model selection. Claude Sonnet 4.5 is the sweet spot for cost/quality, but needs to be switchable.
- **Synchronous sequential API calls:** Use p-queue for concurrent calls with rate limiting, not sequential await chains.
- **Embedding API key in code:** Use ANTHROPIC_API_KEY environment variable, loaded from monorepo root `.env`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Structured JSON output from LLM | Custom JSON parsing with regex/retries | AI SDK `generateObject` + Zod schemas | Guaranteed schema compliance, zero parse errors, type safety |
| Rate limiting for API calls | Custom token bucket implementation | `p-queue` with `interval` + `intervalCap` | Sliding window algorithm, priority queuing, pause/resume |
| HTML parsing and transformation | Custom regex-based HTML processing | Cheerio | jQuery-like API, handles malformed HTML, battle-tested |
| Accessibility tree extraction | Manual DOM traversal for ARIA roles | Playwright `locator.ariaSnapshot()` | Browser-native accessibility tree, complete ARIA attributes |
| Prompt caching | Manual cache key management | AI SDK `providerOptions.anthropic.cacheControl` | Automatic cache breakpoint management, transparent pricing |
| Token counting | Character-based estimation | `@anthropic-ai/tokenizer` or estimation formula (1 token ~ 4 chars) | Accurate cost tracking; for estimation, 4-char heuristic is sufficient |
| Unique ID generation | UUID or timestamp-based IDs | `nanoid` | URL-safe, shorter, collision-resistant, already performant |

**Key insight:** The AI SDK + Zod combination eliminates the entire class of "LLM output parsing" bugs. Every response is guaranteed to match the schema or throws a typed `NoObjectGeneratedError`. This removes the need for retry-and-parse loops that plague raw API integrations.

## Common Pitfalls

### Pitfall 1: DOM Context Exceeding Token Limits
**What goes wrong:** Sending full page HTML (100K-500K tokens) to Claude, exceeding context window or producing garbage output due to attention dilution
**Why it happens:** Modern web pages have deeply nested DOMs with framework-generated markup, inline styles, SVGs, and script tags
**How to avoid:** Implement a multi-stage DOM simplification pipeline: (1) strip scripts/styles/SVGs, (2) remove hidden elements, (3) collapse empty wrappers, (4) extract only interactive and semantic elements, (5) enforce a token budget (target 5-15K tokens). Use aria snapshot as a complementary lightweight representation.
**Warning signs:** Token usage above 30K for page context in API responses; `cache_creation_input_tokens` values that are very large

### Pitfall 2: Hallucinated Selectors
**What goes wrong:** Claude generates CSS selectors or XPath expressions that look plausible but don't match any element on the actual page
**Why it happens:** LLMs generate text probabilistically; even with DOM context, they can hallucinate class names, IDs, or element structures
**How to avoid:** Every generated locator MUST be verified against the live page using Playwright before being returned to the user. The validation step (Plan 02-04) is not optional -- it's the core differentiator. Include the aria snapshot in the prompt to ground Claude in actual page structure.
**Warning signs:** Validation pass rate below 80%; locators containing generic class names like `.container`, `.wrapper`, `.btn`

### Pitfall 3: Prompt Caching Minimum Token Thresholds
**What goes wrong:** Cache misses on every request, no cost savings
**Why it happens:** Claude Sonnet 4.5/4 requires a minimum of 1024 tokens for cache eligibility; Sonnet 4.6 requires 2048 tokens. System prompts shorter than this threshold will never be cached.
**How to avoid:** Ensure the system prompt exceeds the minimum threshold for the target model. For Sonnet 4.5, the system prompt must be >1024 tokens. Include detailed instructions, examples, and schema documentation in the system prompt to naturally exceed this.
**Warning signs:** `cache_read_input_tokens` is always 0 in API responses; `cache_creation_input_tokens` appears on every request

### Pitfall 4: Rate Limit Cascading Failures
**What goes wrong:** Multiple concurrent test generation requests exhaust API rate limits, causing 429 errors that cascade across the system
**Why it happens:** Tier 1 limits are 50 RPM; even Tier 2 is 1000 RPM. Multiple users generating tests simultaneously can quickly hit limits.
**How to avoid:** Implement a centralized request queue using p-queue with `concurrency` (max parallel requests) and `interval`/`intervalCap` (max requests per time window). Read rate limit headers (`anthropic-ratelimit-requests-remaining`) to dynamically adjust concurrency. Implement exponential backoff with jitter on 429 errors.
**Warning signs:** Repeated 429 errors in logs; increasing latency on API calls

### Pitfall 5: Cached Tokens Do NOT Count Toward ITPM Rate Limits
**What goes wrong:** Developers over-throttle requests because they count total input tokens (including cached) against rate limits
**Why it happens:** Misunderstanding of Anthropic's rate limit accounting
**How to avoid:** For most Claude models, only `input_tokens` + `cache_creation_input_tokens` count toward ITPM limits. `cache_read_input_tokens` are FREE for rate limit purposes. This means with 80% cache hit rate, effective throughput is 5x the ITPM limit. Design the rate limiter to account for this.
**Warning signs:** Artificially low throughput despite good cache hit rates

### Pitfall 6: ESM + NodeNext Import Complications
**What goes wrong:** Import errors when adding new packages to the monorepo
**Why it happens:** The project uses NodeNext module resolution, which requires `.js` extensions on relative imports and may conflict with CJS-only packages
**How to avoid:** Verify that `ai`, `@ai-sdk/anthropic`, `cheerio`, and `p-queue` support ESM. All of these do. Use `.js` extensions on all relative imports within the project. For packages that don't support ESM natively, use dynamic `import()`.
**Warning signs:** `ERR_MODULE_NOT_FOUND` errors; TypeScript errors about missing `.js` extensions

### Pitfall 7: Vercel AI SDK v6 API Changes
**What goes wrong:** Using v5 API patterns (`generateObject` with `schema` parameter directly) that don't work in v6
**Why it happens:** AI SDK v6 unified `generateObject` and `generateText` into a single API with `Output` configuration
**How to avoid:** Use the v6 API pattern: `output: Output.object({ schema })` instead of the old `schema` parameter. The `generateObject` function is still available as a convenience wrapper. Check the migration guide if using examples from older docs.
**Warning signs:** TypeScript errors about unexpected parameters; runtime errors about missing `output` configuration

## Code Examples

### DOM Crawling with Playwright
```typescript
// Source: Playwright docs + aria-snapshots docs
import { chromium, type Browser, type Page } from 'playwright';

export interface CrawlOptions {
  url: string;
  viewport?: { width: number; height: number };
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
  timeout?: number;
}

export interface CrawlResult {
  html: string;
  ariaSnapshot: string;
  title: string;
  url: string;
}

export async function crawlPage(
  page: Page,
  options: CrawlOptions
): Promise<CrawlResult> {
  await page.setViewportSize(options.viewport ?? { width: 1280, height: 720 });
  await page.goto(options.url, {
    waitUntil: options.waitUntil ?? 'networkidle',
    timeout: options.timeout ?? 30_000,
  });

  const [html, ariaSnapshot, title] = await Promise.all([
    page.evaluate(() => document.body.outerHTML),
    page.locator('body').ariaSnapshot(),
    page.title(),
  ]);

  return { html, ariaSnapshot, title, url: options.url };
}
```

### AI SDK Structured Output for Test Steps
```typescript
// Source: AI SDK docs + Anthropic provider docs
import { generateObject, Output } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';

const LocatorSchema = z.object({
  type: z.enum(['role', 'text', 'label', 'placeholder', 'testId', 'css', 'xpath']),
  value: z.string().describe('The locator value (e.g., role name, text content, CSS selector)'),
  confidence: z.number().describe('Confidence 0.0-1.0 that this locator will find the correct element'),
  reasoning: z.string().describe('Why this locator was chosen and its reliability assessment'),
});

const TestStepSchema = z.object({
  order: z.number(),
  action: z.enum(['click', 'fill', 'select', 'check', 'navigate', 'assert', 'wait', 'hover']),
  description: z.string().describe('Human-readable description of what this step does'),
  target: z.object({
    elementDescription: z.string(),
    locators: z.array(LocatorSchema).min(2).describe('Multiple locator strategies, ordered by confidence'),
    primaryLocatorIndex: z.number().describe('Index of the recommended primary locator'),
  }),
  value: z.string().optional().describe('Input value for fill/select actions'),
  assertion: z.object({
    type: z.enum(['visible', 'hidden', 'text', 'value', 'url', 'count', 'attribute']),
    expected: z.string(),
  }).optional(),
  reasoning: z.string(),
});

const GenerationResultSchema = z.object({
  steps: z.array(TestStepSchema),
  reasoning: z.string().describe('Overall reasoning about the test approach'),
});

export async function generateTestSteps(
  systemPrompt: string,
  simplifiedDom: string,
  testDescription: string,
): Promise<z.infer<typeof GenerationResultSchema>> {
  const { object, usage } = await generateObject({
    model: anthropic('claude-sonnet-4-5'),
    output: Output.object({ schema: GenerationResultSchema }),
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `## Target Page DOM\n\n${simplifiedDom}\n\n## Test Description\n\n${testDescription}`,
      },
    ],
    providerOptions: {
      anthropic: { cacheControl: { type: 'ephemeral' } },
    },
  });

  // Track token usage for cost monitoring
  console.log('Token usage:', usage);

  return object;
}
```

### Rate-Limited API Queue
```typescript
// Source: p-queue docs
import PQueue from 'p-queue';

// Configure queue for Claude API rate limits
// Tier 2: 1000 RPM = ~16 per second
// Start conservative: 10 concurrent, 40 per minute
const apiQueue = new PQueue({
  concurrency: 5,
  interval: 60_000,
  intervalCap: 40,
});

export async function queuedGeneration<T>(
  fn: () => Promise<T>
): Promise<T> {
  return apiQueue.add(fn, { throwOnTimeout: true });
}

// Usage
const result = await queuedGeneration(() =>
  generateTestSteps(systemPrompt, dom, description)
);
```

### Selector Verification Against Live Page
```typescript
// Source: Playwright locator docs
import type { Page } from 'playwright';

interface VerificationResult {
  locatorType: string;
  locatorValue: string;
  found: boolean;
  count: number;
  isUnique: boolean;
}

export async function verifyLocator(
  page: Page,
  locator: { type: string; value: string }
): Promise<VerificationResult> {
  let playwrightLocator;

  switch (locator.type) {
    case 'role': {
      const [role, ...nameParts] = locator.value.split(':');
      const name = nameParts.join(':').trim();
      playwrightLocator = name
        ? page.getByRole(role as any, { name })
        : page.getByRole(role as any);
      break;
    }
    case 'text':
      playwrightLocator = page.getByText(locator.value);
      break;
    case 'label':
      playwrightLocator = page.getByLabel(locator.value);
      break;
    case 'placeholder':
      playwrightLocator = page.getByPlaceholder(locator.value);
      break;
    case 'testId':
      playwrightLocator = page.getByTestId(locator.value);
      break;
    case 'css':
      playwrightLocator = page.locator(locator.value);
      break;
    case 'xpath':
      playwrightLocator = page.locator(`xpath=${locator.value}`);
      break;
    default:
      return { locatorType: locator.type, locatorValue: locator.value, found: false, count: 0, isUnique: false };
  }

  const count = await playwrightLocator.count();
  return {
    locatorType: locator.type,
    locatorValue: locator.value,
    found: count > 0,
    count,
    isUnique: count === 1,
  };
}
```

### Cost Tracking
```typescript
// Source: Anthropic pricing docs

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
}

// Pricing per million tokens (Claude Sonnet 4.5)
const SONNET_PRICING = {
  input: 3.0,
  output: 15.0,
  cacheWrite: 3.75,  // 1.25x input
  cacheRead: 0.30,   // 0.1x input
};

export function calculateCost(usage: TokenUsage): number {
  const inputCost = (usage.inputTokens / 1_000_000) * SONNET_PRICING.input;
  const outputCost = (usage.outputTokens / 1_000_000) * SONNET_PRICING.output;
  const cacheWriteCost = (usage.cacheCreationInputTokens / 1_000_000) * SONNET_PRICING.cacheWrite;
  const cacheReadCost = (usage.cacheReadInputTokens / 1_000_000) * SONNET_PRICING.cacheRead;
  return inputCost + outputCost + cacheWriteCost + cacheReadCost;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tool-use trick for structured output | Native `output_config.format` with JSON schema | Late 2025 | No more fake tool definitions; direct schema enforcement |
| `@anthropic-ai/sdk` raw JSON parsing | AI SDK `generateObject` + Zod | AI SDK v4+ (2024) | Zero parse errors, type safety, provider-agnostic |
| CSS selectors only for test locators | Multi-strategy locators (role, text, aria, CSS) | 2024-2025 | 85-95% self-healing success rate vs 30-50% with single locator |
| Full page HTML to LLM | DOM downsampling + aria snapshot | 2025 | 10-50x token reduction, better generation quality |
| Fixed cache TTL (5 min only) | Configurable TTL (5m or 1h) | Late 2025 | 1h cache available at 2x input cost; useful for batch processing |
| `output_format` parameter | `output_config.format` parameter | 2025-2026 | Old parameter still works during transition but new one is canonical |

**Deprecated/outdated:**
- **DSPy.ts**: Mentioned in project concerns as uncertain maturity. Confirmed: do NOT use. The AI SDK with Zod schemas provides everything DSPy would offer (structured output, prompt templates) with vastly better ecosystem support.
- **Pi Agent SDK**: Mentioned in project concerns as pre-1.0. The Vercel AI SDK is the mature alternative; no need to evaluate Pi Agent further.
- **`anthropic-ai/sdk` `messages.create()` for structured output**: While still functional, the AI SDK's `generateObject` is strictly superior for structured output use cases.

## Open Questions

1. **Browser lifecycle for DOM crawling in Phase 2 vs Phase 3**
   - What we know: Phase 2 needs Playwright for DOM crawling and selector verification. Phase 3 needs Playwright for test execution with browser pools.
   - What's unclear: Should Phase 2 create a simple browser instance manager, or should it wait for Phase 3's browser pool?
   - Recommendation: Phase 2 should use a simple `chromium.launch()` / `browser.close()` pattern within activities. Phase 3 will add pooling. Don't over-engineer the browser lifecycle in Phase 2.

2. **Where to install Playwright -- core vs worker vs new package**
   - What we know: Playwright requires browser binary downloads (`npx playwright install chromium`). Core is meant to be lightweight shared types.
   - What's unclear: Whether DOM crawling and validation functions should live in core or a separate package.
   - Recommendation: Create DOM crawling functions in `packages/core/src/dom/` using Playwright types only (interface-based). Actual Playwright browser instantiation happens in `packages/worker/src/activities/`. This keeps core lightweight and testable.

3. **Model selection: Sonnet 4.5 vs Haiku 4.5 for test generation**
   - What we know: Sonnet 4.5 ($3/$15 per MTok) produces higher quality output. Haiku 4.5 ($1/$5 per MTok) is 3x cheaper but may produce lower quality locators.
   - What's unclear: Whether Haiku is sufficient for test step generation quality.
   - Recommendation: Default to Sonnet 4.5 for generation, make model configurable via environment variable. Consider Haiku for validation/verification steps where output is simpler.

4. **Token budget for DOM context**
   - What we know: Simple pages may be 2K tokens; complex SPAs can be 100K+ tokens even after simplification.
   - What's unclear: The optimal token budget before generation quality degrades.
   - Recommendation: Start with a 15K token budget for DOM context. If the simplified DOM exceeds this, implement progressive detail reduction: first drop non-interactive elements, then reduce attribute detail. Track generation quality vs token budget during development.

## Sources

### Primary (HIGH confidence)
- Anthropic Prompt Caching Docs (https://platform.claude.com/docs/en/build-with-claude/prompt-caching) -- cache_control, TTL, pricing, minimum thresholds
- Anthropic Structured Outputs Docs (https://platform.claude.com/docs/en/build-with-claude/structured-outputs) -- output_config.format, zodOutputFormat, JSON schema support
- Anthropic Rate Limits Docs (https://platform.claude.com/docs/en/api/rate-limits) -- RPM/ITPM/OTPM by tier, token bucket algorithm, cache-aware ITPM
- AI SDK Anthropic Provider Docs (https://ai-sdk.dev/providers/ai-sdk-providers/anthropic) -- providerOptions, cacheControl, structuredOutputMode
- AI SDK Structured Data Docs (https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data) -- generateObject, Output.object, Output.array
- AI SDK Dynamic Prompt Caching (https://ai-sdk.dev/cookbook/node/dynamic-prompt-caching) -- addCacheControlToMessages pattern
- Playwright Locators Docs (https://playwright.dev/docs/locators) -- all locator strategies, best practices
- Playwright Aria Snapshots Docs (https://playwright.dev/docs/aria-snapshots) -- ariaSnapshot(), YAML format

### Secondary (MEDIUM confidence)
- AI SDK v6 blog post (https://vercel.com/blog/ai-sdk-6) -- v6 API changes, unified generateText/generateObject
- npm package versions: `ai@6.0.116`, `@ai-sdk/anthropic@3.0.58`, `@anthropic-ai/sdk@0.78.0`
- Self-healing test automation patterns (multiple sources: Katalon, Virtuoso, ideyaLabs) -- 3-6 locators per element, 85-95% healing rate
- DOM downsampling research (https://arxiv.org/html/2508.04412v1) -- hierarchy preservation, token reduction strategies

### Tertiary (LOW confidence)
- Optimal token budget for DOM context (5-15K) -- based on general practice, not rigorous benchmarking
- Haiku vs Sonnet quality for test generation -- no direct comparison data found

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- AI SDK, Playwright, Cheerio are all well-documented, widely used, verified via official docs
- Architecture: HIGH -- Pipeline pattern is well-established; structured output with Zod is documented in official AI SDK examples
- Pitfalls: HIGH -- Rate limits, token thresholds, and cache behavior all verified from official Anthropic documentation
- DOM simplification: MEDIUM -- General techniques are well-known, but optimal token budget is empirical
- Self-healing confidence scoring: MEDIUM -- Industry pattern well-documented, but specific confidence thresholds need tuning

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (30 days -- AI SDK and Anthropic APIs are stable; Playwright updates may affect aria snapshot API)
