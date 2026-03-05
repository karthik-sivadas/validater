# Pitfalls Research

**Domain:** AI-powered testing platform (Temporal + Claude API + Playwright + real-time streaming)
**Researched:** 2026-03-06
**Confidence:** HIGH (verified against official Temporal docs, Anthropic rate limit docs, Playwright docs, and multiple practitioner sources)

## Critical Pitfalls

### Pitfall 1: Temporal Event History Explosion

**What goes wrong:**
Each test execution workflow accumulates events (activity starts, completions, signals for progress updates, timer firings). A test suite with many steps across multiple viewports can easily blow past Temporal's hard limits: 51,200 events or 50MB total history size. When either limit is hit, the workflow is forcibly terminated with an unrecoverable error, losing all in-progress test results.

**Why it happens:**
Developers model the entire test pipeline -- AI generation, browser launch, multi-viewport execution, video encoding, result aggregation -- as a single monolithic workflow. Every activity call, signal, and timer adds events. Multi-viewport tests multiply this linearly. Logging progress via signals compounds the problem further.

**How to avoid:**
- Design a workflow hierarchy: a parent "test suite" workflow spawns child workflows per viewport or per test case. Each child has its own event history.
- Use Continue-As-New for any workflow that processes unbounded items (e.g., iterating through test steps). Set a Continue-As-New threshold at ~10,000 events.
- Store large payloads (screenshots, video files, DOM snapshots) in external storage (S3/R2) and pass only references through Temporal. Activity return values larger than 1-2MB consume history rapidly.
- Drain all pending signals before Continue-As-New -- unprocessed signals are lost during the transition.

**Warning signs:**
- Workflow history size growing beyond 5,000 events in development
- Activity return payloads containing base64-encoded images or video data
- Single workflow handling more than 3 viewports
- `schedule_to_start_latency` increasing as histories grow (replay overhead)

**Phase to address:**
Foundation/Infrastructure phase. The workflow hierarchy must be designed correctly from day one. Retrofitting Continue-As-New into a monolithic workflow is a significant rewrite.

**Confidence:** HIGH -- verified against [Temporal official blog on long-running workflows](https://temporal.io/blog/very-long-running-workflows) and [Temporal system limits](https://docs.temporal.io/cloud/limits).

---

### Pitfall 2: AI-Generated Test Hallucinations and Non-Determinism

**What goes wrong:**
The AI agent generates test steps that reference non-existent UI elements, fabricate expected values, or produce logically correct but functionally wrong interactions. A test might assert that a button labeled "Submit Order" exists when the actual label is "Place Order." Worse, the same prompt produces different test steps on each run, making test suites inherently flaky even before execution begins.

**Why it happens:**
LLMs lack ground truth about the target application's DOM. They generate plausible test steps based on training data patterns, not the actual page content. Without explicit grounding in the live page structure, hallucination rates increase sharply with application complexity -- GPT-4 class models show approximately 25% accuracy degradation moving from simple to complex test scenarios.

**How to avoid:**
- Ground the AI agent in actual DOM state: crawl the target URL first, extract semantic structure (headings, buttons, forms, links), and include this as context in the prompt. Never let the AI "imagine" what the page looks like.
- Implement a validation layer between generation and execution: parse generated test steps, verify referenced selectors exist in the DOM before running them.
- Use deterministic test step templates where possible (e.g., "click button with text X" rather than free-form instructions). Let the AI fill in parameters, not invent interaction patterns.
- Pin prompt versions and use prompt caching to reduce variability across runs.
- Implement a confidence score for generated steps -- if the AI is uncertain about a selector, flag it for human review rather than executing blindly.

**Warning signs:**
- Test pass rates below 60% on first execution of AI-generated tests
- Selectors in generated tests that don't match any DOM elements
- Tests that pass on retry without code changes (non-determinism masquerading as flakiness)
- Increasing prompt length as developers add more "please don't hallucinate" instructions

**Phase to address:**
Core AI Agent phase. This is the central product risk. Build the DOM-grounding pipeline before building the test generation pipeline. Validate that generated tests are structurally sound before building the execution engine.

**Confidence:** HIGH -- corroborated by [Applitools 2026 AI testing analysis](https://applitools.com/blog/ai-testing-strategy-in-2026/), [Parasoft testing trends](https://www.parasoft.com/blog/annual-software-testing-trends/), and multiple practitioner reports.

---

### Pitfall 3: Playwright Memory Leaks at Scale

**What goes wrong:**
Each browser context consumes 50-200MB of memory. Running tests across multiple viewports means multiple concurrent browser contexts. If contexts or pages are not properly closed in error paths, "zombie" browser processes accumulate. Within hours, a worker running continuous test executions exhausts available memory, crashes, and loses in-progress results.

**Why it happens:**
Happy-path code calls `context.close()` and `browser.close()`, but error paths -- timeout exceptions, network failures, Temporal activity cancellations -- skip cleanup. Each leaked context keeps its entire DOM tree, JavaScript heap, and network buffers in memory. The problem is invisible in development (single test runs) and only manifests in production under load.

**How to avoid:**
- Wrap ALL browser operations in try/finally blocks that guarantee context and page cleanup. Never rely on garbage collection.
- Implement a browser pool with maximum lifetime per context (e.g., recycle after 5 test executions or 10 minutes, whichever comes first).
- Set per-worker memory limits and monitor `process.memoryUsage()`. Implement graceful shutdown when memory exceeds 80% of allocated limit.
- Use separate browser contexts (not separate browser instances) for viewport isolation -- contexts within a single browser share the browser process, reducing overhead.
- Handle Temporal activity cancellation signals explicitly to trigger browser cleanup.

**Warning signs:**
- Worker memory usage climbing steadily over hours without dropping
- Browser process count on the host exceeding expected concurrent test count
- Tests timing out more frequently as the day progresses
- OOM kills in container orchestration logs

**Phase to address:**
Browser Execution phase. Build the resource management and cleanup infrastructure before scaling to parallel execution. The browser pool pattern should be in place before multi-viewport testing is attempted.

**Confidence:** HIGH -- verified against [Playwright GitHub issue #15400](https://github.com/microsoft/playwright/issues/15400), [Playwright GitHub issue #28942](https://github.com/microsoft/playwright/issues/28942), and [practitioner production experience](https://medium.com/@onurmaciit/8gb-was-a-lie-playwright-in-production-c2bdbe4429d6).

---

### Pitfall 4: Claude API Rate Limits Blocking Concurrent Users

**What goes wrong:**
Rate limits are per-organization, not per-user. At Tier 1, you get 50 RPM and 30,000 input tokens per minute for Sonnet models. With the AI agent making multiple API calls per test generation (page analysis, step generation, step refinement), a single user's test suite can consume the entire rate limit. Two concurrent users cause 429 errors and failed test generations.

**Why it happens:**
Developers build against the API in single-user development and never hit limits. They don't implement queuing, backoff, or request budgeting. When production traffic arrives, the organization-wide rate limit becomes a hard ceiling that no amount of horizontal scaling can overcome.

**How to avoid:**
- Implement a centralized API request queue with rate-aware scheduling. Use Temporal activities with rate limiting (Temporal supports activity-level rate limiting natively).
- Budget tokens per test generation request. Set hard maximums: e.g., 4,000 input tokens for page context, 2,000 output tokens for generated steps.
- Use prompt caching aggressively -- cached input tokens do NOT count against ITPM rate limits. Cache system prompts, tool definitions, and page analysis templates. With 80% cache hit rate, effective throughput increases 5x.
- Use Haiku 4.5 for simple tasks (step validation, selector extraction) and reserve Sonnet/Opus for complex reasoning (test path generation). Rate limits are per-model, so you get separate pools.
- Plan for Tier 2 ($40 credit purchase) early -- the jump from 50 RPM to 1,000 RPM is critical for any multi-user scenario.
- Implement the Batch API for non-interactive workloads (e.g., generating test suites in bulk) -- separate rate limits, 50% cost reduction.

**Warning signs:**
- 429 responses in API logs during testing with more than 1-2 concurrent users
- Test generation latency spiking unpredictably
- Token usage per request exceeding 10,000 (you're sending too much context)
- No prompt caching headers in API responses (missed optimization)

**Phase to address:**
Core AI Agent phase for basic rate limiting. Dedicated optimization phase for caching, batching, and model routing. This must be architected before any public beta.

**Confidence:** HIGH -- verified against [official Anthropic rate limits documentation](https://platform.claude.com/docs/en/api/rate-limits).

---

### Pitfall 5: Real-Time Browser Streaming Architecture Mismatch

**What goes wrong:**
Teams build WebSocket-based live browser streaming (via Hono sidecar or similar) that works in development but fails in production: connections drop during long test runs (load balancer timeouts, typically 60 seconds of idle), reconnecting clients miss intermediate state (test steps 4-7 while disconnected), and horizontal scaling breaks because WebSocket connections are stateful and pinned to specific server instances.

**Why it happens:**
WebSocket connections don't automatically reconnect. They require sticky sessions at the load balancer. State synchronization across reconnections requires explicit message buffering and replay. None of this is needed in single-server development.

**How to avoid:**
- Consider Server-Sent Events (SSE) from TanStack Start server routes instead of WebSockets for test progress updates. SSE is simpler, auto-reconnects natively, and works through CDNs and proxies without sticky sessions. Reserve Hono WebSocket sidecar only for high-frequency binary data (CDP screencast frames).
- If using the Hono WebSocket sidecar: implement heartbeat pings (every 30 seconds), exponential backoff reconnection, and a message buffer that replays missed events on reconnect.
- Store test execution state in the database (or Temporal query), not in the Hono sidecar's WebSocket session. On reconnect, the client fetches current state via server functions, then re-subscribes to live updates. This is the "state sync" pattern.
- Use Temporal queries for current workflow state (via server functions) rather than building a separate real-time state system. The workflow itself is the source of truth.

**Warning signs:**
- "Connection lost" errors in browser console during test runs longer than 60 seconds
- Frontend showing stale test progress after network blips
- Architecture diagrams showing WebSocket server as the source of truth for test state
- Load balancer configuration requiring sticky sessions

**Phase to address:**
Frontend/Streaming phase. Design the state synchronization pattern before implementing the streaming UI. The Temporal query approach should be evaluated during the workflow design phase.

**Confidence:** MEDIUM -- based on [Ably WebSocket best practices](https://ably.com/topic/websocket-architecture-best-practices) and [WebSocket reconnection patterns](https://oneuptime.com/blog/post/2026-01-27-websocket-reconnection-logic/view). SSE recommendation is well-established but Temporal query integration specifics need validation.

---

### Pitfall 6: Video Recording Killing Test Execution Performance

**What goes wrong:**
Playwright's built-in video recording uses VP8 encoding at 1Mbit/s with FFmpeg, consuming one CPU thread at 50% target usage per recording. With 3 viewports recording simultaneously, video encoding consumes 1.5 CPU cores. On a 2-core worker, this leaves half a core for actual test execution, causing timeouts, missed interactions, and flaky tests that only fail when recording is enabled.

**Why it happens:**
Video recording overhead is negligible for a single test but multiplicative across concurrent viewports. Developers test with recording disabled (fast) and enable it for production (slow), creating a performance gap that manifests as mysterious flakiness.

**How to avoid:**
- Separate recording from execution: run tests first with screenshot capture at each step, then assemble screenshots into video post-execution using a dedicated encoding worker. This eliminates encoding overhead during the critical test execution window.
- If real-time video is required (live browser stream), use lower-resolution recording during execution (e.g., 720p) and offer high-resolution re-recording as an optional post-execution step.
- Size Temporal workers for video workload: allocate at least 1 CPU core per concurrent video recording. A worker handling 3 viewports needs at minimum 4 cores (3 for video + 1 for test execution).
- Use `retain-on-failure` recording mode during development to avoid unnecessary encoding overhead.
- Consider two distinct video products: "quick recording" (Playwright's built-in, lower quality, immediate) and "polished export" (post-processing pipeline with FFmpeg, higher quality, async).

**Warning signs:**
- Tests passing without video but failing with video enabled
- CPU utilization above 80% on workers during video recording
- Test step timing increasing 2-3x when recording is active
- Video files with dropped frames or frozen sections

**Phase to address:**
Video/Recording phase. But worker sizing decisions must account for video overhead from the Infrastructure phase. Do not promise "video recording" without budgeting the CPU and memory cost.

**Confidence:** HIGH -- verified against [Playwright video documentation](https://playwright.dev/docs/videos) and [Playwright video performance issue #8683](https://github.com/microsoft/playwright/issues/8683).

---

### Pitfall 7: The 100% Test Coverage Trap

**What goes wrong:**
Teams spend 40% of development time writing tests for the last 10% of coverage -- getters/setters, error message formatting, framework boilerplate, type guards. These tests add no meaningful quality signal. Worse, high coverage numbers create false confidence: 100% line coverage doesn't mean 100% behavior coverage. Critical integration paths (Temporal workflow + Claude API + Playwright) remain untested while unit test coverage is "complete."

**Why it happens:**
Coverage is easy to measure and hard to argue against. "100% coverage" sounds like a quality bar but actually measures effort, not effectiveness. The most valuable tests (integration tests, end-to-end workflow tests) are the hardest to write and often excluded from coverage metrics.

**How to avoid:**
- Define coverage targets by layer: 95%+ for business logic and domain models, 80%+ for API handlers and services, 60%+ for UI components (visual testing covers more), integration test coverage for all critical paths regardless of line count.
- Explicitly exclude from coverage: generated code, type definitions, configuration files, framework boilerplate, pure delegation methods.
- Measure what matters: "Can a user submit a URL and get test results?" is one integration test worth more than 50 unit tests of internal helpers.
- Use mutation testing on critical modules to validate test quality, not just coverage quantity.
- Set the project constraint as "comprehensive test coverage" not "100% line coverage" -- this allows pragmatic decisions about where tests add value.

**Warning signs:**
- Developers writing tests for trivial code to hit coverage numbers
- Coverage tool showing 95%+ but integration tests failing regularly
- Test suite taking 20+ minutes to run (too many low-value tests)
- PRs blocked on coverage for boilerplate changes

**Phase to address:**
Every phase. Establish the coverage policy in the Foundation phase. Each subsequent phase should define its own coverage targets by component type. Do not set a blanket "100%" rule.

**Confidence:** HIGH -- this is well-documented in testing literature. Sources: [TestDevLab coverage analysis](https://www.testdevlab.com/blog/full-test-coverage-explained), [NDepend coverage analysis](https://blog.ndepend.com/aim-100-percent-test-coverage/).

---

### Pitfall 8: Temporal Monorepo Build and Deploy Complexity

**What goes wrong:**
Temporal TypeScript workers require workflow code to be bundled separately from activity code (workflows run in a sandboxed V8 isolate). In a monorepo with shared packages, the bundler (Webpack) attempts to resolve cross-package imports and fails, producing cryptic errors like "Cannot find module './src/temporal/workflows.ts'". Worse, deploying worker updates requires careful versioning -- if old and new workers process the same workflow simultaneously with incompatible changes, workflows fail mid-execution.

**Why it happens:**
Temporal's TypeScript SDK uses a custom module resolution system for workflow sandboxing that conflicts with monorepo tooling (Nx, Turborepo, pnpm workspaces). Path aliases from tsconfig don't work inside the workflow bundle. Teams discover this only after the monorepo structure is established, forcing painful refactoring.

**How to avoid:**
- Use Temporal's prebuild workflow bundles approach: compile workflow code into a standalone bundle during the build step, then load the bundle at worker startup. This bypasses runtime module resolution issues.
- Structure the monorepo with explicit boundaries: `packages/temporal-workflows/` (workflow code only, no external imports except Temporal SDK), `packages/temporal-activities/` (activity implementations, can import anything), `packages/temporal-workers/` (worker startup, loads bundles).
- Use `tsc-alias` to resolve path aliases post-compilation since `tsc` does not resolve tsconfig paths.
- Adopt Temporal's Worker Versioning (GA expected Q4 2025) to safely deploy worker updates without affecting in-flight workflows. Until then, use the workflow-level versioning pattern with `patched()`.
- Avoid sharing runtime code between workflows and the rest of the application. Shared types are fine; shared services/utilities are not (they pull in dependencies that break the sandbox).

**Warning signs:**
- Build errors mentioning "Cannot find module" in workflow files
- Workers crashing on startup with "Cannot use import statement outside a module"
- Workflow replays failing after worker code updates
- Monorepo build times increasing dramatically due to Temporal bundling

**Phase to address:**
Foundation/Infrastructure phase. The monorepo structure and Temporal build pipeline must be correct from the start. Changing it later requires touching every workflow and activity file.

**Confidence:** HIGH -- verified against [Temporal TypeScript SDK docs on versioning](https://docs.temporal.io/develop/typescript/versioning), [Nx monorepo integration guide](https://andreas.fyi/writing/temporal-io-nx-monorepo), and [Temporal community discussions](https://community.temporal.io/t/using-temporal-with-nx-monorepo/5228).

---

### Pitfall 9: Viewport Emulation False Confidence

**What goes wrong:**
Playwright's viewport emulation sets screen dimensions and user agent strings but uses the host browser's rendering engine, not the target device's. CSS features, font rendering, touch interactions, safe area insets, and notch padding behave differently on real devices. Tests pass in emulation but users report broken layouts on actual mobile devices. The platform reports "all viewports pass" while real-world rendering is broken.

**Why it happens:**
Viewport emulation is a geometry simulation, not a device simulation. It correctly tests responsive breakpoint triggering (media queries firing at the right widths) but cannot test rendering engine differences (Safari's flexbox quirks, Android Chrome's font scaling, iOS safe-area-inset behavior). Teams treat viewport emulation as equivalent to device testing.

**How to avoid:**
- Be honest in the product about what viewport testing covers: "responsive layout verification" not "device testing." Do not imply that passing viewport tests means the app works on real devices.
- Test responsive breakpoints (layout changes at specific widths) -- this IS reliable with emulation.
- Do not test: touch-specific interactions (pinch/zoom, swipe), device-specific CSS (safe-area-inset, -webkit- prefixes behaving differently), font rendering differences, scroll performance.
- For v1, position viewport testing as "responsive layout verification" and plan real device integration (BrowserStack, Sauce Labs) as a v2 feature.
- Document known limitations for users: "Viewport testing verifies your layout responds to different screen sizes. It does not test device-specific rendering behaviors."

**Warning signs:**
- Product marketing claiming "mobile device testing" when using viewport emulation
- Bug reports about layouts that "pass all tests" but look wrong on real phones
- Tests checking pixel-perfect rendering rather than structural layout
- No disclaimers in the UI about emulation limitations

**Phase to address:**
Cross-viewport testing phase. Define the scope of viewport testing clearly in the product design, not retroactively after users complain about false results.

**Confidence:** HIGH -- verified against [BrowserStack viewport guide](https://www.browserstack.com/guide/viewport-responsive) and standard browser emulation limitations.

---

### Pitfall 10: Unbounded AI Cost Per User Action

**What goes wrong:**
A single user action ("test this URL") triggers an unbounded chain of AI API calls: page analysis, test path generation, step refinement, selector verification, assertion generation, failure analysis, retry reasoning. Without cost controls, a complex page can trigger 20+ API calls costing $2-5 per test generation. At scale, a single power user running test suites hourly can generate $100+/day in API costs, destroying unit economics.

**Why it happens:**
AI agent architectures naturally recurse: the agent analyzes a page, finds it complex, breaks it into sub-tasks, each sub-task discovers more complexity. Without explicit depth limits and token budgets, the agent "thinks" as long as it needs to, consuming tokens proportionally. Developers focus on quality (more AI reasoning = better tests) without cost guardrails.

**How to avoid:**
- Set hard per-request token budgets: maximum input tokens (page context), maximum output tokens (generated steps), maximum API calls per test generation (e.g., cap at 5 calls).
- Implement a cost-tracking middleware that accumulates per-user, per-session costs and enforces limits. Expose cost estimates to users before execution ("This test suite will cost approximately X credits").
- Use model routing: Haiku 4.5 for simple tasks (selector extraction, step validation) at 1/10th the cost of Sonnet. Reserve Sonnet/Opus for complex reasoning only.
- Cache page analysis results. If the same URL is tested multiple times, reuse the DOM analysis rather than re-analyzing with the AI.
- Implement a credit/usage system from day one, even for internal testing. This forces cost awareness into every feature decision.

**Warning signs:**
- No per-request cost tracking in place
- AI agent making more than 5 API calls for a single test case
- Average cost per test generation exceeding $0.50
- No distinction between "simple" and "complex" test generation paths

**Phase to address:**
Core AI Agent phase for basic budgeting. Pricing/Billing phase for user-facing cost controls. This must be designed before public launch -- retroactively adding cost limits to an agent that users expect to be unlimited is a product and engineering nightmare.

**Confidence:** HIGH -- based on [Anthropic API pricing documentation](https://platform.claude.com/docs/en/api/rate-limits) and well-documented LLM cost management patterns.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Monolithic Temporal workflow (one workflow = entire test run) | Simpler initial implementation | Event history explosion, impossible to scale multi-viewport | Never -- design hierarchy from day one |
| Storing screenshots/videos as Temporal activity return values | No external storage dependency | History size blowup, replay performance degradation | Never -- use object storage from the start |
| Synchronous video encoding during test execution | Simpler pipeline, immediate video availability | Test execution slowdown, flaky tests, CPU contention | MVP only, with documented plan to move to async |
| Hardcoded Claude model (always Sonnet) | Simpler code, one model to test | 10x cost premium on tasks Haiku could handle | MVP only -- implement model routing within 2 phases |
| No prompt caching | Simpler API calls | 5x higher effective rate limit consumption, higher costs | First 2 weeks of development only |
| Frontend polling instead of streaming | Simpler to implement | Poor UX for long test runs, unnecessary server load | Acceptable for MVP, replace before beta |
| Single worker type for all tasks | Simpler deployment | CPU-heavy video encoding starves IO-heavy browser tasks | MVP with <10 concurrent users only |
| Coverage exclusions not configured | No setup needed | Coverage reports full of noise, false 100% claims | Never -- configure exclusions in the first sprint |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Claude API | Sending entire page HTML as context (huge token cost, often exceeds context window) | Extract semantic DOM structure: headings, buttons, forms, links, ARIA labels. Send structured summary, not raw HTML |
| Claude API | Not using prompt caching for repeated system prompts | Cache system prompt + tool definitions (these are identical across requests). Only uncached tokens count against ITPM limits |
| Temporal + Playwright | Running browser inside Temporal workflow function | Browser operations MUST be in activities, not workflows. Workflows must be deterministic -- browser interactions are inherently non-deterministic |
| Temporal signals | Using signals for high-frequency progress updates (every test step) | Use Temporal queries for current state, signals for commands. High-frequency signals bloat event history |
| Playwright + Video | Using `browser.newPage()` for each viewport instead of `browser.newContext()` | Use separate contexts per viewport. Contexts share browser process (less memory) and provide proper isolation |
| Hono Sidecar + Temporal | Building a separate state management system in the Hono sidecar alongside Temporal | Query Temporal workflow state directly via server functions. The workflow IS your state machine. Don't duplicate it in the streaming layer |
| Playwright + Auth | Hardcoding auth flows in test execution | Use Playwright's `storageState` to save and restore authentication. Pre-authenticate once, reuse cookies across test runs |
| Pi agent + Claude | Letting the agent retry indefinitely on API errors | Set max retries (3) with exponential backoff. After max retries, fail the activity and let Temporal's retry policy handle workflow-level retries |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| One browser instance per viewport per test | Memory usage grows linearly with viewport count | Browser pool with context reuse; max 3 concurrent contexts per browser instance | >5 concurrent test executions (~15 contexts, >3GB memory) |
| Unbounded concurrent test executions per worker | Worker OOM, tests timing out | Configure `maxConcurrentActivityExecutionSize` on Temporal worker; limit to (available_memory / 500MB) | >4 concurrent executions on an 4GB worker |
| Full-page screenshots at every step | Disk I/O bottleneck, storage costs explode | Capture viewport-only screenshots; use element-level screenshots for specific assertions | >50 test steps per run, >10 runs/hour |
| Video recording at source resolution | CPU bottleneck from encoding high-res video | Record at 720p during execution; offer upscaled/re-recorded video as post-processing option | >2 concurrent recordings on a 2-core machine |
| Replaying full Temporal workflow history on worker restart | Worker startup takes minutes, task processing delayed | Use Continue-As-New to keep history short; monitor `workflow_task_replay_latency` metric | Workflows with >10,000 events |
| Sending Claude API requests without concurrency control | 429 rate limit errors cascade into Temporal activity retries, compounding the problem | Centralized rate-limited queue for all Claude API calls; Temporal activity-level rate limiting | >5 concurrent users generating tests simultaneously |
| No connection pooling for database queries during result storage | Connection exhaustion under load | Use a connection pool (e.g., pgBouncer or built-in pool); size pool to match Temporal worker concurrency | >20 concurrent test result writes |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Storing user-provided URLs without validation | SSRF attacks: AI agent fetches internal network resources (169.254.169.254, localhost, internal APIs) | Validate URLs against allowlist of public IP ranges; block private/reserved IPs; use a dedicated network-isolated browser worker |
| Running Playwright browsers with full network access | Browser can access internal services, cloud metadata endpoints | Run browsers in network-isolated containers; use network policies to restrict egress to public internet only |
| Passing user input directly into Claude prompts without sanitization | Prompt injection: user crafts a URL description that manipulates the AI agent's behavior | Separate user input from system instructions; use Claude's system prompt for instructions, user message for input; validate AI output against expected schema |
| Long-lived API keys for Claude API in worker environments | Key compromise exposes entire API budget | Use short-lived tokens where possible; rotate keys regularly; set per-workspace spend limits in Anthropic Console |
| Storing test results with sensitive page content (passwords in forms, PII) | Data leak if test results are shared or exported | Scrub sensitive data from screenshots and DOM captures; never store form field values containing passwords; implement PII detection in captured content |
| Over-permissioned Temporal workers | Compromised worker can manipulate any workflow | Use separate task queues with scoped permissions; test execution workers should not have access to billing/user management workflows |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No progress indication during AI test generation (10-30 second wait) | Users assume the system is broken, refresh the page, trigger duplicate requests | Stream generation progress: "Analyzing page...", "Generating test steps...", "Validating selectors..." -- use Temporal query to expose current activity |
| Showing raw AI-generated test steps without formatting | Non-technical users cannot understand what the test does | Present test steps as human-readable actions: "Click the 'Sign In' button", "Verify the dashboard loads" with icons for each action type |
| Displaying "test failed" without actionable context | Users don't know if it's their app's bug or the AI's mistake | Distinguish between: "Your app has a bug (button not found)" vs. "AI generated an invalid step (selector might be wrong, click to regenerate)" |
| Viewport test results as a flat list | Users cannot compare cross-viewport behavior at a glance | Side-by-side viewport comparison view; highlight differences between viewport results |
| Video playback starting from the beginning for a failed step | Users must scrub through entire video to find the failure | Jump to timestamp of failed step; highlight the failure moment; show screenshot of failure state inline |
| Promising "AI-powered testing" then producing obviously wrong tests | Destroys trust in the entire product on first impression | Under-promise: "AI-assisted test generation (review recommended)" -- set expectation that AI is a starting point, not perfect |

## "Looks Done But Isn't" Checklist

- [ ] **Test generation:** Often missing validation that generated selectors actually exist in the current DOM -- verify by running selector check against live page before marking generation as complete
- [ ] **Video recording:** Often missing cleanup of temporary video files after processing -- verify disk space is reclaimed after video is uploaded to storage
- [ ] **WebSocket streaming:** Often missing reconnection logic -- verify by killing the connection mid-test and confirming the client recovers without losing state
- [ ] **Multi-viewport execution:** Often missing error isolation -- verify that a failure in one viewport doesn't cancel or corrupt other viewport executions
- [ ] **Temporal workflow cleanup:** Often missing handling of abandoned workflows -- verify that workflows have timeouts and cleanup logic for browser resources
- [ ] **Authentication:** Often missing session expiry handling -- verify that expired sessions redirect to login without losing the test configuration in progress
- [ ] **Test results storage:** Often missing pagination for large result sets -- verify that a user with 1000+ test runs can still load their dashboard in under 2 seconds
- [ ] **Claude API integration:** Often missing cost tracking per request -- verify that every API call logs token usage and estimated cost
- [ ] **Browser cleanup on worker shutdown:** Often missing graceful shutdown -- verify that SIGTERM triggers browser.close() for all active browsers before worker exits
- [ ] **Error messages from AI failures:** Often missing user-friendly messaging -- verify that Claude API errors (rate limit, context too long) produce actionable user-facing messages, not stack traces

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Monolithic Temporal workflow | HIGH | Redesign workflow hierarchy; migrate in-flight workflows (may need to abandon and restart); update all signal/query handlers |
| Memory leaks from browser contexts | MEDIUM | Add monitoring and alerts; implement forced worker recycling on memory threshold; add try/finally cleanup to all browser operations |
| AI hallucination in test steps | LOW | Add post-generation validation layer; doesn't require changing the generation pipeline, just adding a filter before execution |
| Rate limit exhaustion | MEDIUM | Implement centralized queue; add prompt caching; switch to model routing; may require architecture change if API calls are scattered |
| Video encoding performance | MEDIUM | Move to async post-processing pipeline; requires new Temporal workflow for video assembly; existing tests continue to work without video |
| 100% coverage enforcement blocking velocity | LOW | Adjust coverage thresholds; configure exclusions; this is a policy change, not a code change |
| Viewport emulation over-promise | LOW | Update product copy and documentation; add disclaimers to viewport test results; no code change needed |
| Unbounded AI cost | HIGH | Requires adding cost tracking, budgeting, and user-facing limits retroactively; every AI call site needs instrumentation; pricing model may need to change |
| Temporal monorepo build failures | MEDIUM | Switch to prebuild workflow bundles; restructure package boundaries; one-time migration but touches many files |
| WebSocket state loss on reconnect | MEDIUM | Implement server-side message buffer and client-side state recovery; add Temporal query as fallback state source |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Temporal event history explosion | Foundation (workflow design) | No single workflow exceeds 5,000 events in load testing |
| AI test hallucinations | Core AI Agent | Generated test pass rate >80% on first execution against known-good pages |
| Playwright memory leaks | Browser Execution | Worker memory stable over 24-hour continuous operation |
| Claude API rate limits | Core AI Agent + Infrastructure | System handles 10 concurrent users without 429 errors |
| Real-time streaming failures | Frontend/Streaming | Client recovers from disconnection within 5 seconds, no state loss |
| Video recording performance | Video/Recording | Tests with video enabled have <20% latency increase vs. without |
| 100% coverage trap | Foundation (policy) | Coverage config has explicit exclusions; no PRs blocked on trivial coverage |
| Monorepo build complexity | Foundation (project setup) | `npm run build` succeeds from clean checkout; Temporal workers start without module errors |
| Viewport emulation limitations | Cross-viewport phase | Product UI includes emulation disclaimer; no "device testing" claims |
| Unbounded AI cost | Core AI Agent + Billing | Per-request cost tracked; hard budget enforced; alert on anomalous usage |

## Sources

- [Temporal: Managing Very Long-Running Workflows](https://temporal.io/blog/very-long-running-workflows) -- event history limits, Continue-As-New patterns
- [Temporal: Worker Performance](https://docs.temporal.io/develop/worker-performance) -- worker sizing, poller configuration, concurrency settings
- [Temporal: System Limits (Cloud)](https://docs.temporal.io/cloud/limits) -- hard limits on events, history size
- [Temporal: TypeScript SDK Versioning](https://docs.temporal.io/develop/typescript/versioning) -- worker versioning patterns
- [Temporal + Nx Monorepo Guide](https://andreas.fyi/writing/temporal-io-nx-monorepo) -- monorepo-specific build issues
- [Anthropic: Claude API Rate Limits](https://platform.claude.com/docs/en/api/rate-limits) -- tier limits, token counting, caching benefits
- [Playwright: Video Recording](https://playwright.dev/docs/videos) -- encoding settings, performance characteristics
- [Playwright Memory Issues (GitHub #15400)](https://github.com/microsoft/playwright/issues/15400) -- memory leak patterns
- [Playwright Memory Regression (GitHub #28942)](https://github.com/microsoft/playwright/issues/28942) -- version-specific memory issues
- [Playwright in Production: Memory Reality](https://medium.com/@onurmaciit/8gb-was-a-lie-playwright-in-production-c2bdbe4429d6) -- real-world production experience
- [Applitools: AI Testing Strategy 2026](https://applitools.com/blog/ai-testing-strategy-in-2026/) -- AI testing signal-to-noise challenges
- [Ably: WebSocket Architecture Best Practices](https://ably.com/topic/websocket-architecture-best-practices) -- reconnection, state sync
- [BrowserStack: Viewport Responsive Testing](https://www.browserstack.com/guide/viewport-responsive) -- emulation limitations
- [TestDevLab: Full Test Coverage Explained](https://www.testdevlab.com/blog/full-test-coverage-explained) -- coverage pitfalls

---
*Pitfalls research for: AI-powered testing platform (Validater)*
*Researched: 2026-03-06*
