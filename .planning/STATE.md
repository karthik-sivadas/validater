# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-06)

**Core value:** Users can describe what to test in plain English, point at any URL, and get comprehensive test execution with visual proof -- no test code required.
**Current focus:** Phase 7 - Video and Reporting

## Current Position

Phase: 7 of 10 (Video and Reporting)
Plan: 2 of 3 in current phase
Status: In progress
Last activity: 2026-03-07 -- Completed 07-02-PLAN.md

Progress: [█████████░] 92%

## Performance Metrics

**Velocity:**
- Total plans completed: 24
- Average duration: ~4.8 min
- Total execution time: ~115 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 5/5 | ~25 min | ~5 min |
| 02-ai-agent | 5/5 | ~19 min | ~3.8 min |
| 03-browser-execution-engine | 2/2 | ~5 min | ~2.5 min |
| 04-workflow-orchestration | 3/3 | ~11 min | ~3.7 min |
| 05-frontend-dashboard | 4/4 | ~31 min | ~7.8 min |
| 06-live-streaming | 2/2 | ~9 min | ~4.5 min |
| 06.1-step-details | 2/2 | ~11 min | ~5.5 min |

| 07-video-and-reporting | 2/3 | ~4 min | ~4 min |

**Recent Trend:**
- Last 5 plans: 06-02 (~3 min), 06.1-01 (~8 min), 06.1-02 (~3 min), 07-02 (~4 min)
- Trend: 07-02 fast -- template + generators + server functions, no schema changes

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- 01-01: Used shadcn create preset URL for one-command scaffolding (Lyra, emerald, Inter, Remix icons, RTL)
- 01-01: Created stub packages/core and packages/db for workspace:* dependency resolution
- 01-01: Pinned pnpm@9.15.0 and Node >=22 in root package.json
- 01-02: Used NodeNext module/moduleResolution for internal packages (tsc compilation, not bundler)
- 01-02: Added db/schema subpath export for schema-only imports
- 01-02: Root tsconfig.json uses project references for all 4 packages
- 01-03: PostgreSQL mapped to port 5433 (5432 occupied by existing container)
- 01-03: Explicit schema file paths in drizzle.config.ts (drizzle-kit CJS loader incompatible with NodeNext .js barrel re-exports)
- 01-03: DOTENV_CONFIG_PATH env var in db scripts to resolve root .env from packages/db
- 01-03: Installed podman-compose for Podman container runtime
- 01-04: Better Auth drizzle adapter requires singular model names (user, session, account, verification) — schema mapping added
- 01-04: Renamed auth.server.ts to auth.ts — TanStack Start import protection blocks *.server.* from client code
- 01-04: Added dotenv loading in db client for monorepo root .env resolution
- 01-04: Auth verified via Playwright MCP browser testing (sign-up, login, session persistence, route protection, sign-out)
- 01-05: Used createRequire(import.meta.url) for workflowsPath in ESM context
- 01-05: Type-only imports for activities in workflow files (Temporal sandbox restriction)
- 01-05: Parent-child workflow pattern with executeChild + Promise.all for aggregation
- 02-01: Playwright as devDependency in core (type-only) and runtime dependency in worker
- 02-01: RawTestStep = Omit<TestStep, 'id'> -- AI generates without IDs, nanoid assigned post-generation
- 02-01: SemanticElementSchema uses z.lazy() for recursive children
- 02-01: TestStepSchema locators require min(2) for fallback reliability
- 02-02: crawlPage accepts Playwright Page (not Browser) -- caller manages browser lifecycle
- 02-02: Progressive token budget enforcement: prune, truncate, strip (3-stage reduction)
- 02-02: XPath/CSS selector priority: id > data-testid > name > text content
- 02-02: isUtilityClass filters Tailwind-like classes from simplified DOM output
- 02-03: AI SDK generateObject (not generateText + Output.object) for direct Zod schema structured output
- 02-03: System prompt ~16K chars (~4K tokens) exceeds 1024-token Anthropic cache threshold
- 02-03: LanguageModel return type annotation on createAIClient to avoid non-portable type inference
- 02-03: Rate limiter defaults: concurrency 5, intervalCap 40, interval 60s (conservative Tier 1)
- 02-03: Singleton defaultApiQueue ensures all API calls share rate limits application-wide
- 02-04: verifyLocator wraps .count() in try/catch -- invalid selectors return found: false (no throw)
- 02-04: healLocator cheapest-first: working alternatives (free) > AI-generated locators (expensive)
- 02-04: healStepLocators returns new array (no mutation) -- downstream decides what to do with unhealed steps
- 02-04: Role locator parsing supports "roleName" and "roleName: accessible name" formats
- 02-05: Pipeline accepts Page via dependency injection -- caller manages browser lifecycle
- 02-05: Added html field to SimplifiedDom type for pipeline data flow
- 02-05: TanStack Start v1.166.2 uses inputValidator (not validator) on ServerFnBuilder
- 02-05: Server function uses dynamic imports for playwright and @validater/core to avoid client bundling
- 02-05: Playwright added as runtime dependency in @validater/web for server function
- 03-01: Extracted mapLocatorToPlaywright to shared mapper.ts for reuse by validator and step-runner
- 03-01: executeSteps continues past failures so users see cascade vs independent failures
- 03-01: Screenshot capture wraps in try/catch with empty string fallback for page crash resilience
- 03-02: generic-pool with testOnBorrow validates browser health on every acquire (connected, lifetime, pages, memory)
- 03-02: Sequential viewport execution in multi-viewport activity -- pool has limited browsers, parallel would exhaust pool
- 03-02: BrowserContext per viewport (not page resize) for full isolation including cookies, storage, device emulation
- 03-02: Memory monitor uses process.memoryUsage() -- no external dependencies for health checks
- 04-01: NODE_OPTIONS='--require tsx/cjs' needed for drizzle-kit to resolve .js imports to .ts files in cross-file schema references
- 04-01: drizzle-kit push used for schema application; baseline migration includes all tables since no prior migration history existed
- 04-01: Default viewport BrowserContext for crawl/validate activities (no viewport config needed for DOM crawling and locator validation)
- 04-02: Factory DI pattern (createPersistActivities) for activities needing injected dependencies
- 04-02: Separate proxyActivities per activity file with differentiated retry policies (AI longer intervals, DB more retries)
- 04-02: PersistActivities type alias (ReturnType<typeof factory>) for proxyActivities on factory-produced activities
- 04-02: drizzle-orm added as worker dependency for eq() operator in persist activity
- 04-03: @validater/worker added as web dependency for TypeScript type resolution of dynamic imports
- 04-03: nanoid and drizzle-orm added as direct web dependencies for dynamic import type resolution
- 04-03: DB fallback in getTestRunStatusFn uses db.select().from().where() builder API (not relational query API)
- 04-03: Anonymous userId placeholder in test_runs insert -- Phase 5 wires auth context
- 05-01: Cast jsonb viewports to string[] in server function returns -- dynamic import creates incompatible Promise types with unknown vs {}
- 05-01: Auth ownership check in getTestRunDetail returns null (not 403) to avoid leaking run existence
- 05-01: Added stub /runs route for TanStack Router strict Link type-checking
- 05-02: Phase-to-progress mapping with interpolation during executing phase based on viewport completion ratio
- 05-02: Stub /runs/$runId route for type-safe navigate() -- will be expanded in plan 05-03/05-04
- 05-04: z.catch() instead of fallback() from zod-adapter -- avoids TS2589 deep type instantiation with TanStack Router generic inference
- 05-04: Navigate with direct merged search object instead of reducer function for strict TanStack Router typing
- 05-04: Directory-based routing for runs/ (layout Outlet in runs.tsx, children in runs/ directory)
- 05-04: base-ui Select onValueChange accepts string | null -- null guard required
- 05-03: Explicit TypeScript type cast on Route.useLoaderData() for dynamic-import server function return types (TanStack Router type inference breaks through dynamic imports)
- 05-03: Renders stepOrder as "Step N" -- test_run_steps schema has no action_description column
- 06-01: Hono WebSocket sidecar on port 3001 -- TanStack Start does not support WebSockets natively
- 06-01: Each WS connection gets its own Redis subscriber (ioredis requires separate pub/sub connections)
- 06-01: Streaming enabled only for first viewport to avoid overwhelming client with multiple streams
- 06-01: All streaming operations wrapped in try/catch -- streaming failures never break test execution
- 06-01: Frame ack sent immediately before processing to prevent CDP backpressure stalling
- 06-01: Step events published after executeSteps returns (core executor has no callback hooks)
- 06-02: Client-side StepEvent/StreamMessage type duplicates (not imported from worker) to avoid cross-package client/server dependency
- 06-02: endedRef (useRef) alongside ended state for reliable stream-end check in WebSocket onclose callback
- 06-02: Configurable WS URL via VITE_WS_URL env var with ws://localhost:3001 default
- 06.1-01: Staging table pattern (stepScreenshots) bypasses Temporal 2MB payload limit for screenshot persistence
- 06.1-01: Factory DI pattern extended to executeStepsActivity (createExecuteActivities) -- same as persist-results
- 06.1-01: onConflictDoNothing for staging table upserts (simpler than onConflictDoUpdate, equivalent for retries)
- 06.1-01: screenshotBase64 set to empty string (not stripped) in lightResults to maintain StepResult type compatibility
- 06.1-02: Canvas double-buffered rendering (BrowserCanvas) for flicker-free live streaming frame display
- 06.1-02: ACTION_COLORS duplicated in live viewer and results page (not shared module) -- small map, avoids cross-component coupling
- 06.1-02: Nullable action/description in results page types for backward compatibility with existing test runs
- 06.1-02: Screenshot thumbnails max-h-48 + object-cover for compact display; Dialog zoom preserves full-size
- 07-02: Standalone HTML report with inline CSS (no external deps) for universal browser rendering
- 07-02: Fresh Chromium launch per PDF (not browser pool) since PDF generation is infrequent
- 07-02: Base64 PDF transfer via server function return (not file streaming)
- 07-02: Shared buildReportData helper in exports.ts for DRY HTML/PDF generation
- 07-02: Export buttons only visible for status=complete test runs

### Pending Todos

None yet.

### Roadmap Evolution

- Phase 6.1 inserted after Phase 6: Step Details, Screenshots, and Browser Experience (URGENT)

### Blockers/Concerns

- 01-03: New schema files must be manually added to drizzle.config.ts schema array (documented)
- 04-01: drizzle-kit scripts now require NODE_OPTIONS='--require tsx/cjs' for cross-file .js imports (already added to package.json scripts)
- Pre-existing: @validater/web typecheck fails on vite.config.ts test property type mismatch (unrelated to workflow phase)
- Pre-existing: core/src/ai/client.ts structuredOutputs property error (OpenRouterChatSettings type mismatch)

## Session Continuity

Last session: 2026-03-07
Stopped at: Completed 07-02-PLAN.md (Report export)
Resume file: None
