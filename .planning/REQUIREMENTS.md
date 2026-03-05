# Requirements: Validater

**Defined:** 2026-03-06
**Core Value:** Users can describe what to test in plain English, point at any URL, and get comprehensive test execution with visual proof — no test code required.

## v1 Requirements

### Test Generation

- [ ] **TGEN-01**: User can input test description in natural language
- [ ] **TGEN-02**: AI agent converts NL description to executable test steps with reasoning
- [ ] **TGEN-03**: AI uses DOM grounding (real page structure) to generate accurate steps
- [ ] **TGEN-04**: Smart locators use multiple strategies (text, aria, CSS, XPath) with confidence scoring
- [ ] **TGEN-05**: Self-healing retries with alternative locator when primary fails
- [ ] **TGEN-06**: User can generate full test suite from feature description (happy path + edge cases + error states)

### Test Execution

- [ ] **TEXE-01**: Execute generated test steps against target URL via Playwright
- [ ] **TEXE-02**: Capture screenshot at each test step
- [ ] **TEXE-03**: Report pass/fail per step with error details on failure
- [ ] **TEXE-04**: Execute tests across 3+ viewport presets (desktop 1920x1080, tablet 768x1024, mobile 375x812)
- [ ] **TEXE-05**: Live browser stream via CDP screencast during execution
- [ ] **TEXE-06**: Step-by-step replay with synchronized screenshots and action log after execution

### Video & Reporting

- [ ] **VREP-01**: Inline test report with pass/fail summary, step details, and screenshots
- [ ] **VREP-02**: Export test report as PDF or HTML
- [ ] **VREP-03**: Debug video recording of test execution (Playwright built-in)
- [ ] **VREP-04**: Polished video export with step annotations, trimmed dead time, selectable resolution

### Platform

- [ ] **PLAT-01**: User sign-up and login with email/password (Better Auth)
- [ ] **PLAT-02**: User session persistence across browser refresh
- [ ] **PLAT-03**: Test history with list of past runs, filtering, and detail view
- [ ] **PLAT-04**: CI/CD integration via REST API for triggering test runs programmatically
- [ ] **PLAT-05**: GitHub Actions integration for running tests on deploy
- [ ] **PLAT-06**: Basic accessibility insights via axe-core integration on test runs

### Infrastructure

- [ ] **INFR-01**: Temporal orchestrates full pipeline (agent reasoning → test execution → video generation)
- [ ] **INFR-02**: Temporal workflow hierarchies to stay within event history limits
- [ ] **INFR-03**: Separate Temporal task queues per worker type (AI, browser, video)
- [ ] **INFR-04**: Claude API rate limiting with prompt caching for throughput
- [ ] **INFR-05**: Browser pool with lifecycle management and memory monitoring
- [ ] **INFR-06**: Tiered test coverage (95% business logic, 80% services, 60% UI components)

## v2 Requirements

### Discovery & Collaboration

- **DISC-01**: AI test path discovery — autonomous exploration of application to find testable paths
- **DISC-02**: Team collaboration — shared workspaces, comments, assignments
- **DISC-03**: Advanced analytics — failure rate trends, flakiness scoring, coverage estimation
- **DISC-04**: CI/CD plugins beyond GitHub Actions (Jenkins, CircleCI, GitLab)
- **DISC-05**: Visual regression testing via Percy/Applitools integration

## Out of Scope

| Feature | Reason |
|---------|--------|
| Cross-browser testing (real browsers) | BrowserStack's moat; Chromium viewport emulation covers 90%+ of use cases |
| Record-and-replay test creation | Produces brittle tests; opposite of AI-powered approach |
| Built-in API testing | Different domain (Postman/Bruno); dilutes focus |
| Full test management suite | TestRail/Zephyr territory; export-compatible instead |
| Code export / script generation | Maintenance burden; keep tests as platform artifacts |
| Real device testing | Capital-intensive; mobile viewport emulation sufficient |
| Native app testing | Web-only platform |
| Pixel-level visual regression | Applitools' multi-year moat; integrate don't build |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TGEN-01 | TBD | Pending |
| TGEN-02 | TBD | Pending |
| TGEN-03 | TBD | Pending |
| TGEN-04 | TBD | Pending |
| TGEN-05 | TBD | Pending |
| TGEN-06 | TBD | Pending |
| TEXE-01 | TBD | Pending |
| TEXE-02 | TBD | Pending |
| TEXE-03 | TBD | Pending |
| TEXE-04 | TBD | Pending |
| TEXE-05 | TBD | Pending |
| TEXE-06 | TBD | Pending |
| VREP-01 | TBD | Pending |
| VREP-02 | TBD | Pending |
| VREP-03 | TBD | Pending |
| VREP-04 | TBD | Pending |
| PLAT-01 | TBD | Pending |
| PLAT-02 | TBD | Pending |
| PLAT-03 | TBD | Pending |
| PLAT-04 | TBD | Pending |
| PLAT-05 | TBD | Pending |
| PLAT-06 | TBD | Pending |
| INFR-01 | TBD | Pending |
| INFR-02 | TBD | Pending |
| INFR-03 | TBD | Pending |
| INFR-04 | TBD | Pending |
| INFR-05 | TBD | Pending |
| INFR-06 | TBD | Pending |

**Coverage:**
- v1 requirements: 28 total
- Mapped to phases: 0
- Unmapped: 28 ⚠️

---
*Requirements defined: 2026-03-06*
*Last updated: 2026-03-06 after initial definition*
