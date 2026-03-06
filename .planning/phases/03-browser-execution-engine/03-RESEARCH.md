# Phase 3: Browser Execution Engine - Research

**Researched:** 2026-03-06
**Domain:** Playwright browser automation, resource pooling, screenshot management
**Confidence:** HIGH

## Summary

This phase builds the runtime engine that executes AI-generated TestStep arrays against live web pages via Playwright. The core challenge is mapping the existing `TestStep` type (with its 8 action types, 7 locator types, and 7 assertion types) to Playwright's locator-based action API, capturing a screenshot after each step, and producing structured pass/fail results with error details.

The second dimension is multi-viewport execution: running the same test steps across desktop (1920x1080), tablet (768x1024), and mobile (375x812) viewports using Playwright's `browser.newContext()` viewport configuration. Each viewport produces independent results.

The third dimension is browser pool management. The existing codebase creates and destroys browsers per activity call (`chromium.launch()` / `browser.close()` in `crawl-dom.activity.ts` and `validate-steps.activity.ts`). This phase replaces that with a pooled approach using `generic-pool` to reuse browser instances, automatically retire them after a configurable number of pages, and monitor memory via `process.memoryUsage()`.

**Primary recommendation:** Build the step runner in `@validater/core` (pure logic, accepts a Playwright Page), the browser pool in `@validater/worker` (infrastructure), and the Temporal activities in `@validater/worker` that wire them together. Use `generic-pool` for pooling, return screenshots as Base64 Buffers (not file paths) for Temporal serialization.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| playwright | ^1.58.2 | Browser automation engine | Already installed in worker; full API for actions, screenshots, viewports |
| generic-pool | ^3.9.0 | Resource pooling | 14M+ weekly downloads; battle-tested for DB connections, applies directly to browsers |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| nanoid | ^5.1.6 | Unique IDs for execution results | Already in worker; needed for StepResult IDs |
| zod | ^3.25.76 | Schema validation for execution types | Already in core; validate execution configs |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| generic-pool | @crawlee/browser-pool | Crawlee's browser-pool is tightly coupled to the Crawlee framework and overkill for our needs; generic-pool is lightweight and general-purpose |
| generic-pool | Custom pool class | Reinventing eviction, timeouts, queue management; generic-pool handles all edge cases |
| Base64 screenshots | File system paths | File paths don't serialize through Temporal activity boundaries; Base64 Buffers are portable |

**Installation:**
```bash
cd packages/worker && pnpm add generic-pool
cd packages/worker && pnpm add -D @types/generic-pool
```

## Architecture Patterns

### Recommended Project Structure
```
packages/core/src/
  execution/
    step-runner.ts       # executeStep() - maps TestStep to Playwright actions
    step-executor.ts     # executeSteps() - orchestrates full step array with screenshots
    assertions.ts        # checkAssertion() - maps AssertionType to Playwright checks
    viewport-presets.ts  # VIEWPORT_PRESETS constant + ViewportConfig type
    types.ts             # StepResult, ExecutionResult, ViewportResult types
    index.ts             # barrel export

packages/worker/src/
  browser/
    pool.ts              # BrowserPool class wrapping generic-pool
    memory-monitor.ts    # Memory threshold checking via process.memoryUsage()
    index.ts             # barrel export
  activities/
    execute-steps.activity.ts     # Temporal activity: run steps in single viewport
    execute-viewports.activity.ts # Temporal activity: fan out across viewports
```

### Pattern 1: Step Runner (Action Mapper)
**What:** A pure function that maps a TestStep to a Playwright action, using the existing `mapLocatorToPlaywright()` pattern from `validator.ts`.
**When to use:** Every step execution -- this is the atomic unit of the engine.
**Example:**
```typescript
// Source: Based on existing validator.ts mapLocatorToPlaywright pattern
import type { Page, Locator } from 'playwright';
import type { TestStep, TestStepAction } from '@validater/core';

async function executeAction(
  locator: Locator,
  step: TestStep,
): Promise<void> {
  const actionMap: Record<TestStepAction, () => Promise<void>> = {
    click: () => locator.click({ timeout: 10_000 }),
    fill: () => locator.fill(step.value ?? '', { timeout: 10_000 }),
    select: () => locator.selectOption(step.value ?? '', { timeout: 10_000 }),
    check: () => locator.check({ timeout: 10_000 }),
    hover: () => locator.hover({ timeout: 10_000 }),
    navigate: () => step.target
      ? Promise.resolve() // navigation handled before action
      : Promise.resolve(),
    assert: () => Promise.resolve(), // handled separately by assertion checker
    wait: () => locator.waitFor({ state: 'visible', timeout: 10_000 }),
  };
  await actionMap[step.action]();
}
```

### Pattern 2: Screenshot-Per-Step Loop
**What:** Execute each step sequentially, capturing a screenshot after each step (pass or fail).
**When to use:** Every test execution -- screenshots are always captured.
**Example:**
```typescript
// Source: Playwright docs - page.screenshot()
async function executeSteps(
  page: Page,
  steps: TestStep[],
): Promise<StepResult[]> {
  const results: StepResult[] = [];

  for (const step of steps) {
    const startTime = Date.now();
    let status: 'pass' | 'fail' = 'pass';
    let error: StepError | undefined;

    try {
      // Handle navigate action
      if (step.action === 'navigate') {
        await page.goto(step.value ?? step.target.elementDescription, {
          waitUntil: 'networkidle',
          timeout: 30_000,
        });
      } else if (step.action !== 'assert') {
        // Resolve locator and execute action
        const locator = resolveLocator(page, step);
        await executeAction(locator, step);
      }

      // Check assertion if present
      if (step.assertion) {
        await checkAssertion(page, step);
      }
    } catch (err) {
      status = 'fail';
      error = {
        message: err instanceof Error ? err.message : String(err),
        expected: step.assertion?.expected,
        actual: undefined, // populated by assertion checker
      };
    }

    // ALWAYS capture screenshot (pass or fail)
    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: false,
    });

    results.push({
      stepId: step.id,
      stepOrder: step.order,
      status,
      error,
      screenshotBase64: screenshot.toString('base64'),
      durationMs: Date.now() - startTime,
    });
  }

  return results;
}
```

### Pattern 3: Browser Pool with generic-pool
**What:** Wrap Playwright browser instances in a generic-pool factory with lifecycle management.
**When to use:** Worker startup -- pool is created once, shared across all activities.
**Example:**
```typescript
// Source: generic-pool README + Playwright library docs
import { createPool, Pool } from 'generic-pool';
import { chromium, Browser } from 'playwright';

interface PooledBrowser {
  browser: Browser;
  createdAt: number;
  pagesProcessed: number;
}

const factory = {
  create: async (): Promise<PooledBrowser> => {
    const browser = await chromium.launch({ headless: true });
    return { browser, createdAt: Date.now(), pagesProcessed: 0 };
  },
  destroy: async (pooled: PooledBrowser): Promise<void> => {
    await pooled.browser.close();
  },
  validate: async (pooled: PooledBrowser): Promise<boolean> => {
    const maxLifetimeMs = 5 * 60 * 1000; // 5 minutes
    const maxPages = 50;
    const isAlive = pooled.browser.isConnected();
    const notExpired = Date.now() - pooled.createdAt < maxLifetimeMs;
    const notExhausted = pooled.pagesProcessed < maxPages;
    return isAlive && notExpired && notExhausted;
  },
};

const pool = createPool(factory, {
  max: 3,
  min: 1,
  testOnBorrow: true,
  acquireTimeoutMillis: 30_000,
  idleTimeoutMillis: 60_000,
  evictionRunIntervalMillis: 30_000,
});
```

### Pattern 4: Viewport Presets
**What:** Named viewport configurations for the 3 required presets plus extensibility.
**When to use:** Multi-viewport execution.
**Example:**
```typescript
// Source: Playwright emulation docs
export interface ViewportConfig {
  name: string;
  width: number;
  height: number;
  deviceScaleFactor: number;
  isMobile: boolean;
  hasTouch: boolean;
  userAgent?: string;
}

export const VIEWPORT_PRESETS: Record<string, ViewportConfig> = {
  desktop: {
    name: 'desktop',
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  },
  tablet: {
    name: 'tablet',
    width: 768,
    height: 1024,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
  mobile: {
    name: 'mobile',
    width: 375,
    height: 812,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  },
};
```

### Anti-Patterns to Avoid
- **Sharing a Page across viewports:** Each viewport MUST get its own BrowserContext. Contexts provide full isolation (cookies, storage, viewport). Never resize a single page between viewports.
- **Stopping on first failure:** Capture ALL step results even after a failure. The user needs to see which steps passed and which failed. Use try/catch per step, not around the loop.
- **Saving screenshots to disk in activities:** Temporal activities must return serializable data. Screenshots as Base64 strings travel through Temporal. File paths are worker-local and break in distributed setups.
- **Using page.click(selector) instead of locator.click():** The `page.click()` pattern is deprecated. Always use `page.locator(selector).click()` or the semantic locator methods (`getByRole`, `getByText`, etc.).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Browser instance pooling | Custom Map with acquire/release | `generic-pool` | Handles eviction, queue management, concurrent access, timeouts, validation on borrow/return |
| Locator resolution | New locator mapping function | Existing `mapLocatorToPlaywright()` from `validator.ts` | Already handles all 7 locator types including role parsing; refactor to export it |
| Action timeout handling | Custom timeout wrappers | Playwright's built-in action timeouts | Every action method accepts a `timeout` option; Playwright auto-waits for actionability |
| Element visibility/readiness | Manual waitFor + isVisible checks | Playwright's auto-wait actionability | Playwright auto-waits for visible, stable, enabled, receives-events before acting |
| Screenshot format/quality | Image processing pipeline | `page.screenshot({ type: 'png' })` returns Buffer directly | PNG is lossless, good for text-heavy UI; Buffer.toString('base64') for serialization |

**Key insight:** Playwright's auto-waiting actionability system handles 90% of timing issues that plague browser automation. Every action (click, fill, check, hover) automatically waits for the element to be visible, stable, and enabled before acting. The `timeout` parameter on each action is the only knob you need.

## Common Pitfalls

### Pitfall 1: Locator Resolution Fallback Ordering
**What goes wrong:** Using the primary locator only, failing if it doesn't match, ignoring alternative locators.
**Why it happens:** Primary locator from AI generation may have drifted since validation in Phase 2.
**How to avoid:** Try primary locator first. If it fails (count === 0 or timeout), iterate through alternatives in confidence order. This mirrors the healing pattern already in `validator.ts`.
**Warning signs:** Tests that passed during generation now fail at execution time.

### Pitfall 2: Navigate Action Handling
**What goes wrong:** Treating `navigate` like other actions and trying to find a locator for it.
**Why it happens:** `navigate` steps have a target but the action is `page.goto()`, not a locator-based action.
**How to avoid:** Check `step.action === 'navigate'` before locator resolution. Use `step.value` (the URL) for `page.goto()`. Fall back to `step.target.elementDescription` if value is empty.
**Warning signs:** "Locator not found" errors on navigate steps.

### Pitfall 3: Screenshot After Navigation
**What goes wrong:** Taking screenshot immediately after `page.goto()` before page is rendered.
**Why it happens:** `page.goto()` with `waitUntil: 'commit'` returns too early.
**How to avoid:** Use `waitUntil: 'networkidle'` for navigate steps, or add `page.waitForLoadState('networkidle')` before screenshot. This ensures visible content is rendered.
**Warning signs:** Blank or partially-loaded screenshots.

### Pitfall 4: Browser Pool Exhaustion Under Load
**What goes wrong:** All pool slots borrowed, new requests queue indefinitely.
**Why it happens:** Long-running test executions hold browsers for minutes. Pool max too low.
**How to avoid:** Set `acquireTimeoutMillis` to fail fast rather than queue forever. Size pool based on expected concurrent test runs. Use `pool.use()` pattern for automatic release.
**Warning signs:** `TimeoutError` from pool.acquire() calls.

### Pitfall 5: Memory Growth in Long-Running Workers
**What goes wrong:** Browsers accumulate memory over many page navigations, eventually OOMing the worker.
**Why it happens:** Chromium doesn't perfectly garbage-collect after page navigations. Known issue (playwright#15400, #6319).
**How to avoid:** Track `pagesProcessed` per browser instance. Retire (destroy + recreate) after a threshold (e.g., 50 pages). Use `testOnBorrow: true` with validate function that checks `browser.isConnected()` and page count.
**Warning signs:** `process.memoryUsage().heapUsed` growing monotonically. `rss` exceeding 1GB per browser.

### Pitfall 6: Assertion Type Mapping Gaps
**What goes wrong:** `assert` steps with `type: 'url'` try to assert on a locator instead of the page.
**Why it happens:** The `AssertionType` includes both locator-level ('visible', 'hidden', 'text', 'value', 'count', 'attribute') and page-level ('url') assertion types.
**How to avoid:** Split assertion handling: page-level assertions (`url`) check `page.url()`, locator-level assertions use `locator.textContent()`, `locator.inputValue()`, `locator.isVisible()`, etc.
**Warning signs:** "Locator not found" errors on URL assertions.

### Pitfall 7: Temporal Activity Serialization
**What goes wrong:** Returning Playwright objects (Page, Browser, Locator) from activities.
**Why it happens:** Temporal serializes all activity inputs/outputs as JSON. Playwright objects are not serializable.
**How to avoid:** Activities must return plain objects only. Screenshots as Base64 strings. Results as typed plain objects. Never pass Playwright objects across activity boundaries.
**Warning signs:** `DataConverterError: Could not convert` errors from Temporal.

## Code Examples

### Mapping TestStep Actions to Playwright (Complete)
```typescript
// Source: Playwright input docs + existing validator.ts pattern
import type { Page, Locator } from 'playwright';
import type { TestStep, TestStepAction } from '@validater/core';

/**
 * Execute a single TestStep action on a resolved Playwright locator.
 * Navigate and assert actions are handled separately (not here).
 */
async function executeAction(
  locator: Locator,
  step: TestStep,
  timeout: number = 10_000,
): Promise<void> {
  switch (step.action) {
    case 'click':
      await locator.click({ timeout });
      break;
    case 'fill':
      await locator.fill(step.value ?? '', { timeout });
      break;
    case 'select':
      await locator.selectOption(step.value ?? '', { timeout });
      break;
    case 'check':
      await locator.check({ timeout });
      break;
    case 'hover':
      await locator.hover({ timeout });
      break;
    case 'wait':
      await locator.waitFor({ state: 'visible', timeout });
      break;
    case 'navigate':
    case 'assert':
      // Handled by caller, not locator-based
      break;
  }
}
```

### Assertion Checker (Complete)
```typescript
// Source: Playwright LocatorAssertions + PageAssertions docs
import type { Page, Locator } from 'playwright';
import type { TestStep, TestStepAssertion, AssertionType } from '@validater/core';

/**
 * Check a test step's assertion against the live page.
 * Throws if assertion fails (caught by step runner).
 */
async function checkAssertion(
  page: Page,
  step: TestStep,
  locator?: Locator,
): Promise<void> {
  const assertion = step.assertion;
  if (!assertion) return;

  switch (assertion.type) {
    case 'visible':
      if (!locator) throw new Error('Locator required for visible assertion');
      const isVisible = await locator.isVisible();
      if (!isVisible) throw new Error(`Expected element to be visible`);
      break;

    case 'hidden':
      if (!locator) throw new Error('Locator required for hidden assertion');
      const isHidden = await locator.isHidden();
      if (!isHidden) throw new Error(`Expected element to be hidden`);
      break;

    case 'text':
      if (!locator) throw new Error('Locator required for text assertion');
      const text = await locator.textContent();
      if (!text?.includes(assertion.expected)) {
        throw new AssertionError('text', assertion.expected, text ?? '');
      }
      break;

    case 'value':
      if (!locator) throw new Error('Locator required for value assertion');
      const value = await locator.inputValue();
      if (value !== assertion.expected) {
        throw new AssertionError('value', assertion.expected, value);
      }
      break;

    case 'url':
      const currentUrl = page.url();
      if (!currentUrl.includes(assertion.expected)) {
        throw new AssertionError('url', assertion.expected, currentUrl);
      }
      break;

    case 'count':
      if (!locator) throw new Error('Locator required for count assertion');
      const count = await locator.count();
      const expectedCount = parseInt(assertion.expected, 10);
      if (count !== expectedCount) {
        throw new AssertionError('count', assertion.expected, String(count));
      }
      break;

    case 'attribute':
      if (!locator) throw new Error('Locator required for attribute assertion');
      // Format: "attributeName=expectedValue"
      const [attrName, ...rest] = assertion.expected.split('=');
      const expectedAttrValue = rest.join('=');
      const actualAttrValue = await locator.getAttribute(attrName ?? '');
      if (actualAttrValue !== expectedAttrValue) {
        throw new AssertionError('attribute', assertion.expected, actualAttrValue ?? 'null');
      }
      break;
  }
}

class AssertionError extends Error {
  constructor(
    public readonly assertionType: string,
    public readonly expected: string,
    public readonly actual: string,
  ) {
    super(`Assertion failed [${assertionType}]: expected "${expected}", got "${actual}"`);
    this.name = 'AssertionError';
  }
}
```

### Locator Resolution with Fallback
```typescript
// Source: Based on existing core/locators/validator.ts
import type { Page, Locator } from 'playwright';
import type { TestStep } from '@validater/core';

/**
 * Resolve a TestStep's locators to a working Playwright Locator.
 * Tries primary first, then alternatives in confidence order.
 */
async function resolveLocator(
  page: Page,
  step: TestStep,
  timeout: number = 5_000,
): Promise<Locator> {
  const { locators, primaryLocatorIndex } = step.target;

  // Try primary locator first
  const primaryLocator = locators[primaryLocatorIndex];
  if (primaryLocator) {
    const pwLocator = mapLocatorToPlaywright(page, primaryLocator);
    const count = await pwLocator.count();
    if (count > 0) return pwLocator;
  }

  // Try alternatives sorted by confidence (highest first)
  const alternatives = [...locators]
    .map((loc, idx) => ({ loc, idx }))
    .filter(({ idx }) => idx !== primaryLocatorIndex)
    .sort((a, b) => b.loc.confidence - a.loc.confidence);

  for (const { loc } of alternatives) {
    try {
      const pwLocator = mapLocatorToPlaywright(page, loc);
      const count = await pwLocator.count();
      if (count > 0) return pwLocator;
    } catch {
      continue; // Invalid selector, try next
    }
  }

  throw new Error(
    `No working locator found for step "${step.description}". ` +
    `Tried ${locators.length} locators: ${locators.map(l => `${l.type}="${l.value}"`).join(', ')}`
  );
}
```

### Browser Pool Usage in Temporal Activity
```typescript
// Source: generic-pool docs + Temporal activity pattern
import type { TestStep } from '@validater/core';
import { browserPool } from '../browser/pool.js';

export async function executeStepsActivity(params: {
  url: string;
  steps: TestStep[];
  viewport: ViewportConfig;
}): Promise<ExecutionResult> {
  const pooled = await browserPool.acquire();
  try {
    const context = await pooled.browser.newContext({
      viewport: { width: params.viewport.width, height: params.viewport.height },
      deviceScaleFactor: params.viewport.deviceScaleFactor,
      isMobile: params.viewport.isMobile,
      hasTouch: params.viewport.hasTouch,
    });
    const page = await context.newPage();

    try {
      const results = await executeSteps(page, params.steps);
      return {
        viewport: params.viewport.name,
        stepResults: results,
        totalDurationMs: results.reduce((sum, r) => sum + r.durationMs, 0),
      };
    } finally {
      await context.close();
    }
  } finally {
    pooled.pagesProcessed++;
    await browserPool.release(pooled);
  }
}
```

### Memory Monitor
```typescript
// Source: Node.js process.memoryUsage() docs
function checkMemoryHealth(): {
  healthy: boolean;
  rssBytes: number;
  heapUsedBytes: number;
  heapPercentage: number;
} {
  const mem = process.memoryUsage();
  const heapPercentage = mem.heapUsed / mem.heapTotal;
  const MAX_RSS_BYTES = 1.5 * 1024 * 1024 * 1024; // 1.5 GB

  return {
    healthy: mem.rss < MAX_RSS_BYTES && heapPercentage < 0.9,
    rssBytes: mem.rss,
    heapUsedBytes: mem.heapUsed,
    heapPercentage,
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `page.click(selector)` | `page.locator(selector).click()` | Playwright 1.14+ | Old methods deprecated; locator-based API is auto-waiting |
| `page.waitForSelector()` then act | `locator.click()` (auto-waits) | Playwright 1.14+ | Built-in actionability removes need for explicit waits |
| `page.screenshot()` PNG only | `page.screenshot({ type: 'png' \| 'jpeg' })` | Long-standing | PNG recommended for UI testing (lossless) |
| Per-activity browser launch | Browser pool with reuse | This phase | Eliminates ~2s launch overhead per activity call |
| `page.$()` ElementHandle | `page.locator()` Locator | Playwright 1.14+ | Locators are lazy, auto-retrying; ElementHandles are eager, stale-prone |

**Deprecated/outdated:**
- `page.click()`, `page.fill()`, etc. (direct page methods): Use locator-based equivalents
- `ElementHandle` API: Use `Locator` API instead -- Locators auto-retry and don't go stale
- `page.waitForSelector()` before actions: Playwright auto-waits; only use `.waitFor()` on locators if you need explicit wait-for-state

## Open Questions

1. **Screenshot storage strategy for Phase 5+**
   - What we know: Screenshots as Base64 in Temporal activity results works for Phase 3. Phase 5 (frontend) will need to display them.
   - What's unclear: Should we store screenshots in PostgreSQL (bytea), object storage (S3/R2), or local filesystem? Base64 in DB is simplest but largest.
   - Recommendation: Return Base64 from activities now. Phase 4 (workflow orchestration) will persist results -- defer storage decision to Phase 4/5.

2. **Refactoring mapLocatorToPlaywright for shared use**
   - What we know: `mapLocatorToPlaywright()` in `validator.ts` is a private function. The step runner needs the same function.
   - What's unclear: Should we export it from validator.ts or move it to a shared module?
   - Recommendation: Extract to a shared `locators/mapper.ts` file and export from core. Both validator and step runner import from there.

3. **Error recovery between steps**
   - What we know: After a step fails, subsequent steps may also fail due to page state divergence.
   - What's unclear: Should we skip remaining steps after a failure, or attempt all and report the cascade?
   - Recommendation: Execute all steps regardless of prior failures. Users benefit from seeing which steps are independently valid vs. which fail due to cascade. Mark cascade failures distinctly if possible.

4. **Browser pool sizing for Temporal workers**
   - What we know: Each headless Chromium uses ~200-500MB RAM. Temporal workers can run multiple concurrent activities.
   - What's unclear: Optimal pool size depends on worker machine specs (unknown at this point).
   - Recommendation: Default pool max=3, min=1, configurable via environment variables. This supports 3 concurrent viewport executions without excessive memory.

## Sources

### Primary (HIGH confidence)
- Playwright official docs: [Screenshots](https://playwright.dev/docs/screenshots) - screenshot API, format options
- Playwright official docs: [Browser Contexts](https://playwright.dev/docs/browser-contexts) - context isolation, viewport config
- Playwright official docs: [Input Actions](https://playwright.dev/docs/input) - click, fill, selectOption, check, hover methods
- Playwright official docs: [Actionability](https://playwright.dev/docs/actionability) - auto-wait checks per action type
- Playwright official docs: [Emulation](https://playwright.dev/docs/emulation) - viewport presets, device config, isMobile
- Playwright official docs: [Library Mode](https://playwright.dev/docs/library) - programmatic usage without test runner
- Playwright official docs: [LocatorAssertions](https://playwright.dev/docs/api/class-locatorassertions) - all assertion methods
- Playwright official docs: [PageAssertions](https://playwright.dev/docs/api/class-pageassertions) - toHaveURL, toHaveTitle
- Playwright official docs: [browser.newContext()](https://playwright.dev/docs/api/class-browser#browser-new-context) - full context options
- [generic-pool GitHub](https://github.com/coopernurse/node-pool) - Pool API, factory interface, configuration options

### Secondary (MEDIUM confidence)
- [Playwright memory leak issues](https://github.com/microsoft/playwright/issues/15400) - confirmed memory growth pattern with context reuse
- [Playwright memory issue #6319](https://github.com/microsoft/playwright/issues/6319) - memory increases with same context reuse
- [Playwright best practices 2026](https://www.browserstack.com/guide/playwright-best-practices) - screenshot and debugging patterns

### Tertiary (LOW confidence)
- [Browser pool Medium article](https://medium.com/@devcriston/building-a-robust-browser-pool-for-web-automation-with-playwright-2c750eb0a8e7) - pool sizing guidance (3-5 browsers, 200-500MB per instance)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Playwright already in project, generic-pool is the de facto Node.js pooling library
- Architecture: HIGH - Follows established patterns from Phase 2 (DI via Page, activities in worker, logic in core)
- Pitfalls: HIGH - Memory issues verified via Playwright GitHub issues; serialization constraint from Temporal docs
- Action mapping: HIGH - All 8 TestStepAction types map directly to Playwright Locator methods
- Assertion mapping: HIGH - All 7 AssertionTypes map to Playwright Locator/Page methods
- Pool configuration: MEDIUM - Optimal sizing (max 3, retire after 50 pages) based on community guidance, needs tuning

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (Playwright API is stable; generic-pool is mature)
