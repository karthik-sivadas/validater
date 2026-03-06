# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-06)

**Core value:** Users can describe what to test in plain English, point at any URL, and get comprehensive test execution with visual proof -- no test code required.
**Current focus:** Phase 2 - AI Agent -- Test Generation

## Current Position

Phase: 2 of 10 (AI Agent -- Test Generation)
Plan: 1 of 5 in current phase
Status: In progress
Last activity: 2026-03-06 -- Completed 02-01-PLAN.md (Types and Schemas)

Progress: [██░░░░░░░░] 12%

## Performance Metrics

**Velocity:**
- Total plans completed: 6
- Average duration: ~5 min
- Total execution time: ~28 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 5/5 | ~25 min | ~5 min |
| 02-ai-agent | 1/5 | ~3 min | ~3 min |

**Recent Trend:**
- Last 5 plans: 01-02 (~2 min), 01-03 (~8 min), 01-04 (~6 min), 01-05 (~4 min), 02-01 (~3 min)
- Trend: Stable

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

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 2: Pi agent is pre-1.0 -- evaluate Vercel AI SDK as alternative during planning
- Phase 2: DSPy.ts maturity uncertain -- build lightweight prompt abstraction instead
- Phase 6: CDP screencast + Redis + WebSocket has few production references -- needs prototyping spike
- 01-03: New schema files must be manually added to drizzle.config.ts schema array (documented)

## Session Continuity

Last session: 2026-03-06
Stopped at: Completed 02-01-PLAN.md (Types and Schemas)
Resume file: None
