# Stack Research

**Domain:** AI-powered web testing platform
**Researched:** 2026-03-06
**Confidence:** MEDIUM-HIGH (most core technologies verified; Pi agent and DSPy.ts are newer/less established)

## Recommended Stack

### Core Framework & Frontend

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| TypeScript | 5.7+ | Language (full-stack) | End-to-end type safety across frontend, backend, workflows, and agent code. Non-negotiable for a project of this complexity. |
| React | 19.x | UI library | Industry standard. Required by TanStack Start and shadcn/ui. React 19 brings Server Components and improved Suspense. |
| TanStack Start | 1.x RC (1.154+) | Full-stack meta-framework | Type-safe routing and APIs, streaming SSR, universal deployment (Vercel, Cloudflare, Node). Built on Vite. Chosen over Next.js to stay in the TanStack ecosystem and avoid Webpack/turbopack lock-in. RC is API-stable; 1.0 imminent. |
| TanStack Router | 1.166+ | Client-side routing | Fully type-safe routing with search params validation, loader patterns, and nested layouts. Integrated into TanStack Start. |
| TanStack Query | 5.90+ | Server state management | Caching, deduplication, background refetching for API data. The standard for async state in React. |
| TanStack Table | 8.x | Data table rendering | Headless, type-safe table for test results display. Supports sorting, filtering, pagination, column resizing. |
| TanStack Form | 1.x | Form state management | Type-safe form handling with validation. Headless, works with any UI components. |
| shadcn/ui | latest (CLI 3.0+) | UI component library | Copy-paste components built on Radix UI primitives. Full control over styling/behavior. Uses unified `radix-ui` package (Feb 2026 update). Tailwind CSS v4 compatible. |
| Tailwind CSS | 4.x | Utility-first CSS | Required by shadcn/ui. v4 has CSS-first configuration and significant performance improvements. |

**Confidence:** HIGH -- TanStack ecosystem is well-documented and actively maintained. TanStack Start RC is the main risk, but the API is frozen and 1.0 is imminent.

### Backend & API

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js | 22 LTS | Runtime | LTS with long-term support. Required by Temporal SDK (supports 20, 22, 24). Bun used as package manager only -- Bun runtime has dynamic route bugs with Nitro (see [Nitro #3808](https://github.com/nitrojs/nitro/issues/3808)). |
| TanStack Start Server Functions | (bundled) | Primary API layer | Type-safe RPC between client and server via `createServerFn()`. Supports Zod input validation, composable typed middleware, automatic code splitting. Replaces the need for tRPC or a separate API server for internal app communication. |
| Hono | 4.x | Streaming sidecar | WebSocket/SSE server for live browser streaming only. TanStack Start WebSocket support is experimental -- Hono handles the real-time feed. NOT used as the primary API layer. |

**Confidence:** HIGH -- Standard Node.js backend stack. TanStack Start server functions are well-documented and the TanStack team's guidance aligns with using them as the primary API pattern.

### AI & Agent Layer

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| @mariozechner/pi-agent-core | 0.56+ | Agent runtime | Stateful agent with tool execution and event streaming. Provides the agent loop, tool calling, and state management. Embeddable via SDK mode. |
| @mariozechner/pi-ai | 0.56+ | Unified LLM API | Single interface for Anthropic, OpenAI, Google, and other providers. Abstracts provider differences. Part of pi-mono. |
| @anthropic-ai/sdk | 0.78+ | Claude API client | Direct Anthropic API access for cases where Pi's abstraction is insufficient. Tool helpers (beta), MCP integration, streaming support. |
| DSPy.ts | 2.1 | Prompt optimization | TypeScript port of Stanford's DSPy for declarative, self-improving prompts. 75% DSPy Python compliance. Enables signature-based prompt definition with automatic optimization. |

**Confidence:** MEDIUM -- Pi agent (v0.56) is actively developed but pre-1.0 with rapid iteration. DSPy.ts has only 218 GitHub stars and 40 commits; its maturity is uncertain. Both are viable but carry integration risk.

**Important caveat on DSPy.ts:** The project claims 75% DSPy compliance with a Q3 2025 target for 100%. As of March 2026, it is unclear if that target was hit. The low commit count (40) and zero open PRs suggest either a small team or slowing development. Recommend evaluating whether Pi agent's built-in prompt patterns are sufficient before committing to DSPy.ts as a dependency. If structured prompt optimization is critical, consider building a lightweight abstraction directly rather than depending on DSPy.ts.

### Workflow Orchestration

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Temporal (TypeScript SDK) | 1.15.0 | Workflow orchestration | Durable, fault-tolerant workflow execution. Handles long-running test sessions, retries, timeouts, and state persistence. Industry standard for workflow orchestration. |
| @temporalio/client | 1.15.0 | Workflow client | Start, signal, query, and cancel workflows from the web app. |
| @temporalio/worker | 1.15.0 | Workflow worker | Executes workflow and activity code. Runs Playwright browser automation as activities. |
| @temporalio/workflow | 1.15.0 | Workflow definitions | Define deterministic workflow logic (test orchestration, multi-viewport coordination). |
| @temporalio/activity | 1.15.0 | Activity definitions | Define non-deterministic activities (browser automation, AI calls, video processing). |

**Confidence:** HIGH -- Temporal is the industry standard for workflow orchestration. TypeScript SDK is mature (1.15.0), well-documented, and supported on Node 20/22/24. Recent additions include Nexus (GA), resource-based auto-tuning, and AI SDK integration.

### Browser Automation & Video

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Playwright | 1.58+ | Browser automation | Cross-browser automation (Chromium, Firefox, WebKit). Multi-viewport support via browser contexts. Built-in video recording via `recordVideo` option. The only serious choice for modern browser automation. |
| fluent-ffmpeg | 2.x | Video processing | Node.js wrapper for FFmpeg. Post-process Playwright recordings: compress, generate thumbnails, create clips. Well-maintained with large community. |
| FFmpeg | 6.x+ (system) | Video encoding | System dependency for video transcoding. Required by fluent-ffmpeg. Must be installed on worker machines. |

**Confidence:** HIGH -- Playwright's programmatic video recording API is well-documented. Create a browser context with `recordVideo: { dir: 'videos/', size: { width, height } }`, perform actions, close context to finalize video. Videos are WebM format by default.

### Database & ORM

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| PostgreSQL | 16+ | Primary database | Multi-user SaaS platform needs concurrent read/write, JSONB for test results, full-text search. SQLite cannot handle concurrent writes from multiple test workers. |
| Drizzle ORM | 0.45+ | Database ORM | SQL-like TypeScript API, ~7.4kb bundle, zero dependencies, excellent type inference. Code-first schema definition (no separate schema file). Chosen over Prisma for lighter weight, SQL proximity, and better serverless/edge compatibility. |
| drizzle-kit | latest | Migrations | Schema migrations and introspection. Companion CLI for Drizzle ORM. |

**Confidence:** HIGH -- PostgreSQL is the standard database for SaaS platforms. Drizzle ORM is the leading lightweight TypeScript ORM, preferred over Prisma (which dropped its Rust engine in Prisma 7 anyway).

### Authentication

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Better Auth | 1.5+ | Authentication | Framework-agnostic, TypeScript-first auth with plugin ecosystem. Supports email/password, OAuth (Google, GitHub), 2FA, passkeys, RBAC, session management. The Auth.js team joined Better Auth in Sep 2025; it is now the recommended auth library by major frameworks. |

**Confidence:** HIGH -- Better Auth is the clear winner in the TypeScript auth space as of 2026. Lucia is deprecated. Auth.js/NextAuth is in maintenance mode. Better Auth has active development (1.5.3 published March 2026), database adapters for PostgreSQL/Drizzle, and a comprehensive plugin system.

### Monorepo & Build Tooling

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Turborepo | 2.8+ | Monorepo task runner | Fast incremental builds, remote caching, simple configuration. Chosen over Nx: this project will have <15 packages, and Turborepo's simplicity wins at this scale. Can add to existing monorepo in minutes. |
| Bun | 1.x | Package manager | Fast package installation, used for `bun install`, `bunx`, and scaffolding commands. NOT used as runtime (Nitro dynamic route bugs). |
| Vite | 6.x | Build tool / dev server | Bundled with TanStack Start. Fast HMR, ESM-native. |
| Vitest | 2.x | Unit/integration testing | Vite-native test runner. Compatible with Jest API. Fast, supports TypeScript natively. |
| Biome | 1.x | Linting & formatting | All-in-one linter+formatter, 10-100x faster than ESLint+Prettier. Rust-based. Actively maintained. |

**Confidence:** HIGH -- All established tools with strong ecosystem support. Turborepo vs Nx is the one debatable choice; Nx is better at 30+ packages but overkill here.

### Infrastructure & Deployment

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Docker | latest | Containerization | Package Temporal workers, Playwright browsers, and the web app. Required for Temporal development environment. |
| Temporal Server (self-hosted or Cloud) | latest | Workflow engine | Self-hosted via Docker for development; Temporal Cloud for production. Cloud removes operational burden of running the Temporal cluster. |
| S3-compatible storage | -- | Video/artifact storage | Store test recording videos and screenshots. Use MinIO locally, AWS S3 or Cloudflare R2 in production. |

**Confidence:** MEDIUM -- Infrastructure choices depend on deployment target (cloud provider, budget). S3-compatible storage is a safe bet. Temporal Cloud vs self-hosted is a cost/ops tradeoff to decide later.

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | 3.x | Schema validation | Validate API inputs, form data, environment variables. Used by TanStack Form and Better Auth. |
| date-fns | 4.x | Date utilities | Format timestamps in test results, reports. Tree-shakeable. |
| nanoid | 5.x | ID generation | Generate short, URL-safe unique IDs for test runs, sessions. |
| sharp | 0.33+ | Image processing | Generate thumbnails from screenshots, resize viewport captures. |
| @tanstack/react-virtual | 3.x | List virtualization | Virtualize long test result lists for performance. |
| ws | latest | WebSocket | Real-time browser frame streaming via Hono sidecar. SSE from TanStack Start server routes for unidirectional test progress updates. |
| bullmq | 5.x | Job queue (optional) | If Temporal is too heavy for simple async tasks (email sending, cleanup). Usually Temporal covers this. |

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| TanStack Start | Next.js 15 | If TanStack Start RC stability becomes a blocker. Next.js has larger ecosystem but Webpack/turbopack build system and vendor lock-in. |
| TanStack Start | Remix / React Router 7 | If you prefer Remix's loader/action patterns. Less type-safe than TanStack Router. |
| TanStack Start Server Fns | tRPC | If you need API contract export for external consumers, batching, or WebSocket subscriptions. Redundant for single-app internal API. |
| Drizzle ORM | Prisma 7 | If team prefers schema-first approach and Prisma Studio GUI. Prisma 7 is now pure TypeScript (no Rust engine). Heavier but more mature ecosystem. |
| Turborepo | Nx | If project grows to 30+ packages. Nx has better dependency graph analysis and affected-command intelligence at scale. |
| Better Auth | Clerk / Auth0 | If you want fully managed auth (hosted login pages, user management dashboard). Higher cost, less control, vendor lock-in. |
| Pi agent | Vercel AI SDK | If you want a more established/popular agent framework. AI SDK has Temporal integration (public preview). But less opinionated about agent patterns than Pi. |
| Pi agent | LangChain.js | If you need extensive RAG/retrieval patterns. LangChain is heavier and more complex; Pi is leaner and more composable. |
| fluent-ffmpeg | node-av | If you need low-level FFmpeg bindings with hardware acceleration. node-av is newer with full TypeScript support but less community adoption. |
| PostgreSQL | SQLite (via Turso/LibSQL) | Only for single-user or embedded use cases. Not suitable for concurrent multi-worker test execution. |
| DSPy.ts | Custom prompt abstraction | If DSPy.ts proves too immature. Build a lightweight signature/optimizer pattern directly. Less overhead, full control. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Lucia Auth | Deprecated as of March 2025. Now only educational resources. | Better Auth |
| NextAuth / Auth.js v5 | In maintenance mode. Core team joined Better Auth (Sep 2025). | Better Auth |
| tRPC | Redundant with TanStack Start server functions for internal app communication. Same type safety, more overhead. No colocation or code splitting. | TanStack Start server functions (primary API) |
| Express.js | No TypeScript-first design, callback-based middleware, no built-in validation. | Hono (for streaming sidecar) or TanStack Start server functions |
| Webpack | Slow, complex configuration, legacy. TanStack Start uses Vite. | Vite (bundled with TanStack Start) |
| Puppeteer | Google-only (Chrome/Chromium), no Firefox/WebKit, less active development than Playwright. | Playwright |
| Cypress | Not suitable for programmatic/headless automation at scale. Designed for interactive test development, not CI agent execution. | Playwright |
| ESLint + Prettier | Slow (JavaScript-based), two separate tools. | Biome (single tool, Rust-based, 10-100x faster) |
| LangChain.js (as primary) | Over-engineered for this use case. Heavy abstractions, frequent breaking changes, "framework tax." | Pi agent for agent loop; direct Anthropic SDK for simple LLM calls |
| TypeORM / Sequelize | Legacy ORMs with poor TypeScript support, heavy abstractions. | Drizzle ORM |
| MongoDB | Relational data (users, test runs, results) fits relational DB. MongoDB adds complexity without benefit here. | PostgreSQL |

## Stack Patterns by Variant

**If TanStack Start RC becomes unstable:**
- Fall back to Vite + TanStack Router (SPA mode) + Hono API server
- Lose SSR but gain stability. Can migrate to Start 1.0 later.

**If DSPy.ts proves too immature:**
- Build a lightweight prompt signature system directly
- Define input/output schemas with Zod, implement few-shot example management, use Pi agent for execution
- This is ~500 lines of code vs a full framework dependency

**If self-hosting Temporal is too complex for early development:**
- Use Temporal Cloud free tier (available for small workloads)
- Or prototype with BullMQ + PostgreSQL for simple job queuing, migrate to Temporal when workflows get complex

**If video storage costs become significant:**
- Use Cloudflare R2 (no egress fees) instead of AWS S3
- Implement video retention policies (auto-delete after N days)
- Compress recordings aggressively with FFmpeg (CRF 28+, lower resolution)

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| TanStack Start 1.x RC | React 19, Vite 6.x | Start is built on Vite; uses React 19 features |
| Temporal SDK 1.15.0 | Node.js 20, 22, 24 | All @temporalio/* packages must share the same version |
| Playwright 1.58+ | Node.js 18+ | Downloads browser binaries on install; ~500MB disk |
| Drizzle ORM 0.45+ | PostgreSQL 12+ | Use `drizzle-orm/pg-core` for PostgreSQL adapter |
| Better Auth 1.5+ | Drizzle ORM, PostgreSQL | Has built-in Drizzle adapter for database |
| shadcn/ui (Feb 2026+) | Radix UI unified package, Tailwind CSS 4.x | Uses `radix-ui` instead of individual `@radix-ui/react-*` packages |
| Pi agent 0.56+ | Node.js 20+ | Check pi-mono release notes for breaking changes (rapid iteration) |

## Monorepo Package Structure (Recommended)

```
validater/
  packages/
    web/              # TanStack Start app (frontend + server functions + Hono streaming sidecar)
    core/             # Shared types, schemas, utilities
    agent/            # AI agent logic (Pi agent, prompt definitions)
    worker/           # Temporal worker (browser automation, video)
    db/               # Drizzle schema, migrations, database client
  turbo.json          # Turborepo pipeline configuration
  pnpm-workspace.yaml # pnpm workspace definition
```

**Note:** There is no separate `api/` package. TanStack Start server functions serve as the API layer within `packages/web/`. The Hono streaming sidecar also lives in `packages/web/` as a separate entry point for WebSocket/SSE streaming.

## Installation

```bash
# Initialize monorepo (Bun as package manager, Node.js 22 as runtime)
bun init
bunx turbo init

# Core framework (in packages/web)
bun add react react-dom @tanstack/react-router @tanstack/start
bun add @tanstack/react-query @tanstack/react-table @tanstack/react-form
bun add tailwindcss @tailwindcss/vite
bun add -D typescript @types/react @types/react-dom vite

# Hono streaming sidecar (in packages/web)
bun add hono

# UI components (in packages/web) - use shadcn CLI
bunx --bun shadcn@latest init
bunx --bun shadcn@latest add button card dialog table input form

# Database (in packages/db)
bun add drizzle-orm postgres
bun add -D drizzle-kit

# Auth (in packages/web or packages/core)
bun add better-auth

# AI/Agent (in packages/agent)
bun add @mariozechner/pi-agent-core @mariozechner/pi-ai
bun add @anthropic-ai/sdk

# Workflow orchestration (in packages/worker)
bun add @temporalio/client @temporalio/worker @temporalio/workflow @temporalio/activity

# Browser automation (in packages/worker)
bun add playwright

# Video processing (in packages/worker)
bun add fluent-ffmpeg
bun add -D @types/fluent-ffmpeg

# Utilities (in packages/core)
bun add zod nanoid

# Dev tools (root)
bun add -D turbo vitest @biomejs/biome
```

## Sources

- [TanStack Start v1 RC announcement](https://tanstack.com/blog/announcing-tanstack-start-v1) -- TanStack Start status, confirmed RC with stable API (HIGH confidence)
- [TanStack Start overview](https://tanstack.com/start/latest/docs/framework/react/overview) -- Framework capabilities (HIGH confidence)
- [shadcn/ui February 2026 changelog](https://ui.shadcn.com/docs/changelog/2026-02-radix-ui) -- Unified Radix UI package migration (HIGH confidence)
- [Temporal TypeScript SDK](https://docs.temporal.io/develop/typescript) -- SDK guide, Node.js compatibility (HIGH confidence)
- [@temporalio/client npm](https://www.npmjs.com/package/@temporalio/client) -- Version 1.15.0 confirmed (HIGH confidence)
- [Temporal Replay 2025 announcements](https://temporal.io/blog/replay-2025-product-announcements) -- Nexus GA, AI SDK integration (HIGH confidence)
- [Playwright docs - Videos](https://playwright.dev/docs/videos) -- Programmatic video recording API (HIGH confidence)
- [playwright npm](https://www.npmjs.com/package/playwright) -- Version 1.58.2 confirmed (HIGH confidence)
- [@anthropic-ai/sdk npm](https://www.npmjs.com/package/@anthropic-ai/sdk) -- Version 0.78.0 confirmed (HIGH confidence)
- [Anthropic SDK GitHub](https://github.com/anthropics/anthropic-sdk-typescript) -- Tool helpers, MCP integration (HIGH confidence)
- [Pi-mono GitHub](https://github.com/badlogic/pi-mono) -- Package structure, v0.56.1, SDK embedding mode (MEDIUM confidence)
- [Pi agent architecture blog](https://nader.substack.com/p/how-to-build-a-custom-agent-framework) -- Agent framework design patterns (MEDIUM confidence)
- [DSPy.ts GitHub](https://github.com/ruvnet/dspy.ts) -- v2.1, 218 stars, 40 commits, 75% compliance claim (LOW confidence - maturity uncertain)
- [Better Auth](https://better-auth.com/) -- v1.5.3, Auth.js team merger (HIGH confidence)
- [Better Auth npm](https://www.npmjs.com/package/better-auth) -- Version confirmed (HIGH confidence)
- [Drizzle ORM](https://orm.drizzle.team/) -- v0.45.1, features, bundle size (HIGH confidence)
- [drizzle-orm npm](https://www.npmjs.com/package/drizzle-orm) -- Version confirmed (HIGH confidence)
- [Bytebase: Drizzle vs Prisma 2026](https://www.bytebase.com/blog/drizzle-vs-prisma/) -- Comparison analysis (MEDIUM confidence)
- [Turborepo npm](https://www.npmjs.com/package/turbo) -- v2.8.13 confirmed (HIGH confidence)
- [DEV Community: Turborepo vs Nx 2026](https://dev.to/dataformathub/turborepo-nx-and-lerna-the-truth-about-monorepo-tooling-in-2026-71) -- Comparison at different scales (MEDIUM confidence)
- [fluent-ffmpeg GitHub](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg) -- Video processing API (HIGH confidence)

---
*Stack research for: AI-powered web testing platform (Validater)*
*Researched: 2026-03-06*
