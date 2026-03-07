# Phase 10: Quality and Coverage - Research

**Researched:** 2026-03-07
**Domain:** Test infrastructure, unit/integration testing, code coverage
**Confidence:** HIGH

## Summary

This phase introduces test infrastructure and comprehensive test coverage across the Validater monorepo (packages: core, worker, web, db). The project currently has zero unit/integration tests and no Vitest configuration beyond a minimal `test` block in the web package's vite.config.ts. Vitest 3.2.4 is already installed in the web package. The web package also has `@testing-library/react`, `@testing-library/dom`, and `jsdom` in devDependencies.

The codebase has excellent testability characteristics: business logic in `packages/core` is largely pure-functional with dependency injection (e.g., Page objects passed in, factory patterns for activities). The DOM simplifier, extractor, cost tracker, rate limiter, assertions, viewport presets, mapper, and schemas are all highly unit-testable. The worker package uses a factory DI pattern (`createPersistActivities(db)`, `createExecuteActivities(db)`) that makes activity testing straightforward with mock DB objects. Server functions in the web package use dynamic imports extensively, which requires a specific mocking approach.

**Primary recommendation:** Use Vitest projects (root-level) for unified coverage reporting with per-glob-pattern coverage thresholds matching the tiered targets (95%/80%/60%). Each package gets its own vitest.config.ts with `defineProject`, and a root vitest.config.ts aggregates them via `test.projects`.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | 3.2.4 | Test runner | Already installed in web, native Vite integration, ESM-first |
| @vitest/coverage-v8 | 3.x | Coverage collection | Default Vitest provider, uses V8 built-in coverage, fast |
| @testing-library/react | 16.2.0 | React component testing | Already installed in web, community standard for React testing |
| @testing-library/dom | 10.4.0 | DOM assertions | Already installed in web, required peer of react testing lib |
| jsdom | 27.0.0 | Browser environment | Already installed in web, lightweight DOM simulation |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @testing-library/user-event | 14.x | User interaction simulation | Realistic event sequences in component tests |
| @testing-library/jest-dom | 6.x | DOM matchers | `toBeInTheDocument()`, `toHaveTextContent()` etc. |
| msw | 2.12.x | Network request mocking | Integration tests that need to mock API/auth calls |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @vitest/coverage-v8 | @vitest/coverage-istanbul | Istanbul is more mature but slower; v8 is the default and sufficient |
| jsdom | happy-dom | happy-dom is faster but less complete; jsdom already installed |
| Manual mock objects | vitest-mock-extended | Adds type-safe auto-mocking but adds a dependency for marginal gain |

**Installation:**
```bash
# Root (for projects aggregation)
pnpm add -Dw vitest @vitest/coverage-v8

# core package (testing infra)
pnpm --filter @validater/core add -D vitest @vitest/coverage-v8

# worker package (testing infra)
pnpm --filter @validater/worker add -D vitest @vitest/coverage-v8

# web package (additional testing libs)
pnpm --filter @validater/web add -D @vitest/coverage-v8 @testing-library/user-event @testing-library/jest-dom
```

## Architecture Patterns

### Recommended Test File Structure
```
packages/core/
  src/
    ai/
      __tests__/
        cost-tracker.test.ts        # Pure logic, no mocks needed
        rate-limiter.test.ts        # Test queue behavior with vi.useFakeTimers
        client.test.ts              # Mock AI SDK generateObject
    dom/
      __tests__/
        simplifier.test.ts          # Feed HTML strings, assert output
        extractor.test.ts           # Feed Cheerio objects, assert elements
    execution/
      __tests__/
        assertions.test.ts          # Mock Page/Locator, test each assertion type
        viewport-presets.test.ts    # Pure data, trivial tests
        step-runner.test.ts         # Mock Page, test action dispatch
        step-executor.test.ts       # Mock executeStep, test sequential behavior
    locators/
      __tests__/
        mapper.test.ts              # Mock Page, verify locator method calls
        validator.test.ts           # Mock Page/Locator, test verification logic
        healer.test.ts              # Mock Page + AI client, test healing strategies
    generation/
      __tests__/
        pipeline.test.ts            # Mock all dependencies, test orchestration
    schemas/
      __tests__/
        test-step.test.ts           # Zod schema validation tests
        locator.test.ts             # Zod schema validation tests
        test-suite.test.ts          # Zod schema validation tests

packages/worker/
  src/
    activities/
      __tests__/
        persist-results.test.ts     # Mock db, test factory output
        generate-steps.test.ts      # Mock core pipeline
    browser/
      __tests__/
        memory-monitor.test.ts      # Mock process.memoryUsage
        pool.test.ts                # Mock playwright, test pool lifecycle
    reports/
      __tests__/
        html-generator.test.ts      # Feed ReportData, assert HTML structure
    video/
      __tests__/
        processor.test.ts           # Mock child_process.spawn, verify FFmpeg args
        storage.test.ts             # Mock fs, test path resolution

packages/web/
  src/
    components/
      __tests__/
        accessibility-panel.test.tsx  # Render with mock data, verify display
        live-viewer.test.tsx          # Mock WebSocket, verify canvas rendering
    hooks/
      __tests__/
        use-test-run-polling.test.ts  # Mock server fn, verify polling lifecycle
        use-live-stream.test.ts       # Mock WebSocket, verify state management
    server/
      __tests__/
        run-test-core.test.ts         # Mock db + Temporal, test triggerTestRun
    lib/
      __tests__/
        utils.test.ts                 # Test cn() utility
```

### Pattern 1: Mocking Playwright Page Objects for Core Tests
**What:** Many core modules accept `Page` and `Locator` as parameters. Create lightweight mock objects matching the interface.
**When to use:** All `packages/core` tests that depend on Playwright types
**Example:**
```typescript
// Source: Vitest docs + codebase analysis
import { vi, describe, it, expect } from 'vitest';

function createMockPage(overrides?: Partial<Record<string, unknown>>) {
  return {
    url: vi.fn(() => 'https://example.com'),
    goto: vi.fn(),
    screenshot: vi.fn(() => Buffer.from('fake-png')),
    evaluate: vi.fn(),
    locator: vi.fn(() => createMockLocator()),
    getByRole: vi.fn(() => createMockLocator()),
    getByText: vi.fn(() => createMockLocator()),
    getByLabel: vi.fn(() => createMockLocator()),
    getByPlaceholder: vi.fn(() => createMockLocator()),
    getByTestId: vi.fn(() => createMockLocator()),
    ...overrides,
  } as unknown as import('playwright').Page;
}

function createMockLocator(overrides?: Partial<Record<string, unknown>>) {
  return {
    count: vi.fn(() => Promise.resolve(1)),
    click: vi.fn(),
    fill: vi.fn(),
    selectOption: vi.fn(),
    check: vi.fn(),
    hover: vi.fn(),
    waitFor: vi.fn(),
    isVisible: vi.fn(() => Promise.resolve(true)),
    isHidden: vi.fn(() => Promise.resolve(false)),
    textContent: vi.fn(() => Promise.resolve('text')),
    inputValue: vi.fn(() => Promise.resolve('value')),
    getAttribute: vi.fn(() => Promise.resolve('attr')),
    ariaSnapshot: vi.fn(() => Promise.resolve('')),
    ...overrides,
  } as unknown as import('playwright').Locator;
}
```

### Pattern 2: Testing Factory-Pattern Activities (Worker)
**What:** Worker activities use `createPersistActivities(db)` / `createExecuteActivities(db)` factory DI.
**When to use:** All activity tests in worker package
**Example:**
```typescript
// Source: codebase persist-results.activity.ts pattern
import { vi, describe, it, expect } from 'vitest';
import { createPersistActivities } from '../persist-results.activity.js';

function createMockDb() {
  const mockChain = {
    values: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  };
  return {
    insert: vi.fn(() => mockChain),
    update: vi.fn(() => mockChain),
    delete: vi.fn(() => mockChain),
    select: vi.fn(() => mockChain),
  } as unknown as import('@validater/db').Database;
}

describe('createPersistActivities', () => {
  it('creates persistResults and updateTestRunStatus functions', () => {
    const db = createMockDb();
    const activities = createPersistActivities(db);
    expect(activities.persistResults).toBeDefined();
    expect(activities.updateTestRunStatus).toBeDefined();
  });
});
```

### Pattern 3: Testing TanStack Start Server Functions
**What:** Server functions use `createServerFn` which requires plugin transformation. Tests must mock it.
**When to use:** Testing server function handler logic in web package
**Example:**
```typescript
// Source: TanStack community pattern + codebase analysis
// vitest-setup.ts for web package
import { vi } from 'vitest';

// Mock createServerFn to return the handler directly
vi.mock('@tanstack/react-start', () => ({
  createServerFn: ({ method }: { method: string }) => ({
    inputValidator: () => ({
      handler: (fn: Function) => fn,
    }),
  }),
}));
```

**Note:** Since web server functions use extensive dynamic imports (`await import('@validater/db')`), test the extracted business logic (like `triggerTestRun` in `run-test-core.ts`) directly rather than testing through the `createServerFn` wrapper. The server function wrappers are thin auth + serialization layers.

### Pattern 4: Cheerio/DOM Testing (No Browser Needed)
**What:** DOM simplifier and extractor use Cheerio (server-side HTML parsing). Tests feed HTML strings directly.
**When to use:** All `packages/core/src/dom/` tests
**Example:**
```typescript
// Source: codebase simplifier.ts analysis
import { describe, it, expect } from 'vitest';
import { simplifyDom } from '../simplifier.js';

describe('simplifyDom', () => {
  it('strips script and style tags', () => {
    const html = '<html><body><script>alert(1)</script><div>content</div></body></html>';
    const result = simplifyDom(html);
    expect(result.html).not.toContain('<script>');
    expect(result.html).toContain('content');
  });

  it('enforces token budget with progressive reduction', () => {
    const longHtml = '<html><body>' + '<div>x</div>'.repeat(10000) + '</body></html>';
    const result = simplifyDom(longHtml, { maxTokenEstimate: 1000 });
    expect(result.tokenEstimate).toBeLessThanOrEqual(1200); // ~budget with some slack
  });
});
```

### Anti-Patterns to Avoid
- **Testing through server function wrappers:** Don't try to simulate the full TanStack Start server function pipeline. Test business logic directly, mock auth at the boundary.
- **Requiring a live Playwright browser in unit tests:** Core modules accept Page/Locator interfaces. Mock them. Only E2E tests (already in web/e2e/) should use real browsers.
- **Testing shadcn/ui primitives:** The `components/ui/` directory is generated code from shadcn. Don't write tests for these. Test custom components that compose them.
- **Testing Temporal workflow orchestration in unit tests:** Workflow files run in the Temporal sandbox (deterministic runtime). Test activities in isolation. Workflow logic is better covered by integration tests.
- **Testing generated files:** Don't test `routeTree.gen.ts` -- it's auto-generated by TanStack Router.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Coverage report merging | Custom report aggregation scripts | Vitest projects (root coverage) | Single `vitest run --coverage` covers all packages |
| Test fixture factories | Manual test data construction per test | Shared `__fixtures__/` with builder functions | Reusable across packages, consistent test data |
| Mock Playwright Page | Full Page implementation | Lightweight vi.fn() mock objects | Only need the methods each module actually calls |
| Server function test harness | Custom createServerFn simulator | Mock createServerFn + test handlers directly | Handler functions have same signature, just test those |
| Coverage threshold enforcement | Custom CI scripts parsing coverage | Vitest `coverage.thresholds` config | Built-in exit code on threshold violation |

**Key insight:** Vitest's built-in coverage threshold configuration with glob patterns eliminates the need for any custom coverage enforcement tooling. The thresholds cause `vitest run --coverage` to exit non-zero when not met, which Turborepo can gate on.

## Common Pitfalls

### Pitfall 1: NodeNext Module Resolution in Core/Worker Tests
**What goes wrong:** Vitest runs with Vite's ESM bundler, but core/worker use `NodeNext` module resolution with `.js` extensions in imports. Tests may fail to resolve `./foo.js` imports that point to `.ts` files.
**Why it happens:** Core/worker tsconfig uses `module: "NodeNext"` + `moduleResolution: "NodeNext"` which requires `.js` extensions. Vitest uses Vite's bundler resolution which handles this, but only if configured correctly.
**How to avoid:** In core/worker vitest.config.ts, do NOT set `resolve.extensions`. Vite's default resolution handles `.js` -> `.ts` mapping automatically. Use `defineConfig` from `vitest/config` (not `vite`).
**Warning signs:** `Cannot find module './foo.js'` errors in test runs.

### Pitfall 2: Coverage Not Counting Projects Correctly
**What goes wrong:** Coverage shows 0% for packages whose tests aren't running, or counts the same file twice.
**Why it happens:** Vitest projects aggregate coverage. If a project's `include` pattern is wrong, files won't be counted. Coverage `include` patterns must use source file paths, not test file paths.
**How to avoid:** Set explicit `coverage.include` patterns at the root level targeting `packages/*/src/**/*.ts{,x}`. Exclude test files, types, and index barrel files from coverage.
**Warning signs:** Coverage numbers that don't change when adding tests, or suspiciously high/low percentages.

### Pitfall 3: Mocking Dynamic Imports in Server Functions
**What goes wrong:** Web server functions use `await import('@validater/db')` extensively. Direct vi.mock() on the module path doesn't intercept dynamic imports the same way.
**Why it happens:** Dynamic imports are resolved at runtime, not statically analyzed by Vitest's module mock system.
**How to avoid:** Test `run-test-core.ts` (which exports `triggerTestRun`) by mocking its dynamic import targets. Or better: extract business logic into testable pure functions and test those, leaving the thin server function wrapper untested.
**Warning signs:** Tests passing but not actually exercising the code path, or import errors in test runtime.

### Pitfall 4: Testing Temporal Workflows Directly
**What goes wrong:** Importing workflow files in tests triggers the Temporal sandbox, which restricts what Node.js APIs are available.
**Why it happens:** Temporal workflows run in a deterministic sandbox that prohibits I/O, timers, etc.
**How to avoid:** Only test activities (they run in normal Node.js). For workflow logic, test the orchestration via integration tests that use Temporal's test environment, or skip workflow files from unit coverage targets.
**Warning signs:** `Workflow sandbox violation` errors, or tests hanging indefinitely.

### Pitfall 5: Coverage Thresholds on Glob Patterns - Global vs Pattern Behavior
**What goes wrong:** Setting glob-pattern thresholds alongside global thresholds creates unexpected behavior. Files matching glob patterns are ALSO counted toward global thresholds.
**Why it happens:** Vitest counts all files including glob-matched ones into global thresholds. This differs from Jest behavior.
**How to avoid:** Use glob patterns for the tiered coverage targets. Set global thresholds conservatively (e.g., 50%) as a floor, and use specific glob patterns for the 95%/80%/60% tier targets.
**Warning signs:** Global threshold fails even though pattern-specific thresholds pass.

### Pitfall 6: Testing Components That Use TanStack Router Hooks
**What goes wrong:** Components using `useParams`, `useSearch`, `Link`, or `useNavigate` crash without router context.
**Why it happens:** TanStack Router hooks require `RouterProvider` context.
**How to avoid:** Create a `renderWithRouter` test utility that wraps components in a minimal router context using `createMemoryHistory`, `createRootRoute`, `createRoute`, `createRouter`, and `RouterProvider`.
**Warning signs:** "Cannot read properties of undefined" errors mentioning router context or history.

## Code Examples

Verified patterns from official sources:

### Vitest Root Config with Projects (Monorepo)
```typescript
// vitest.config.ts (root)
// Source: https://vitest.dev/guide/projects + https://turborepo.dev/docs/guides/tools/vitest
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      'packages/core',
      'packages/worker',
      'packages/web',
    ],
    coverage: {
      provider: 'v8',
      enabled: true,
      reportsDirectory: './coverage',
      reporter: ['text', 'html', 'json-summary', 'lcov'],
      include: [
        'packages/core/src/**/*.ts',
        'packages/worker/src/**/*.ts',
        'packages/web/src/**/*.ts',
        'packages/web/src/**/*.tsx',
      ],
      exclude: [
        '**/node_modules/**',
        '**/__tests__/**',
        '**/*.test.{ts,tsx}',
        '**/dist/**',
        '**/index.ts',            // barrel exports
        '**/types/**',            // type-only files
        '**/*.d.ts',
        'packages/web/src/routeTree.gen.ts',
        'packages/web/src/components/ui/**',  // shadcn generated
        'packages/web/e2e/**',
        'packages/worker/src/workflows/**',   // Temporal sandbox
      ],
      thresholds: {
        // Global floor
        lines: 50,
        functions: 50,
        branches: 50,
        statements: 50,
        // Business logic: 95% target
        'packages/core/src/ai/cost-tracker.ts': { lines: 95, functions: 95 },
        'packages/core/src/ai/rate-limiter.ts': { lines: 95, functions: 95 },
        'packages/core/src/dom/**.ts': { lines: 95, functions: 95 },
        'packages/core/src/execution/**.ts': { lines: 95, functions: 95 },
        'packages/core/src/locators/**.ts': { lines: 95, functions: 95 },
        'packages/core/src/schemas/**.ts': { lines: 95, functions: 95 },
        'packages/core/src/generation/**.ts': { lines: 90, functions: 90 },
        // Service layer: 80% target
        'packages/worker/src/activities/**.ts': { lines: 80, functions: 80 },
        'packages/worker/src/browser/**.ts': { lines: 80, functions: 80 },
        'packages/worker/src/reports/**.ts': { lines: 80, functions: 80 },
        'packages/web/src/server/**.ts': { lines: 80, functions: 80 },
        // UI: 60% target
        'packages/web/src/components/!(ui)**.tsx': { lines: 60, functions: 60 },
        'packages/web/src/hooks/**.ts': { lines: 60, functions: 60 },
      },
    },
  },
});
```

### Per-Package Vitest Config (Core)
```typescript
// packages/core/vitest.config.ts
// Source: https://vitest.dev/guide/projects
import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'core',
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
    globals: true,
  },
});
```

### Per-Package Vitest Config (Web)
```typescript
// packages/web/vitest.config.ts
// NOTE: This replaces the existing vite.config.ts test block
import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'web',
    environment: 'jsdom',
    include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**'],
    globals: true,
    setupFiles: ['./vitest-setup.ts'],
  },
});
```

### Zod Schema Tests
```typescript
// Source: codebase schemas + Zod API
import { describe, it, expect } from 'vitest';
import { TestStepSchema, TestGenerationSchema } from '../test-step.js';

describe('TestStepSchema', () => {
  it('validates a well-formed test step', () => {
    const step = {
      order: 1,
      action: 'click',
      description: 'Click the login button',
      target: {
        elementDescription: 'Login button',
        locators: [
          { type: 'role', value: 'button: Login', confidence: 0.9, reasoning: 'ARIA role' },
          { type: 'css', value: '#login-btn', confidence: 0.8, reasoning: 'ID selector' },
        ],
        primaryLocatorIndex: 0,
      },
      reasoning: 'Need to click login to proceed',
    };
    expect(TestStepSchema.safeParse(step).success).toBe(true);
  });

  it('rejects steps with fewer than 2 locators', () => {
    const step = {
      order: 1,
      action: 'click',
      description: 'Click',
      target: {
        elementDescription: 'Button',
        locators: [{ type: 'css', value: '#btn', confidence: 0.9, reasoning: 'test' }],
        primaryLocatorIndex: 0,
      },
      reasoning: 'test',
    };
    expect(TestStepSchema.safeParse(step).success).toBe(false);
  });
});
```

### CostTracker Unit Test (Pure Logic)
```typescript
// Source: codebase cost-tracker.ts
import { describe, it, expect } from 'vitest';
import { calculateCost, CostTracker } from '../cost-tracker.js';

describe('calculateCost', () => {
  it('calculates cost for known model', () => {
    const usage = {
      inputTokens: 1000,
      outputTokens: 500,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
    };
    const cost = calculateCost(usage, 'claude-sonnet-4-5');
    expect(cost.inputCost).toBeCloseTo(0.003); // 1000/1M * 3.0
    expect(cost.outputCost).toBeCloseTo(0.0075); // 500/1M * 15.0
    expect(cost.totalCost).toBeCloseTo(0.0105);
    expect(cost.currency).toBe('USD');
  });

  it('uses default pricing for unknown model', () => {
    const usage = {
      inputTokens: 1000,
      outputTokens: 0,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
    };
    const cost = calculateCost(usage, 'unknown-model');
    // Falls back to claude-sonnet-4-5 pricing
    expect(cost.inputCost).toBeCloseTo(0.003);
  });
});

describe('CostTracker', () => {
  it('tracks multiple entries and computes summary', () => {
    const tracker = new CostTracker();
    const usage = {
      inputTokens: 1000,
      outputTokens: 500,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
    };
    tracker.track(usage, 'claude-sonnet-4-5');
    tracker.track(usage, 'claude-sonnet-4-5');

    const summary = tracker.getUsageSummary();
    expect(summary.requestCount).toBe(2);
    expect(summary.totalInputTokens).toBe(2000);
    expect(summary.totalCost).toBeCloseTo(0.021);
  });

  it('resets clears all entries', () => {
    const tracker = new CostTracker();
    tracker.track({
      inputTokens: 1000, outputTokens: 0,
      cacheCreationInputTokens: 0, cacheReadInputTokens: 0,
    }, 'test');
    tracker.reset();
    expect(tracker.getTotalCost()).toBe(0);
    expect(tracker.getUsageSummary().requestCount).toBe(0);
  });
});
```

### Integration Test: Full Pipeline Mock
```typescript
// Source: codebase pattern analysis
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock all external dependencies
vi.mock('../dom/crawler.js', () => ({
  crawlPage: vi.fn().mockResolvedValue({
    html: '<html><body><button>Click me</button></body></html>',
    ariaSnapshot: 'button "Click me"',
  }),
}));

vi.mock('../dom/simplifier.js', () => ({
  simplifyDom: vi.fn().mockReturnValue({
    html: '<button>Click me</button>',
    elements: [],
    interactiveElements: [],
    pageContext: { title: 'Test', url: '' },
    tokenEstimate: 100,
  }),
}));

vi.mock('../ai/client.js', () => ({
  generateTestSteps: vi.fn().mockResolvedValue({
    steps: [{
      order: 1,
      action: 'click',
      description: 'Click button',
      target: {
        elementDescription: 'Button',
        locators: [
          { type: 'css', value: 'button', confidence: 0.9, reasoning: 'tag' },
          { type: 'text', value: 'Click me', confidence: 0.8, reasoning: 'text' },
        ],
        primaryLocatorIndex: 0,
      },
      reasoning: 'test',
    }],
    reasoning: 'overall',
    usage: { inputTokens: 100, outputTokens: 50, cacheCreationInputTokens: 0, cacheReadInputTokens: 0 },
  }),
}));

vi.mock('../ai/rate-limiter.js', () => ({
  queuedRequest: vi.fn((_, fn) => fn()),
  defaultApiQueue: {},
}));

vi.mock('../locators/validator.js', () => ({
  verifyStepLocators: vi.fn().mockResolvedValue({
    stepId: 'test', stepOrder: 1,
    locatorResults: [{ locator: { type: 'css', value: 'button', confidence: 0.9, reasoning: 'tag' }, found: true, count: 1, isUnique: true }],
    primaryLocatorValid: true, isValid: true,
  }),
}));

vi.mock('../locators/healer.js', () => ({
  healStepLocators: vi.fn((_page, steps) => Promise.resolve(steps)),
}));

import { generateAndValidateTestSteps } from '../pipeline.js';

describe('generateAndValidateTestSteps', () => {
  it('orchestrates the full pipeline', async () => {
    const mockPage = createMockPage(); // from shared test utils
    const result = await generateAndValidateTestSteps({
      page: mockPage,
      request: { url: 'https://example.com', testDescription: 'Test click' },
    });
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].id).toBeDefined(); // nanoid assigned
    expect(result.cost.totalCost).toBeGreaterThan(0);
    expect(result.durationMs).toBeGreaterThan(0);
  });
});
```

### Turbo Task Configuration
```json
{
  "tasks": {
    "test": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "test:coverage": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    }
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| vitest.workspace.ts | test.projects in vitest.config.ts | Vitest 3.2 (deprecated workspace) | Use `projects` array instead of separate workspace file |
| Per-package coverage merging | Root-level projects coverage | Vitest 3.x | Single coverage report across all projects |
| @vitest/coverage-istanbul | @vitest/coverage-v8 (default) | Vitest 2.x | v8 is faster, built-in, and the default provider |

**Deprecated/outdated:**
- `vitest.workspace.ts`: Deprecated in Vitest 3.2. Use `test.projects` in root config instead. Functionally identical.
- `defineWorkspace`: Use `defineConfig` with `test.projects` instead.

## Module-by-Module Testability Analysis

### Business Logic (95% target) -- packages/core

| Module | Testability | Mock Requirements | Notes |
|--------|-------------|-------------------|-------|
| `ai/cost-tracker.ts` | EXCELLENT | None (pure functions) | 2 exports: `calculateCost`, `CostTracker` class |
| `ai/rate-limiter.ts` | EXCELLENT | None (wraps p-queue) | Test queue creation + request throughput |
| `dom/simplifier.ts` | EXCELLENT | None (Cheerio, pure) | Feed HTML strings, assert transformed output |
| `dom/extractor.ts` | EXCELLENT | None (Cheerio, pure) | Feed HTML, assert extracted elements |
| `execution/assertions.ts` | GOOD | Mock Page + Locator | Each assertion type is a separate branch |
| `execution/viewport-presets.ts` | EXCELLENT | None (pure data) | Trivial -- just verify preset values |
| `execution/step-runner.ts` | GOOD | Mock Page + Locator | resolveLocator + executeAction + executeStep |
| `execution/step-executor.ts` | GOOD | Mock executeStep | Test sequential execution, onStepComplete callback |
| `locators/mapper.ts` | GOOD | Mock Page | Verify correct Playwright method called per type |
| `locators/validator.ts` | GOOD | Mock Page + Locator | Test found/not-found/error paths |
| `locators/healer.ts` | MODERATE | Mock Page + AI client | Strategy 1 (free alternatives) easy; Strategy 2 (AI) needs AI mock |
| `ai/client.ts` | MODERATE | Mock AI SDK | Test provider selection, usage extraction |
| `generation/pipeline.ts` | MODERATE | Mock all deps | Orchestration test -- verify call sequence |
| `schemas/*.ts` | EXCELLENT | None (Zod parse) | Feed valid/invalid data, assert parse results |

### Service Layer (80% target) -- packages/worker + web/server

| Module | Testability | Mock Requirements | Notes |
|--------|-------------|-------------------|-------|
| `worker/activities/persist-results.ts` | GOOD | Mock DB | Factory DI pattern makes this clean |
| `worker/browser/memory-monitor.ts` | EXCELLENT | Mock process.memoryUsage | Pure function, one dependency |
| `worker/reports/html-generator.ts` | GOOD | Mock fs (template read) | Feed ReportData, assert HTML |
| `worker/video/processor.ts` | MODERATE | Mock child_process.spawn | Verify FFmpeg command construction |
| `worker/video/storage.ts` | MODERATE | Mock fs | Path resolution logic |
| `web/server/run-test-core.ts` | MODERATE | Mock db + Temporal + core | Core business logic, many dynamic imports |
| `web/server/test-runs.ts` | LOWER | Mock auth + db | Thin wrapper around DB queries |
| `web/server/exports.ts` | LOWER | Mock auth + db + worker | Thin wrapper, heavy dynamic imports |

### UI (60% target) -- packages/web/src/components + hooks

| Module | Testability | Mock Requirements | Notes |
|--------|-------------|-------------------|-------|
| `hooks/use-test-run-polling.ts` | GOOD | Mock server fn + timers | Standard hook testing with act() |
| `hooks/use-live-stream.ts` | MODERATE | Mock WebSocket | Verify state machine transitions |
| `components/accessibility-panel.tsx` | GOOD | None (data display) | Render with props, verify output |
| `components/live-viewer.tsx` | LOW | Mock canvas + WebSocket | Canvas operations hard to test in jsdom |
| Route components | LOW | Full router context | Complex setup, low ROI for coverage phase |

## Open Questions

Things that couldn't be fully resolved:

1. **Vitest glob thresholds exact syntax for monorepo paths**
   - What we know: Vitest supports glob patterns in `coverage.thresholds`. Patterns like `'src/utils/**.ts'` work.
   - What's unclear: Whether `packages/core/src/dom/**.ts` patterns work from the root vitest.config.ts, or if paths must be relative to each project root. The documentation examples only show single-package patterns.
   - Recommendation: Start with explicit file-level thresholds for the most critical modules. Expand to glob patterns and verify they resolve correctly. Use `autoUpdate` to discover actual coverage levels first.

2. **Testing web server functions with dynamic imports**
   - What we know: `createServerFn` can be mocked. Handler functions have a simple signature. But handlers internally use `await import(...)` for all dependencies.
   - What's unclear: Whether vi.mock() intercepts dynamic imports inside handler functions reliably.
   - Recommendation: Prioritize testing `run-test-core.ts` (which exports `triggerTestRun` directly, not wrapped in createServerFn). For other server functions, mock at the module level and accept coverage gaps on the thin auth/serialization wrappers.

3. **Temporal workflow files and coverage exclusion**
   - What we know: Workflow files (`test-run.workflow.ts`, `viewport-execution.workflow.ts`, etc.) run in Temporal's deterministic sandbox. They can't be imported normally in Node.js tests.
   - What's unclear: Whether Vitest will error when attempting to analyze coverage for these files, or if excluding them from coverage is sufficient.
   - Recommendation: Exclude `packages/worker/src/workflows/**` from coverage. The workflow orchestration logic is tested indirectly via E2E tests.

## Sources

### Primary (HIGH confidence)
- Vitest official docs: coverage configuration -- https://vitest.dev/config/coverage
- Vitest official docs: test projects (formerly workspace) -- https://vitest.dev/guide/projects
- Turborepo Vitest integration guide -- https://turborepo.dev/docs/guides/tools/vitest
- Vitest 3.2 release notes (workspace deprecation) -- https://vitest.dev/blog/vitest-3-2.html
- Installed version: vitest 3.2.4 (verified in packages/web/node_modules)

### Secondary (MEDIUM confidence)
- TanStack community: testing server functions -- https://github.com/TanStack/router/discussions/2701
- TanStack community: testing with router -- https://github.com/TanStack/router/discussions/655
- Vitest GitHub discussion: coverage with workspace -- https://github.com/vitest-dev/vitest/discussions/3852

### Tertiary (LOW confidence)
- TanStack Start testing blog -- https://www.axelby.com/blog/testing-tanstack-start/ (partial, no setup files shown)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Vitest 3.2.4 already installed, all deps verified, official docs confirm API
- Architecture: HIGH - Based on deep codebase analysis of all 4 packages, confirmed testability per module
- Pitfalls: HIGH - NodeNext resolution, Temporal sandbox, dynamic imports are well-documented issues
- Coverage thresholds: MEDIUM - Glob pattern behavior in monorepo context needs validation during implementation

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (30 days -- stable domain, Vitest 3.x API is established)
