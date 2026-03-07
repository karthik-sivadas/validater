# Phase 9: Test Suite Generation and Accessibility - Research

**Researched:** 2026-03-07
**Domain:** AI-powered multi-test generation and axe-core accessibility integration
**Confidence:** HIGH

## Summary

Phase 9 has two distinct sub-problems: (1) generating a comprehensive test suite from a single feature description, and (2) integrating axe-core accessibility scanning into every test run. Both build directly on the existing architecture -- the AI test generation pipeline (Phase 2), the browser execution engine (Phase 3), and the Temporal workflow orchestration (Phase 4).

For test suite generation, the existing `generateTestSteps` function generates a single test's steps from a description. Suite generation requires a two-stage AI approach: first generate multiple test case specifications (happy path, edge cases, error states) from a feature description, then use the existing pipeline to generate steps for each. This maps cleanly to a new Temporal workflow that orchestrates the fan-out. The database needs new tables for test suites and test cases, and the frontend needs suite management UI.

For accessibility, `@axe-core/playwright` v4.11.1 is the standard library. It accepts a Playwright `Page` object (which the execution engine already has) and returns structured violation data categorized by severity. The key decision is where in the pipeline to run it -- after all test steps complete but before the browser context closes, using the final page state. Results are stored in new DB columns/tables and rendered in the existing results page.

**Primary recommendation:** Use a two-stage AI generation approach (feature -> test cases -> steps per case) with @axe-core/playwright run at the end of each viewport execution, storing results per viewport in a new `accessibility_results` table.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @axe-core/playwright | 4.11.1 | Accessibility scanning in browser context | Official Deque integration for Playwright, runs axe-core engine |
| ai (AI SDK) | ^6.0.116 | Already installed -- generateObject for suite generation | Project standard, supports structured output with Zod schemas |
| zod | ^3.25.76 | Already installed -- schemas for suite generation output | Project standard for all structured data validation |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| playwright | ^1.58.2 | Already installed -- provides Page for AxeBuilder | Browser context already available in execution engine |
| @openrouter/ai-sdk-provider | existing | Already installed -- OpenRouter AI provider | Suite generation AI calls use existing provider setup |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @axe-core/playwright | axe-playwright (community) | Community fork has fewer updates; official package is maintained by Deque |
| Two-stage AI generation | Single massive prompt | Single prompt would exceed token limits and produce lower quality; two-stage gives better control |
| Separate accessibility table | JSONB column on test_run_results | Separate table is more queryable and avoids bloating existing rows |

**Installation:**
```bash
pnpm add @axe-core/playwright --filter @validater/worker
```

Note: `axe-core` is a peer dependency of `@axe-core/playwright` and will be auto-resolved. No additional core packages needed -- AI SDK, Zod, Playwright, and Temporal are already installed.

## Architecture Patterns

### Recommended Project Structure

New files only -- existing structure is preserved:

```
packages/
├── core/src/
│   ├── ai/
│   │   └── prompts/
│   │       └── suite-generation.ts    # System + user prompts for suite gen
│   ├── schemas/
│   │   └── test-suite.ts              # Zod schemas for suite generation output
│   └── types/
│       └── test-suite.ts              # TestSuite, TestCase types
├── db/src/schema/
│   └── test-suites.ts                 # test_suites, test_cases, accessibility_results tables
├── worker/src/
│   ├── activities/
│   │   ├── generate-suite.activity.ts # AI suite generation activity
│   │   └── accessibility.activity.ts  # OR inline in execute-steps (see pattern below)
│   └── workflows/
│       └── test-suite.workflow.ts     # Orchestrates suite generation + optional execution
└── web/src/
    ├── server/
    │   └── test-suites.ts             # Server functions for suite CRUD + generation
    ├── routes/_authed/
    │   ├── suites.tsx                 # Suite list layout
    │   └── suites/
    │       ├── index.tsx              # Suite listing page
    │       ├── new.tsx                # Suite generation form
    │       └── $suiteId.tsx           # Suite detail + test case management
    └── components/
        └── accessibility-panel.tsx    # Reusable a11y results display
```

### Pattern 1: Two-Stage Suite Generation

**What:** Generate a test suite by first producing test case specifications, then generating steps for each case using the existing pipeline.

**When to use:** When a user provides a feature description and wants comprehensive test coverage.

**Stage 1 - Feature to Test Cases (new AI call):**
```typescript
// Source: Existing AI SDK pattern from packages/core/src/ai/client.ts
import { generateObject } from 'ai';
import { z } from 'zod';
import { createAIClient } from './client.js';

const TestCaseSpecSchema = z.object({
  testCases: z.array(z.object({
    name: z.string().describe('Short name for this test case'),
    description: z.string().describe('Natural language test description (same format as single test)'),
    category: z.enum(['happy_path', 'edge_case', 'error_state', 'boundary']),
    priority: z.enum(['critical', 'high', 'medium', 'low']),
    reasoning: z.string().describe('Why this test case is needed for comprehensive coverage'),
  })),
  reasoning: z.string().describe('Overall strategy for test coverage'),
});

export async function generateTestCases(params: {
  featureDescription: string;
  url: string;
  simplifiedDomHtml: string;
  ariaSnapshot: string;
}): Promise<z.infer<typeof TestCaseSpecSchema>> {
  const model = createAIClient();
  const result = await generateObject({
    model,
    schema: TestCaseSpecSchema,
    system: SUITE_GENERATION_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildSuiteUserPrompt(params) }],
  });
  return result.object;
}
```

**Stage 2 - Existing pipeline per test case:**
Each test case's `description` feeds directly into the existing `generateTestSteps()` function. No changes to the existing generation pipeline needed.

### Pattern 2: Accessibility Scanning Inline in Execution

**What:** Run axe-core after test steps complete but before browser context closes.

**When to use:** Every test run -- axe scans the final page state after all steps execute.

**Where to integrate:** Inside `executeStepsActivity` in `packages/worker/src/activities/execute-steps.activity.ts`, after `executeSteps()` returns but before `context.close()`.

```typescript
// Source: @axe-core/playwright official docs + existing execute-steps.activity.ts pattern
import AxeBuilder from '@axe-core/playwright';

// Inside executeStepsActivity, after executeSteps() returns:
let accessibilityResults = null;
try {
  const axeResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  accessibilityResults = {
    violations: axeResults.violations.map(v => ({
      id: v.id,
      impact: v.impact,       // 'minor' | 'moderate' | 'serious' | 'critical'
      description: v.description,
      help: v.help,
      helpUrl: v.helpUrl,
      tags: v.tags,
      nodes: v.nodes.map(n => ({
        target: n.target,
        html: n.html,
        impact: n.impact,
        failureSummary: n.failureSummary,
      })),
    })),
    passes: axeResults.passes.length,
    incomplete: axeResults.incomplete.length,
    inapplicable: axeResults.inapplicable.length,
  };
} catch {
  // Accessibility scanning is best-effort -- never break test execution
}
```

### Pattern 3: Test Suite Temporal Workflow

**What:** A new parent workflow that orchestrates suite generation and optionally runs all tests.

**When to use:** When user triggers "Generate Suite" from the UI.

```typescript
// Source: Existing test-run.workflow.ts pattern
export interface TestSuiteParams {
  suiteId: string;
  url: string;
  featureDescription: string;
  generateOnly: boolean; // true = just generate, false = generate + run all
}

export async function testSuiteWorkflow(params: TestSuiteParams): Promise<TestSuiteResult> {
  // Stage 1: Crawl DOM (reuse existing activity)
  const { crawlResult, simplified } = await crawlDom({ url: params.url });

  // Stage 2: Generate test case specs (new activity)
  const suiteSpec = await generateSuiteSpecs({
    featureDescription: params.featureDescription,
    url: params.url,
    simplifiedDomHtml: simplified.html,
    ariaSnapshot: crawlResult.ariaSnapshot ?? '',
  });

  // Stage 3: For each test case, generate steps (reuse existing activity)
  const testCases = await Promise.all(
    suiteSpec.testCases.map(async (tc, index) => {
      const genResult = await generateSteps({
        simplifiedDomHtml: simplified.html,
        ariaSnapshot: crawlResult.ariaSnapshot ?? '',
        testDescription: tc.description,
      });
      return { ...tc, steps: genResult.steps, index };
    })
  );

  // Persist suite + test cases to DB
  await persistSuite({ suiteId: params.suiteId, testCases, ... });

  // Stage 4 (optional): Run each test case as individual test runs
  if (!params.generateOnly) {
    // Fan out to existing testRunWorkflow for each test case
  }
}
```

### Pattern 4: Database Schema for Suites and Accessibility

**What:** New tables for test suites, test cases, and accessibility results.

```typescript
// Source: Existing packages/db/src/schema/test-runs.ts pattern
import { pgTable, text, timestamp, integer, jsonb, pgEnum } from "drizzle-orm/pg-core";

export const testCaseCategoryEnum = pgEnum("test_case_category", [
  "happy_path", "edge_case", "error_state", "boundary",
]);

export const testCasePriorityEnum = pgEnum("test_case_priority", [
  "critical", "high", "medium", "low",
]);

export const testSuites = pgTable("test_suites", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  featureDescription: text("feature_description").notNull(),
  status: text("status").notNull().default("pending"), // pending | generating | complete | failed
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const testCases = pgTable("test_cases", {
  id: text("id").primaryKey(),
  suiteId: text("suite_id").notNull().references(() => testSuites.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: testCaseCategoryEnum("category").notNull(),
  priority: testCasePriorityEnum("priority").notNull(),
  reasoning: text("reasoning"),
  steps: jsonb("steps"),          // TestStep[] stored as JSON
  testRunId: text("test_run_id"), // Links to test_runs when executed
  order: integer("order").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Accessibility results stored per viewport execution
export const accessibilityResults = pgTable("accessibility_results", {
  id: text("id").primaryKey(),
  resultId: text("result_id").notNull()
    .references(() => testRunResults.id, { onDelete: "cascade" }),
  violationCount: integer("violation_count").notNull().default(0),
  passCount: integer("pass_count").notNull().default(0),
  incompleteCount: integer("incomplete_count").notNull().default(0),
  inapplicableCount: integer("inapplicable_count").notNull().default(0),
  violations: jsonb("violations").notNull().default([]),
  // violations shape: Array<{ id, impact, description, help, helpUrl, tags, nodes }>
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

### Anti-Patterns to Avoid

- **Running axe-core on every step:** Axe should run once after all steps complete on the final page state, not per step. Per-step scanning is extremely slow and produces redundant results.
- **Generating all test case steps in a single AI call:** Token limits and quality degrade. Generate test case specifications first, then individual test steps per case.
- **Storing axe violations as a single text column:** Use JSONB for queryability. The violation structure is hierarchical (violations -> nodes -> checks).
- **Making accessibility blocking:** Accessibility results are "insights" (per PLAT-06), not pass/fail gates. Store and display them but don't fail test runs over accessibility issues.
- **Generating steps for all test cases in parallel:** Each generateSteps call is rate-limited through the defaultApiQueue. Let them queue naturally -- don't bypass rate limiting.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Accessibility scanning | Custom DOM traversal for a11y issues | @axe-core/playwright | 50+ WCAG rules, maintained by Deque, industry standard |
| WCAG compliance categorization | Custom severity/impact mapping | axe-core's built-in tags + impact levels | Already maps to WCAG 2.0/2.1 AA, handles edge cases |
| AI structured output | JSON parsing + validation | AI SDK generateObject + Zod schema | Already the project pattern, handles retries and validation |
| Test case deduplication | Custom similarity matching | AI prompt instructions | Tell the AI to ensure unique, non-overlapping test cases in the system prompt |
| Accessibility help URLs | Building a11y remediation docs | axe-core's helpUrl field | Every violation includes a link to Deque's remediation docs |

**Key insight:** axe-core is the industry standard used by most accessibility testing tools. It handles hundreds of WCAG rules and edge cases that would take months to implement manually. The @axe-core/playwright wrapper makes it trivial to integrate into the existing Playwright-based execution engine.

## Common Pitfalls

### Pitfall 1: Axe-Core Running on Wrong Page State
**What goes wrong:** axe-core scans a loading or transitioning page instead of the final state after test steps complete.
**Why it happens:** Running the scan too early (before steps finish) or too late (after page navigation changes state).
**How to avoid:** Run `new AxeBuilder({ page }).analyze()` immediately after `executeSteps()` returns, before any cleanup. The page is in its final state at this point.
**Warning signs:** Inconsistent accessibility results across identical test runs.

### Pitfall 2: Suite Generation Producing Duplicate/Overlapping Tests
**What goes wrong:** AI generates 5 test cases that essentially test the same thing with minor variations.
**Why it happens:** Feature description is vague, or system prompt doesn't enforce diversity.
**How to avoid:** System prompt must explicitly require distinct categories (happy path, edge case, error state) and instruct the AI to avoid overlap. Include category enum in the schema.
**Warning signs:** Multiple test cases with very similar descriptions.

### Pitfall 3: Token Budget Explosion with Suite Generation
**What goes wrong:** Generating steps for 6-8 test cases exhausts AI token budget or triggers rate limits.
**Why it happens:** Each test case goes through the full generation pipeline (DOM crawl, simplify, generate, validate, heal).
**How to avoid:** Crawl DOM once and share the simplified DOM across all test case generation calls. Only the AI generation call needs to vary per test case. Use the existing rate limiter queue.
**Warning signs:** Temporal activity timeouts on suite generation workflows.

### Pitfall 4: Axe-Core Payload Size for DB Storage
**What goes wrong:** Some pages produce hundreds of accessibility violations with detailed node information, creating massive JSONB payloads.
**Why it happens:** Pages with many repeated accessibility issues (e.g., missing alt tags on all images) produce one node entry per element.
**How to avoid:** Limit stored nodes to first 10 per violation. Store summary counts separately from detailed violations. Consider truncating HTML snippets.
**Warning signs:** DB insert timeouts or very slow results page loading.

### Pitfall 5: Temporal Event History Limits on Suite Workflows
**What goes wrong:** A suite with 8 test cases, each generating steps and executing across 3 viewports, can hit Temporal's 50K event limit.
**Why it happens:** Each activity call, child workflow start/complete, timer, etc. adds events.
**How to avoid:** Use child workflows for each test case execution (same pattern as viewport fan-out). Keep the parent workflow lean -- it just coordinates.
**Warning signs:** Temporal workflow failures with "event history too large" errors.

### Pitfall 6: AxeBuilder Constructor Takes Object, Not Page Directly
**What goes wrong:** `new AxeBuilder(page)` fails at runtime.
**Why it happens:** The API requires `new AxeBuilder({ page })` (object with page property), not the page directly.
**How to avoid:** Always use object destructuring syntax: `new AxeBuilder({ page })`.
**Warning signs:** TypeScript compilation error or runtime "page.evaluate is not a function" error.

## Code Examples

Verified patterns from official sources:

### Running Accessibility Scan After Test Steps
```typescript
// Source: Playwright docs + existing execute-steps.activity.ts pattern
import AxeBuilder from '@axe-core/playwright';

// After executeSteps() returns, before context.close():
const axeResults = await new AxeBuilder({ page })
  .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
  .analyze();

// Map to storage-friendly format
const a11yData = {
  violationCount: axeResults.violations.length,
  passCount: axeResults.passes.length,
  incompleteCount: axeResults.incomplete.length,
  inapplicableCount: axeResults.inapplicable.length,
  violations: axeResults.violations.map(v => ({
    id: v.id,
    impact: v.impact,
    description: v.description,
    help: v.help,
    helpUrl: v.helpUrl,
    tags: v.tags,
    nodes: v.nodes.slice(0, 10).map(n => ({
      target: n.target,
      html: n.html.substring(0, 500), // Truncate long HTML
      impact: n.impact,
      failureSummary: n.failureSummary,
    })),
    nodeCount: v.nodes.length, // Total count even if nodes truncated
  })),
};
```

### Suite Generation System Prompt Structure
```typescript
// Source: Follows existing SYSTEM_PROMPT pattern from core/src/ai/prompts/system.ts
export const SUITE_GENERATION_SYSTEM_PROMPT = `You are an expert QA engineer generating comprehensive test suites. Given a feature description and the page structure, generate a set of distinct test cases that together provide thorough coverage.

## Test Case Categories

Generate test cases across these categories:

1. **happy_path**: Normal, expected user interactions that should succeed
2. **edge_case**: Unusual but valid inputs or interactions (empty fields, max-length input, special characters)
3. **error_state**: Invalid actions that should produce error messages or be prevented
4. **boundary**: Extreme values, performance-related, or state-dependent scenarios

## Guidelines

- Generate 4-8 test cases per feature
- Each test case description must be self-contained (usable as a standalone test)
- No two test cases should test the same behavior
- Every feature should have at least one happy_path and one error_state case
- Prioritize critical user-facing flows
- Descriptions should follow the format: "Test that [action] [expected result]"
`;
```

### Persisting Accessibility Results in Execute Activity
```typescript
// Source: Follows existing staging table pattern from execute-steps.activity.ts
// Inside createExecuteActivities factory, after executeSteps returns:

if (accessibilityResults) {
  try {
    await db.insert(accessibilityResultsTable).values({
      id: nanoid(),
      resultId: '', // Placeholder -- resolved in persist-results
      testRunId: params.streamingConfig?.testRunId ?? '',
      viewport: params.viewport.name,
      violationCount: accessibilityResults.violationCount,
      passCount: accessibilityResults.passCount,
      incompleteCount: accessibilityResults.incompleteCount,
      inapplicableCount: accessibilityResults.inapplicableCount,
      violations: accessibilityResults.violations,
    }).onConflictDoNothing();
  } catch {
    // Accessibility persist failure must not break execution
  }
}
```

### Rendering Accessibility Panel in Results Page
```typescript
// Source: Follows existing results page pattern from runs/$runId.tsx

interface AccessibilityViolation {
  id: string;
  impact: 'minor' | 'moderate' | 'serious' | 'critical';
  description: string;
  help: string;
  helpUrl: string;
  nodeCount: number;
}

const IMPACT_COLORS: Record<string, string> = {
  critical: 'bg-red-500 text-white',
  serious: 'bg-orange-500 text-white',
  moderate: 'bg-yellow-500 text-black',
  minor: 'bg-blue-400 text-white',
};

function AccessibilityPanel({ violations }: { violations: AccessibilityViolation[] }) {
  const grouped = {
    critical: violations.filter(v => v.impact === 'critical'),
    serious: violations.filter(v => v.impact === 'serious'),
    moderate: violations.filter(v => v.impact === 'moderate'),
    minor: violations.filter(v => v.impact === 'minor'),
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Accessibility Insights</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Summary badges */}
        <div className="flex gap-2 mb-4">
          {Object.entries(grouped).map(([impact, items]) => (
            items.length > 0 && (
              <Badge key={impact} className={IMPACT_COLORS[impact]}>
                {items.length} {impact}
              </Badge>
            )
          ))}
        </div>
        {/* Violation list */}
        {violations.map(v => (
          <div key={v.id} className="border-b py-2">
            <Badge className={IMPACT_COLORS[v.impact]}>{v.impact}</Badge>
            <span className="ml-2 font-medium">{v.help}</span>
            <p className="text-sm text-muted-foreground">{v.description}</p>
            <a href={v.helpUrl} target="_blank" className="text-xs text-blue-500">
              Learn more
            </a>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual test case writing | AI-generated test suites from feature descriptions | 2024-2025 | 10x faster test creation, consistent coverage patterns |
| Custom accessibility checkers | axe-core integration (industry standard) | Stable since 2019, v4.x since 2022 | Standardized rules, maintained by Deque, used by all major tools |
| Single test generation | Multi-test suite generation with categories | 2024-2025 | Comprehensive coverage without manual test planning |
| axe-core 3.x | axe-core 4.x | 2022 | Better frame support, new WCAG 2.1 rules, improved performance |

**Deprecated/outdated:**
- `axe-playwright` (community package by abhinaba-ghosh): Superseded by official `@axe-core/playwright` maintained by Deque. Do not use the community fork.
- WCAG 2.0 only scanning: Use `['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']` tags to cover both WCAG 2.0 and 2.1 AA standards.

## Open Questions

1. **Should accessibility scans run on every page state during execution, or only the final state?**
   - What we know: Running per-step is slow (each scan takes 1-3 seconds). Final state captures the most relevant accessibility context.
   - What's unclear: Some violations may only be visible in intermediate states (e.g., modal dialogs opened during test).
   - Recommendation: Start with final-state-only scanning. Add per-step scanning as a future enhancement if users request it.

2. **How many test cases should suite generation produce?**
   - What we know: 4-8 test cases provides good coverage without excessive AI cost. Too many cases means more generation time and API costs.
   - What's unclear: Whether users expect to configure this number.
   - Recommendation: Default to 4-8 with AI discretion based on feature complexity. Add a `maxTestCases` parameter for future configurability.

3. **Should suite test cases share a single DOM crawl or recrawl per case?**
   - What we know: DOM crawling is fast (~2-5 seconds) but the page state may change between tests if they modify data. However, for step generation (not execution), the initial page state is what matters for locator grounding.
   - What's unclear: Edge cases where the page structure significantly differs after interaction.
   - Recommendation: Crawl once for generation, execute individually. Each execution navigates fresh anyway.

4. **Accessibility results in reports (HTML/PDF)?**
   - What we know: Reports are generated by `packages/worker/src/reports/html-generator.ts`. Adding a11y data requires extending `ReportData` type and the HTML template.
   - What's unclear: How much detail to include in reports vs. just summary badges.
   - Recommendation: Include summary counts (critical/serious/moderate/minor) in reports. Full violation details in the web UI only.

## Sources

### Primary (HIGH confidence)
- Playwright official docs - accessibility testing guide (https://playwright.dev/docs/accessibility-testing)
- Deque axe-core API documentation (https://www.deque.com/axe/core-documentation/api-documentation/)
- Existing codebase: `packages/core/src/ai/client.ts`, `packages/worker/src/activities/execute-steps.activity.ts`, `packages/db/src/schema/test-runs.ts` -- verified current architecture patterns

### Secondary (MEDIUM confidence)
- @axe-core/playwright npm package page (v4.11.1 confirmed via `pnpm info`)
- Playwright + axe-core integration patterns from multiple dev community articles verified against official docs

### Tertiary (LOW confidence)
- AI test suite generation best practices from community articles (2025-2026) -- patterns are reasonable but specific implementation details vary by tool

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - @axe-core/playwright is the undisputed standard, AI SDK is the project's existing choice
- Architecture: HIGH - Patterns directly extend existing codebase architecture (factory DI, Temporal workflows, staging tables)
- Pitfalls: HIGH - Based on direct analysis of existing codebase constraints and axe-core API behavior
- Suite generation AI prompts: MEDIUM - Prompt engineering patterns are well-established but specific effectiveness depends on model behavior

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (30 days -- axe-core is stable, AI SDK patterns are established)
