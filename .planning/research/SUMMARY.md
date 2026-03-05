# Project Research Summary

**Project:** Validater
**Domain:** AI-powered web testing platform
**Researched:** 2026-03-06
**Confidence:** MEDIUM-HIGH

## Executive Summary

Validater is an AI-powered web testing platform where users provide a URL and a natural language description, and the system generates, executes, and records test runs across multiple viewports. The expert approach to building this combines Temporal for durable workflow orchestration, Playwright for browser automation, and Claude for AI-driven test generation -- all in a TypeScript monorepo. The architecture follows a "thin API, fat workers" pattern: the web layer handles auth and input validation, then dispatches everything to Temporal workflows that coordinate specialized workers (AI generation, browser execution, video processing). This is not a novel architecture -- Temporal + Playwright for browser automation is a documented pattern with production precedents.

The recommended approach is to build the foundation (monorepo, database, Temporal infrastructure) first, then develop the AI agent and browser execution engine in parallel, wire them together through Temporal workflows, and layer the frontend on top. The core product loop -- URL input to test results -- must work reliably before adding differentiating features like live streaming, video export, or autonomous test discovery. The zero-setup, URL-first entry point is the primary differentiator against competitors like Mabl, testRigor, and Functionize, all of which require project setup or integration before a user can run their first test.

The key risks are: (1) AI hallucination in test generation -- the agent must be grounded in actual DOM state, not imagined page structure, or test quality will be unacceptable; (2) Temporal workflow design mistakes that are expensive to fix later, particularly event history explosion from monolithic workflows; (3) Claude API rate limits blocking concurrent users at organization-wide Tier 1 limits (50 RPM); and (4) Playwright memory leaks from unclosed browser contexts under production load. All four are addressable with upfront design discipline, but none can be safely deferred.

## Key Findings

### Recommended Stack

The stack is TypeScript end-to-end: TanStack Start (React meta-framework) for the web app, Temporal TypeScript SDK for workflow orchestration, Playwright for browser automation, and Pi agent + Anthropic SDK for AI. PostgreSQL with Drizzle ORM for persistence, Better Auth for authentication, S3-compatible storage for videos/screenshots, and Redis for pub/sub streaming. The monorepo uses pnpm workspaces + Turborepo with 5 packages: web, api, temporal, agent, and shared.

**Core technologies:**
- **TanStack Start + Router + Query:** Full-stack React framework with type-safe routing and server state -- chosen over Next.js to avoid Webpack lock-in; RC is API-stable
- **Temporal (TypeScript SDK 1.15.0):** Durable workflow orchestration for test runs, retries, and multi-viewport coordination -- industry standard, mature SDK
- **Playwright 1.58+:** Cross-browser automation with built-in video recording and viewport emulation -- the only serious choice for programmatic browser automation
- **Pi agent + Anthropic SDK:** AI agent runtime for test generation with Claude API access -- Pi is pre-1.0 but lean and composable
- **PostgreSQL + Drizzle ORM:** Relational database for multi-user SaaS with lightweight TypeScript ORM -- handles concurrent writes from multiple test workers
- **Better Auth:** TypeScript-first authentication with OAuth, 2FA, and RBAC -- the clear winner in the 2026 auth space (Lucia deprecated, Auth.js in maintenance mode)

**Risk areas in stack:** DSPy.ts (low maturity, 218 GitHub stars, 40 commits) should be treated as optional -- build a lightweight prompt abstraction directly if needed. Pi agent is pre-1.0 with rapid iteration; pin versions carefully. TanStack Start is RC but API-frozen.

### Expected Features

**Must have (table stakes):**
- Natural language test input -- the entry point; every competitor has this
- AI test path generation from URL + description -- core value proposition
- Test execution engine with self-healing/smart locators -- built-in from day one, not bolted on
- Step-by-step results with screenshots -- visual proof at each step
- Multi-viewport execution (3 presets: desktop, tablet, mobile) -- responsive testing is expected
- Platform authentication and test history -- professional tool basics
- Basic inline test report -- pass/fail summary with details
- CI/CD integration (API layer) -- engineering teams will not adopt without automation capability

**Should have (differentiators):**
- URL-first, zero-setup test generation -- no project config, no recorder, no code; this is THE differentiator
- Test suite generation from feature descriptions -- generate complete suites covering happy path, edge cases, error states
- Live test execution streaming -- dual-pane browser view + step log via WebSocket/CDP screencast
- Video recording (debug mode) -- Playwright built-in recording for failure analysis
- Non-technical stakeholder experience -- plain-language summaries, visual-first reports

**Defer (v2+):**
- Polished video export with annotations and transitions
- Autonomous AI test path discovery (agentic exploration)
- Team collaboration, advanced analytics
- Cross-browser testing (real browsers) -- partner with BrowserStack, do not compete
- Record-and-replay, API testing, full test management, code export -- anti-features that dilute focus

### Architecture Approach

The system is a 4-layer architecture: Presentation (React SPA), API (tRPC + WebSocket gateway), Orchestration (Temporal workflows), and Workers (AI, browser, video). The API layer is intentionally thin -- it validates input, checks auth, and dispatches to Temporal. All business logic lives in Temporal workflows and activities. Workers are separated by type (AI, browser, video) on distinct Temporal task queues for independent scaling. Real-time streaming uses CDP screencast frames published to Redis pub/sub, fanned out through WebSocket gateway to connected clients. State management is split: TanStack Query for frontend server state, Temporal for durable execution state, PostgreSQL for permanent records, S3 for media files.

**Major components:**
1. **React SPA (packages/web)** -- dashboard, test creation, results viewer; talks only to API via tRPC
2. **API Server (packages/api)** -- tRPC routes, auth middleware, WebSocket gateway; dispatches to Temporal
3. **Temporal Workflows (packages/temporal)** -- test run orchestration, multi-viewport fan-out, video processing
4. **AI Agent (packages/agent)** -- test step generation from URL + description; Claude API integration
5. **Shared Types (packages/shared)** -- Zod schemas, TypeScript types, constants shared across all packages

### Critical Pitfalls

1. **Temporal event history explosion** -- monolithic workflows exceed the 51,200 event / 50MB limit and are forcibly terminated. Design a parent-child workflow hierarchy from day one; use Continue-As-New at ~10K events; store large payloads in S3, not activity return values.
2. **AI-generated test hallucinations** -- the agent fabricates selectors and interactions that don't exist on the page. Ground the agent in actual DOM state by crawling and extracting semantic structure first; validate generated selectors against the live page before execution.
3. **Playwright memory leaks** -- unclosed browser contexts accumulate 100-200MB each, crashing workers within hours. Wrap all browser operations in try/finally; implement a browser pool with max lifetime; monitor process.memoryUsage() and handle Temporal cancellation signals.
4. **Claude API rate limits** -- organization-wide Tier 1 limits (50 RPM) block concurrent users. Implement centralized request queuing, prompt caching (cached tokens bypass ITPM limits), model routing (Haiku for simple tasks), and plan for Tier 2 upgrade early.
5. **Unbounded AI cost per user action** -- a single test generation can trigger 20+ API calls costing $2-5 without guardrails. Set hard per-request token budgets, cap API calls per generation, implement cost tracking from day one, and route simple tasks to cheaper models.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation and Infrastructure
**Rationale:** Everything depends on the monorepo structure, database schema, Temporal dev environment, and shared types. The Temporal workflow hierarchy and build pipeline must be correct from the start -- retrofitting is a significant rewrite (Pitfall 8). Monorepo package boundaries directly affect Temporal's workflow sandboxing.
**Delivers:** Working monorepo with pnpm + Turborepo, PostgreSQL schema via Drizzle, Temporal dev environment (Docker), shared types/schemas, auth scaffolding with Better Auth, S3/MinIO setup.
**Addresses:** Platform authentication (table stakes), project structure
**Avoids:** Temporal monorepo build complexity (Pitfall 8), event history explosion by designing workflow hierarchy upfront (Pitfall 1)

### Phase 2: AI Agent -- Test Generation
**Rationale:** The AI agent is the core product differentiator and the highest-risk component. It must be developed and validated before the browser execution engine because the execution engine depends on well-structured test steps. This is also where the central product risk lives (hallucination, Pitfall 2).
**Delivers:** DOM crawling and semantic extraction pipeline, Claude API integration with prompt caching and rate limiting, test step generation from URL + natural language description, step validation against live DOM, cost tracking per request.
**Addresses:** Natural language test input, AI test path generation, self-healing/smart locators (selector strategy)
**Avoids:** AI hallucinations (Pitfall 2), rate limit exhaustion (Pitfall 4), unbounded AI cost (Pitfall 10)

### Phase 3: Browser Execution Engine
**Rationale:** Can be developed in partial parallel with Phase 2 once the test step schema is defined. This phase builds the Playwright execution infrastructure, screenshot capture, and resource management that all subsequent features depend on.
**Delivers:** Playwright activity execution within Temporal, step-by-step results with screenshots, multi-viewport execution (3 presets), browser pool with lifecycle management, basic video recording (debug mode).
**Addresses:** Test execution with results, multi-viewport testing, step-by-step screenshots, video recording (debug)
**Avoids:** Playwright memory leaks (Pitfall 3), video encoding performance impact (Pitfall 6)

### Phase 4: Workflow Orchestration -- Wiring It Together
**Rationale:** With AI generation and browser execution proven independently, this phase wires them into end-to-end Temporal workflows. The parent-child workflow hierarchy for multi-viewport fan-out is implemented here.
**Delivers:** End-to-end test run workflow (generate -> execute -> collect results), multi-viewport fan-out via child workflows, Temporal queries for status, progress reporting via heartbeats, error handling and retry policies.
**Addresses:** Complete test execution pipeline, test history (persistence of results)
**Avoids:** Temporal event history explosion (Pitfall 1), monolithic workflow anti-pattern

### Phase 5: Frontend -- Dashboard and Results
**Rationale:** The frontend depends on the API existing (Phase 1) and the full test pipeline working (Phase 4). Building it after the backend is complete ensures realistic data flows and avoids throwaway UI work.
**Delivers:** TanStack Start app with routing and auth, test creation form (URL + description input), results viewer with step-by-step screenshots, test history list with filtering, basic inline test report, multi-viewport comparison view.
**Addresses:** All presentation-layer table stakes features, non-technical stakeholder experience, basic test report
**Avoids:** UX pitfalls (no progress indication, raw AI output display, unhelpful error messages)

### Phase 6: Live Streaming and Real-Time Updates
**Rationale:** Live execution viewing is a high-value differentiator but architecturally complex (CDP screencast, Redis pub/sub, WebSocket gateway). It depends on browser execution (Phase 3) and frontend (Phase 5) being complete. Deferring it avoids the streaming architecture mismatch pitfall (Pitfall 5) by building on a solid foundation.
**Delivers:** CDP screencast integration in browser workers, Redis pub/sub for frame distribution, WebSocket gateway in API server, live browser viewer in frontend with reconnection logic, SSE fallback for test progress updates.
**Addresses:** Live test execution viewing (differentiator)
**Avoids:** Real-time streaming architecture mismatch (Pitfall 5)

### Phase 7: CI/CD Integration and API Layer
**Rationale:** Engineering teams need automation. The API must be designed API-first from Phase 1 but the polished CI/CD integration can come after core features are stable.
**Delivers:** Public API for test triggering and result retrieval, webhook support, GitHub Actions integration, CLI runner, API key management.
**Addresses:** CI/CD integration (table stakes)

### Phase 8: Advanced Features
**Rationale:** These features build on validated core functionality and should only be prioritized after product-market fit signals.
**Delivers:** Test suite generation from feature descriptions, test report export (PDF/HTML), polished video export pipeline, accessibility insights (axe-core integration).
**Addresses:** Test suite generation, report export, polished video, accessibility insights

### Phase Ordering Rationale

- **Foundation first** because Temporal's monorepo build requirements and workflow hierarchy design are the most expensive mistakes to fix later. Every other phase depends on this being right.
- **AI before browser execution** because the test step schema (output of AI, input of browser) is the critical contract. Getting AI generation quality right determines whether the product is useful at all.
- **Backend before frontend** because building UI against unstable APIs creates throwaway work. The API stabilizes through Phases 1-4; the frontend builds against a mature API in Phase 5.
- **Streaming deferred to Phase 6** because it is high-complexity, high-infrastructure-cost, and not required for the core value proposition. Users can view results after execution completes. Streaming is a demo-impressive differentiator, not a launch requirement.
- **CI/CD deferred to Phase 7** because it requires API stability. Designing the API-first architecture in Phase 1 ensures this is possible; building the integration can wait.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (AI Agent):** Highest product risk. Needs research into DOM extraction strategies, prompt engineering for test generation, selector validation approaches, and cost modeling per test generation. Pi agent integration patterns are sparsely documented (pre-1.0).
- **Phase 4 (Workflow Orchestration):** Temporal parent-child workflow patterns, Continue-As-New implementation, and worker versioning need concrete spike work. Well-documented in Temporal docs but application-specific design decisions required.
- **Phase 6 (Live Streaming):** CDP screencast + Redis pub/sub + WebSocket architecture has few production references. The Vercel agent-browser project is the closest precedent. Needs prototyping.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** Monorepo setup, Drizzle ORM, Better Auth, Docker -- all well-documented with established patterns.
- **Phase 3 (Browser Execution):** Playwright automation is extensively documented. Video recording API is stable. Browser pool patterns are well-known.
- **Phase 5 (Frontend):** TanStack ecosystem is well-documented. shadcn/ui has comprehensive component library. Standard React SPA patterns.
- **Phase 7 (CI/CD):** API design, GitHub Actions, webhooks -- all standard patterns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Core stack (TanStack, Temporal, Playwright, PostgreSQL) is HIGH confidence. AI layer (Pi agent, DSPy.ts) is MEDIUM -- Pi is pre-1.0, DSPy.ts may be too immature. |
| Features | MEDIUM-HIGH | Table stakes well-validated against competitor landscape. Differentiator value (URL-first, zero-setup) is a hypothesis that needs market validation. |
| Architecture | HIGH | Temporal + Playwright pattern is documented with production precedents. Layer separation and data flow are standard. CDP screencast streaming is the least-documented component. |
| Pitfalls | HIGH | All critical pitfalls verified against official documentation and practitioner reports. Temporal limits, Playwright memory, and Claude rate limits are hard constraints with known numbers. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **DSPy.ts viability:** Low commit count and unclear development status. Decision needed: adopt, build lightweight alternative, or skip prompt optimization entirely for v1. Recommend building a minimal prompt abstraction directly (~500 lines) rather than taking the dependency.
- **Pi agent stability:** Pre-1.0 with rapid iteration. Need to evaluate whether Vercel AI SDK (more established, has Temporal integration) is a safer choice despite being less opinionated about agent patterns.
- **TanStack Start RC stability:** API is frozen but 1.0 has not shipped. Fallback plan exists (Vite + TanStack Router SPA + Hono API), but migration cost is non-trivial. Monitor closely during Phase 1.
- **Cost modeling:** No concrete data on per-test-generation cost with Claude. Need to build a cost model during Phase 2 spike work: how many API calls, how many tokens, what cache hit rate is achievable.
- **Temporal Cloud vs self-hosted:** Cost/ops tradeoff not resolved. Self-hosted Docker for development is clear; production decision can be deferred to Phase 4 but should be spiked.
- **Live streaming at scale:** CDP screencast + Redis + WebSocket has no well-documented production deployment at scale. Phase 6 needs a prototype/spike before committing to the architecture.

## Sources

### Primary (HIGH confidence)
- [Temporal TypeScript SDK docs](https://docs.temporal.io/develop/typescript) -- workflow patterns, versioning, system limits
- [Temporal system limits](https://docs.temporal.io/cloud/limits) -- 51,200 events, 50MB history hard limits
- [Playwright documentation](https://playwright.dev/docs/videos) -- video recording, browser contexts, viewport emulation
- [Anthropic rate limits](https://platform.claude.com/docs/en/api/rate-limits) -- tier limits, token counting, caching
- [TanStack Start docs](https://tanstack.com/start/latest/docs/framework/react/overview) -- framework capabilities, RC status
- [Better Auth](https://better-auth.com/) -- v1.5.3, Drizzle adapter, plugin ecosystem
- [Drizzle ORM](https://orm.drizzle.team/) -- v0.45.1, PostgreSQL adapter

### Secondary (MEDIUM confidence)
- [Temporal + Browserbase architecture](https://www.browserbase.com/blog/temporal-browserbase) -- Temporal + browser automation patterns
- [Vercel agent-browser](https://deepwiki.com/vercel-labs/agent-browser/6.2-screencasting-and-live-preview) -- CDP screencast architecture
- [Pi-mono GitHub](https://github.com/badlogic/pi-mono) -- agent framework, v0.56.1
- [Competitor analysis](https://www.virtuosoqa.com/post/best-ai-testing-tools) -- Mabl, testRigor, Functionize, QA Wolf feature comparison
- [Applitools AI testing analysis](https://applitools.com/blog/ai-testing-strategy-in-2026/) -- AI test hallucination rates

### Tertiary (LOW confidence)
- [DSPy.ts GitHub](https://github.com/ruvnet/dspy.ts) -- v2.1, 218 stars, maturity uncertain; needs validation before adoption

---
*Research completed: 2026-03-06*
*Ready for roadmap: yes*
