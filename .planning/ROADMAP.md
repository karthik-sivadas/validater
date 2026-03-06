# Roadmap: Validater

## Overview

Validater delivers an AI-powered web testing platform in 10 phases: starting with infrastructure and auth, building the AI test generation engine and browser execution independently, wiring them together through Temporal workflows, then layering on the frontend, live streaming, video/reporting, CI/CD integration, test suite generation with accessibility, and finally comprehensive platform test coverage. The core product loop -- URL + natural language to visual test results -- is fully functional after Phase 5, with Phases 6-10 adding differentiators and production hardening.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation and Infrastructure** - Monorepo, database, Temporal dev environment, auth, shared types
- [x] **Phase 2: AI Agent -- Test Generation** - DOM grounding, Claude integration, NL-to-test-steps with smart locators
- [x] **Phase 3: Browser Execution Engine** - Playwright execution, screenshots, multi-viewport, browser pool
- [ ] **Phase 4: Workflow Orchestration** - Wire AI + browser into end-to-end Temporal workflows
- [ ] **Phase 5: Frontend -- Dashboard and Results** - TanStack Start app, test creation, results viewer, test history
- [ ] **Phase 6: Live Streaming and Real-Time Updates** - CDP screencast, Redis pub/sub, Hono WebSocket sidecar, live viewer
- [ ] **Phase 7: Video and Reporting** - Debug recording, polished video export, PDF/HTML reports
- [ ] **Phase 8: CI/CD and API Layer** - Public REST API, GitHub Actions integration, webhooks
- [ ] **Phase 9: Test Suite Generation and Accessibility** - Full suite from feature descriptions, axe-core integration
- [ ] **Phase 10: Quality and Coverage** - Tiered test coverage across all platform packages

## Phase Details

### Phase 1: Foundation and Infrastructure
**Goal**: A working monorepo with build pipeline, database, Temporal dev environment, authentication, and shared types -- the base everything else builds on
**Depends on**: Nothing (first phase)
**Requirements**: PLAT-01, PLAT-02
**Success Criteria** (what must be TRUE):
  1. User can sign up with email/password and log in to an authenticated session
  2. User session persists across browser refresh without re-login
  3. Temporal dev server is running and can execute a hello-world workflow with parent-child hierarchy
  4. All monorepo packages build and type-check with a single command
  5. Database migrations run cleanly with Drizzle and schema is queryable
**Plans**: 5 plans

Plans:
- [x] 01-01-PLAN.md -- Scaffold TanStack Start app with shadcn/ui, set up monorepo root (pnpm workspaces + Turborepo)
- [x] 01-02-PLAN.md -- Create internal packages (db, core, worker) with workspace wiring
- [x] 01-03-PLAN.md -- PostgreSQL via Podman, Drizzle ORM schema, database client
- [x] 01-04-PLAN.md -- Better Auth authentication (sign-up, login, session persistence, route protection)
- [x] 01-05-PLAN.md -- Temporal dev environment (Podman, SDK setup, workflow hierarchy spike)

### Phase 2: AI Agent -- Test Generation
**Goal**: Users can provide a URL and natural language description, and the AI agent produces validated, executable test steps grounded in actual page structure
**Depends on**: Phase 1
**Requirements**: TGEN-01, TGEN-02, TGEN-03, TGEN-04, TGEN-05, INFR-04
**Success Criteria** (what must be TRUE):
  1. User can input a URL and plain-English test description and receive structured test steps
  2. Generated test steps reference real DOM elements verified against the live page (not hallucinated selectors)
  3. Each test step includes multiple locator strategies with confidence scores
  4. When a primary locator fails, the system automatically retries with alternative locators
  5. Claude API calls use prompt caching and respect rate limits without errors under concurrent load
**Plans**: 5 plans

Plans:
- [x] 02-01-PLAN.md -- Shared types, Zod schemas, and dependency installation for the AI test generation pipeline
- [x] 02-02-PLAN.md -- DOM crawling and semantic extraction pipeline (Playwright + Cheerio)
- [x] 02-03-PLAN.md -- Claude API integration (AI SDK, prompt engineering, caching, rate limiting, cost tracking)
- [x] 02-04-PLAN.md -- Selector validation and self-healing locator system
- [x] 02-05-PLAN.md -- Generation pipeline orchestrator, Temporal activities, and user-facing server function

### Phase 3: Browser Execution Engine
**Goal**: Generated test steps can be executed against any URL via Playwright across multiple viewports with screenshot capture and resource management
**Depends on**: Phase 1
**Requirements**: TEXE-01, TEXE-02, TEXE-03, TEXE-04, INFR-05
**Success Criteria** (what must be TRUE):
  1. A set of test steps executes against a target URL and produces pass/fail results per step
  2. A screenshot is captured and stored at every test step
  3. Failed steps include clear error details (what was expected vs. what happened)
  4. The same test runs across desktop, tablet, and mobile viewport presets producing separate results
  5. Browser contexts are properly pooled with lifecycle management and no memory leaks over sustained use
**Plans**: 2 plans

Plans:
- [x] 03-01-PLAN.md -- Core execution engine (types, locator mapper extraction, viewport presets, assertions, step runner, step executor)
- [x] 03-02-PLAN.md -- Browser pool with generic-pool, memory monitor, Temporal activities (single + multi-viewport)

### Phase 4: Workflow Orchestration
**Goal**: AI generation and browser execution are wired into end-to-end Temporal workflows that orchestrate the full test pipeline with multi-viewport fan-out
**Depends on**: Phase 2, Phase 3
**Requirements**: INFR-01, INFR-02 (INFR-03 deferred -- architecture supports queue separation via taskQueue param, single queue sufficient for now)
**Success Criteria** (what must be TRUE):
  1. A single server function call triggers the full pipeline: NL input goes to AI generation, then to browser execution, then results are persisted
  2. Multi-viewport test runs fan out to parallel child workflows and aggregate results
  3. Workflow status is queryable in real-time (pending, generating, executing, complete)
  4. Failed activities retry automatically according to policy without losing progress
**Plans**: 3 plans

Plans:
- [ ] 04-01-PLAN.md -- DB schema (test_runs, test_run_results, test_run_steps) and update crawlDom/validateSteps to browser pool
- [ ] 04-02-PLAN.md -- Persist-results activity and parent/child Temporal workflows (test-run + viewport-execution)
- [ ] 04-03-PLAN.md -- Production worker setup, runTest and getTestRunStatus server functions

### Phase 5: Frontend -- Dashboard and Results
**Goal**: Users have a complete web interface to create tests, view results with step-by-step screenshots, and browse test history
**Depends on**: Phase 4
**Requirements**: PLAT-03, TEXE-06, VREP-01
**Success Criteria** (what must be TRUE):
  1. User can enter a URL and test description in a form, submit it, and see the test run progress
  2. User can view step-by-step replay with screenshots and action log after a test completes
  3. User can see an inline test report with pass/fail summary and step details across viewports
  4. User can browse past test runs with filtering and click into any run for detail view
**Plans**: 4 plans

Plans:
- [ ] 05-01: TanStack Start app scaffolding (routing, auth integration, server function wiring, layout)
- [ ] 05-02: Test creation flow (URL + description form, submission, progress indicator)
- [ ] 05-03: Results viewer (step-by-step replay, screenshots, multi-viewport comparison)
- [ ] 05-04: Test history and inline reporting (list view, filtering, pass/fail summary)

### Phase 6: Live Streaming and Real-Time Updates
**Goal**: Users can watch test execution in real-time with a live browser view and synchronized step log
**Depends on**: Phase 5
**Requirements**: TEXE-05
**Success Criteria** (what must be TRUE):
  1. User sees a live browser feed during test execution showing what the browser is doing
  2. Step log updates in real-time alongside the browser feed as each step executes
  3. Stream reconnects automatically if connection drops without losing context
**Plans**: 4 plans

Plans:
- [ ] 06-01: CDP screencast integration in browser workers + Redis pub/sub
- [ ] 06-02: Hono WebSocket sidecar + live viewer component in frontend

### Phase 7: Video and Reporting
**Goal**: Users can get debug video recordings of test runs and export polished videos and reports for sharing
**Depends on**: Phase 5
**Requirements**: VREP-02, VREP-03, VREP-04
**Success Criteria** (what must be TRUE):
  1. Every test run produces a debug video recording viewable in the results page
  2. User can export a polished video with step annotations and trimmed dead time at a selected resolution
  3. User can export test report as PDF or HTML for sharing with stakeholders
**Plans**: 4 plans

Plans:
- [ ] 07-01: Debug video recording (Playwright built-in recording, storage, playback in UI)
- [ ] 07-02: Polished video export (annotations, dead time trimming, resolution selection)
- [ ] 07-03: Report export (PDF and HTML generation from test results)

### Phase 8: CI/CD and API Layer
**Goal**: Engineering teams can trigger test runs programmatically and integrate Validater into their deployment pipelines
**Depends on**: Phase 4
**Requirements**: PLAT-04, PLAT-05
**Success Criteria** (what must be TRUE):
  1. User can trigger a test run via public REST API (TanStack Start server routes or Hono) with URL, description, and viewports
  2. API returns structured results including pass/fail, step details, and links to screenshots
  3. A GitHub Actions workflow can run Validater tests on deploy and report results back to the PR
**Plans**: 4 plans

Plans:
- [ ] 08-01: Public REST API (endpoints, API key management, rate limiting)
- [ ] 08-02: GitHub Actions integration (action definition, webhook support, PR status reporting)

### Phase 9: Test Suite Generation and Accessibility
**Goal**: Users can generate comprehensive test suites from feature descriptions and get accessibility insights on every test run
**Depends on**: Phase 5
**Requirements**: TGEN-06, PLAT-06
**Success Criteria** (what must be TRUE):
  1. User can describe a feature and receive a full test suite covering happy path, edge cases, and error states
  2. User can review, select, and run individual tests from the generated suite
  3. Every test run includes accessibility insights with issues categorized by severity
**Plans**: 4 plans

Plans:
- [ ] 09-01: Test suite generation (feature description to multiple test cases, suite management UI)
- [ ] 09-02: Accessibility integration (axe-core in browser execution, results in report)

### Phase 10: Quality and Coverage
**Goal**: Platform code meets tiered test coverage targets with comprehensive integration testing
**Depends on**: Phase 9
**Requirements**: INFR-06
**Success Criteria** (what must be TRUE):
  1. Business logic modules have 95%+ test coverage
  2. Service layer has 80%+ test coverage
  3. UI components have 60%+ test coverage
  4. Integration tests cover the full pipeline from API call to result persistence
**Plans**: 4 plans

Plans:
- [ ] 10-01: Test infrastructure and coverage tooling (Vitest config, coverage reporters, CI gates)
- [ ] 10-02: Business logic and service tests (95% and 80% targets)
- [ ] 10-03: UI component tests and integration tests (60% target, end-to-end pipeline)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10
Note: Phases 2 and 3 can execute in parallel (both depend only on Phase 1). Phases 6, 7, 8, 9 can partially overlap (different dependency chains).

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation and Infrastructure | 5/5 | Complete | 2026-03-06 |
| 2. AI Agent -- Test Generation | 5/5 | Complete | 2026-03-06 |
| 3. Browser Execution Engine | 2/2 | Complete | 2026-03-06 |
| 4. Workflow Orchestration | 0/3 | Not started | - |
| 5. Frontend -- Dashboard and Results | 0/4 | Not started | - |
| 6. Live Streaming and Real-Time Updates | 0/2 | Not started | - |
| 7. Video and Reporting | 0/3 | Not started | - |
| 8. CI/CD and API Layer | 0/2 | Not started | - |
| 9. Test Suite Generation and Accessibility | 0/2 | Not started | - |
| 10. Quality and Coverage | 0/3 | Not started | - |
