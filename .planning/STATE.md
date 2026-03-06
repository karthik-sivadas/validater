# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-06)

**Core value:** Users can describe what to test in plain English, point at any URL, and get comprehensive test execution with visual proof -- no test code required.
**Current focus:** Phase 5 - Frontend -- Dashboard and Results

## Current Position

Phase: 5 of 10 (Frontend -- Dashboard and Results)
Plan: 4 of 4 in current phase
Status: Phase complete
Last activity: 2026-03-07 -- Completed 05-03-PLAN.md

Progress: [█████░░░░░] 49%

## Performance Metrics

**Velocity:**
- Total plans completed: 19
- Average duration: ~4.8 min
- Total execution time: ~91 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 5/5 | ~25 min | ~5 min |
| 02-ai-agent | 5/5 | ~19 min | ~3.8 min |
| 03-browser-execution-engine | 2/2 | ~5 min | ~2.5 min |
| 04-workflow-orchestration | 3/3 | ~11 min | ~3.7 min |
| 05-frontend-dashboard | 4/4 | ~31 min | ~7.8 min |

**Recent Trend:**
- Last 5 plans: 05-01 (~5 min), 05-02 (~2 min), 05-04 (~11 min), 05-03 (~13 min)
- Trend: 05-03 longer due to TypeScript OOM requiring increased heap and type inference debugging

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

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 6: CDP screencast + Redis + WebSocket has few production references -- needs prototyping spike
- 01-03: New schema files must be manually added to drizzle.config.ts schema array (documented)
- 04-01: drizzle-kit scripts now require NODE_OPTIONS='--require tsx/cjs' for cross-file .js imports (already added to package.json scripts)
- Pre-existing: @validater/web typecheck fails on vite.config.ts test property type mismatch (unrelated to workflow phase)

## Session Continuity

Last session: 2026-03-07
Stopped at: Completed 05-03-PLAN.md (Phase 5 complete)
Resume file: None
