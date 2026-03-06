---
phase: 02-ai-agent-test-generation
plan: 02
subsystem: api
tags: [playwright, cheerio, dom, crawler, extractor, simplifier, accessibility, xpath, css-selectors]

# Dependency graph
requires:
  - phase: 02-ai-agent-test-generation
    provides: CrawlOptions, CrawlResult, SimplifiedDom, InteractiveElement, SemanticElement, PageContext types; cheerio and playwright dependencies
affects: [02-03-ai-generation, 02-04-validation, 02-05-integration]
provides:
  - crawlPage function for Playwright-based page crawling with concurrent HTML/aria/title extraction
  - simplifyDom function for token-efficient DOM representation with progressive budget enforcement
  - extractInteractiveElements for accessible metadata on all clickable/fillable elements
  - extractSemanticElements for page landmark tree structure

# Tech tracking
tech-stack:
  added: []
  patterns: [caller-managed browser lifecycle (crawlPage accepts Page not Browser), progressive token reduction, Cheerio-based DOM analysis]

key-files:
  created:
    - packages/core/src/dom/crawler.ts
    - packages/core/src/dom/simplifier.ts
    - packages/core/src/dom/extractor.ts
    - packages/core/src/dom/index.ts
  modified:
    - packages/core/src/index.ts

key-decisions:
  - "crawlPage accepts Playwright Page object, not Browser -- caller manages browser lifecycle (Phase 3 handles browser pools)"
  - "Type-only Playwright import in core (import type { Page }) -- no runtime dependency"
  - "Progressive token budget enforcement: prune non-interactive elements, truncate text, drop attributes"
  - "isUtilityClass filters Tailwind-like classes from CSS selectors and simplified DOM output"
  - "XPath generation priority: id > data-testid > name > text content"
  - "CSS selector priority: #id > [data-testid] > tag.class:nth-of-type"

patterns-established:
  - "Caller-managed lifecycle: DOM functions accept Playwright Page, not Browser -- separation of crawling from browser management"
  - "Progressive reduction: token budget enforcement through multiple reduction passes (prune, truncate, strip)"
  - "Cheerio for server-side DOM analysis: load HTML once, extract interactive + semantic elements in parallel"

# Metrics
duration: 7min
completed: 2026-03-06
---

# Phase 2 Plan 2: DOM Crawler and Simplifier Summary

**Playwright-based DOM crawler with Cheerio simplifier that extracts interactive elements (xpath, CSS selectors, accessible names) and enforces 15K token budget via progressive reduction**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-06T17:23:18Z
- **Completed:** 2026-03-06T17:30:28Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Created crawlPage function that uses Playwright Page for concurrent HTML, aria snapshot, and title extraction
- Built simplifyDom pipeline that strips scripts/styles/SVGs/hidden elements and enforces 15K token budget with 3-stage progressive reduction
- Implemented extractInteractiveElements with full accessible metadata: name, label, role, xpath, CSS selector, data/aria attributes
- Implemented extractSemanticElements for page landmark tree (max 2 levels deep)
- Full monorepo typecheck passes (all 4 packages, 6 tasks)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create DOM crawler using Playwright Page interface** - `759b16b` (feat)
2. **Task 2: Create DOM simplifier and semantic extractor using Cheerio** - `6ef093d` (feat)

## Files Created/Modified
- `packages/core/src/dom/crawler.ts` - crawlPage function: accepts Page + CrawlOptions, returns CrawlResult with concurrent extraction
- `packages/core/src/dom/extractor.ts` - extractInteractiveElements and extractSemanticElements with xpath/CSS selector generation, isUtilityClass helper
- `packages/core/src/dom/simplifier.ts` - simplifyDom: strips non-semantic HTML, cleans utility classes, progressive token budget enforcement
- `packages/core/src/dom/index.ts` - Barrel re-exports for all DOM functions
- `packages/core/src/index.ts` - Added dom/index.js re-export

## Decisions Made
- crawlPage accepts Playwright Page (not Browser) -- keeps core free of browser lifecycle concerns, Phase 3 manages browser pools
- Type-only import for Playwright (`import type { Page }`) -- core has zero runtime dependency on Playwright
- Progressive token budget: 3-stage reduction (prune non-interactive/non-landmark elements, truncate text to 50 chars, drop semantic attributes) ensures output stays under 15K tokens
- isUtilityClass detects Tailwind-like classes via prefix matching and colon-containing responsive modifiers
- XPath generation prioritizes: id > data-testid > name > text content for human readability
- CSS selector generation prioritizes: #id > [data-testid] > tag.class:nth-of-type for specificity

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Cheerio's `AnyNode` type comes from `domhandler` package which isn't directly accessible in pnpm strict mode. Resolved by using `any` type for the DOM node tracking Set in extractSemanticElements (internal implementation detail, not exposed in public API).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- DOM pipeline ready for 02-03 (AI generation): crawlPage produces CrawlResult, simplifyDom produces SimplifiedDom with token budget
- Interactive elements include xpath and cssSelector for locator strategy generation by Claude
- All functions exported from @validater/core: `import { crawlPage, simplifyDom, extractInteractiveElements, extractSemanticElements } from '@validater/core'`
- Functions are pure (no side effects, no browser instantiation) -- safe for use in worker activities

---
*Phase: 02-ai-agent-test-generation*
*Completed: 2026-03-06*
