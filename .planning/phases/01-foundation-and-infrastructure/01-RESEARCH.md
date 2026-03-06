# Phase 1: Foundation and Infrastructure - Research

**Researched:** 2026-03-06
**Domain:** Monorepo scaffolding, database, authentication, Temporal dev environment
**Confidence:** HIGH

## Summary

Phase 1 establishes the foundational infrastructure for Validater: a pnpm + Turborepo monorepo scaffolded from the shadcn TanStack Start template, PostgreSQL with Drizzle ORM for data persistence, Better Auth for email/password authentication with session persistence, and a Temporal development environment with a hello-world workflow demonstrating parent-child hierarchy.

All technology choices are locked decisions from prior research. The primary integration challenge is converting the shadcn-generated single-app TanStack Start project into a multi-package monorepo while preserving shadcn's component resolution, Tailwind CSS configuration, and path aliases. The second challenge is wiring Better Auth's Drizzle adapter and TanStack Start cookie plugin correctly so sessions persist across browser refresh.

**Primary recommendation:** Scaffold with `pnpm create @tanstack/start@latest --tailwind --add-ons shadcn` (simpler and more reliable than the preset URL), then restructure into the monorepo layout with `packages/web`, `packages/db`, `packages/core`, and `packages/worker`. Use `temporal server start-dev` via Podman for the lightest-weight Temporal development setup.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TanStack Start | 1.x RC (1.154+) | Full-stack React framework | Type-safe routing, server functions, SSR. Locked decision. |
| TanStack Router | 1.166+ | File-based routing | Fully type-safe routes, search params, loaders. Bundled with Start. |
| TanStack Query | 5.90+ | Async state management | Caching, deduplication, background refetch. Standard for React. |
| React | 19.x | UI library | Required by TanStack Start and shadcn/ui. |
| shadcn/ui | CLI 3.0+ (Lyra style) | UI components | Copy-paste Radix UI components. Locked: emerald theme, Remix icons, Inter font. |
| Tailwind CSS | 4.x | Utility CSS | Required by shadcn/ui. CSS-first config in v4. |
| Drizzle ORM | 0.45+ | Database ORM | Code-first schema, SQL-like API, ~7.4kb. Locked decision. |
| drizzle-kit | latest | Migrations CLI | Schema generation and migration management. |
| Better Auth | 1.5+ | Authentication | Email/password, session management, Drizzle adapter. Locked decision. |
| Temporal TS SDK | 1.15.0 | Workflow orchestration | @temporalio/client, /worker, /workflow, /activity. All must share version. |
| Turborepo | 2.8+ | Monorepo task runner | Incremental builds, pipeline config. Locked decision. |
| pnpm | 9.x | Package manager | Workspace protocol, fast installs. Bun used for `bunx` only. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | 3.x | Schema validation | Server function input validation, env vars, shared schemas. |
| pg (node-postgres) | 8.x | PostgreSQL driver | Database connection for Drizzle ORM. |
| Biome | 1.x | Lint + format | Single tool replacing ESLint + Prettier. Locked decision. |
| Vitest | 2.x | Testing | Vite-native test runner. Phase 1 sets up config only. |
| @remixicon/react | latest | Icons | Tree-shakeable icon library. Locked via shadcn preset. |
| dotenv | latest | Env vars | Load .env files for database URLs, secrets. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `temporal server start-dev` (Podman) | Full docker-compose (PostgreSQL + Elasticsearch) | Full compose adds Elasticsearch visibility search but is heavyweight for dev. Use lightweight CLI server for Phase 1. |
| `pg` (node-postgres) | `postgres` (postgres.js) | postgres.js is newer with better TypeScript types. node-postgres is more established. Either works with Drizzle. Use `pg` for broader ecosystem compatibility. |
| `drizzle-kit push` (dev) | `drizzle-kit generate` + `migrate` | `push` is faster for local iteration. `generate` + `migrate` produces SQL files for production. Use `push` in dev, `generate`+`migrate` for CI/prod. |

**Installation (per package):**

```bash
# Root
pnpm add -Dw turbo @biomejs/biome vitest typescript

# packages/web (after scaffold)
pnpm add better-auth @tanstack/react-query zod
pnpm add -D @types/react @types/react-dom

# packages/db
pnpm add drizzle-orm pg dotenv
pnpm add -D drizzle-kit @types/pg tsx

# packages/core
pnpm add zod

# packages/worker
pnpm add @temporalio/client @temporalio/worker @temporalio/workflow @temporalio/activity
```

## Architecture Patterns

### Recommended Project Structure

```
validater/
├── packages/
│   ├── web/                     # TanStack Start app (scaffolded from shadcn template)
│   │   ├── src/
│   │   │   ├── routes/          # File-based routes (TanStack Router)
│   │   │   │   ├── __root.tsx   # Root layout
│   │   │   │   ├── index.tsx    # Home page
│   │   │   │   ├── login.tsx    # Login page
│   │   │   │   ├── signup.tsx   # Sign-up page
│   │   │   │   ├── _authed.tsx  # Auth layout (pathless, protects children)
│   │   │   │   └── api/
│   │   │   │       └── auth/
│   │   │   │           └── $.ts # Better Auth catch-all route handler
│   │   │   ├── components/      # shadcn/ui + custom components
│   │   │   │   └── ui/          # shadcn components (button, input, card, etc.)
│   │   │   ├── lib/
│   │   │   │   ├── auth.ts      # Better Auth instance (server-side)
│   │   │   │   ├── auth-client.ts # Better Auth client (browser-side)
│   │   │   │   └── utils.ts     # cn() utility from shadcn
│   │   │   ├── server/
│   │   │   │   └── auth.server.ts # getSession/ensureSession server functions
│   │   │   └── styles/
│   │   │       └── globals.css  # Tailwind + shadcn CSS variables
│   │   ├── components.json      # shadcn config
│   │   ├── app.config.ts        # TanStack Start config
│   │   └── package.json
│   │
│   ├── db/                      # Database schema + migrations
│   │   ├── src/
│   │   │   ├── schema/          # Drizzle table definitions
│   │   │   │   ├── users.ts     # Better Auth user/session/account/verification tables
│   │   │   │   └── index.ts     # Re-export all schemas
│   │   │   ├── migrations/      # Generated SQL migrations
│   │   │   └── client.ts        # Database client singleton (drizzle + pg Pool)
│   │   ├── drizzle.config.ts    # Drizzle Kit config
│   │   └── package.json
│   │
│   ├── core/                    # Shared types + Zod schemas
│   │   ├── src/
│   │   │   ├── types/           # Shared TypeScript types
│   │   │   ├── schemas/         # Shared Zod validation schemas
│   │   │   └── index.ts         # Barrel export
│   │   └── package.json
│   │
│   └── worker/                  # Temporal workflows + activities
│       ├── src/
│       │   ├── workflows/
│       │   │   └── hello.workflow.ts  # Hello-world with parent-child hierarchy
│       │   ├── activities/
│       │   │   └── hello.activity.ts  # Simple greeting activity
│       │   └── worker.ts              # Worker entry point
│       └── package.json
│
├── docker/
│   └── docker-compose.yml       # PostgreSQL + Temporal dev server
│
├── turbo.json                   # Turborepo pipeline config
├── pnpm-workspace.yaml          # pnpm workspace definition
├── biome.json                   # Biome config (root)
├── tsconfig.json                # Root tsconfig with path references
├── .env                         # DATABASE_URL, BETTER_AUTH_SECRET, etc.
└── package.json                 # Root package with workspace scripts
```

### Pattern 1: shadcn Template to Monorepo Conversion

**What:** Scaffold a TanStack Start app with shadcn, then restructure it into a monorepo with internal packages.
**When to use:** At project initialization (Plan 01-01).

**Steps:**
1. Create TanStack Start app: `pnpm create @tanstack/start@latest --tailwind --add-ons shadcn`
2. Move the generated app into `packages/web/`
3. Create `pnpm-workspace.yaml` at root
4. Create `turbo.json` at root
5. Create `packages/db/`, `packages/core/`, `packages/worker/` as internal packages
6. Update imports to use workspace protocol (`@validater/db`, `@validater/core`)
7. Configure `components.json` path aliases for monorepo

```yaml
# pnpm-workspace.yaml
packages:
  - "packages/*"
```

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".output/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "lint": {},
    "test": {}
  }
}
```

### Pattern 2: Better Auth + TanStack Start Integration

**What:** Mount Better Auth handler on a catch-all API route, use cookie plugin for session persistence, protect routes via `beforeLoad`.
**When to use:** Plan 01-03 (Authentication).

**Server-side auth instance:**
```typescript
// packages/web/src/lib/auth.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { db } from "@validater/db";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [tanstackStartCookies()], // MUST be last plugin
});
```

**API route handler:**
```typescript
// packages/web/src/routes/api/auth/$.ts
import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        return await auth.handler(request);
      },
      POST: async ({ request }: { request: Request }) => {
        return await auth.handler(request);
      },
    },
  },
});
```

**Session helper server functions:**
```typescript
// packages/web/src/server/auth.server.ts
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { auth } from "@/lib/auth";

export const getSession = createServerFn({ method: "GET" }).handler(
  async () => {
    const headers = getRequestHeaders();
    const session = await auth.api.getSession({ headers });
    return session;
  }
);
```

**Route protection via layout:**
```typescript
// packages/web/src/routes/_authed.tsx
import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { getSession } from "@/server/auth.server";

export const Route = createFileRoute("/_authed")({
  beforeLoad: async ({ location }) => {
    const session = await getSession();
    if (!session) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href },
      });
    }
    return { user: session.user };
  },
  component: () => <Outlet />,
});
```

### Pattern 3: Drizzle Schema in Separate Package

**What:** Define database schema in `packages/db`, export schema and client for use by both `packages/web` and `packages/worker`.
**When to use:** Plan 01-02 (Database).

```typescript
// packages/db/src/client.ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });
export type Database = typeof db;
```

```typescript
// packages/db/drizzle.config.ts
import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./src/migrations",
  schema: "./src/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

### Pattern 4: Temporal Hello-World with Parent-Child Hierarchy

**What:** Demonstrate Temporal workflow capabilities with a parent workflow that spawns child workflows using `executeChild`.
**When to use:** Plan 01-04 (Temporal spike).

```typescript
// packages/worker/src/workflows/hello.workflow.ts
import { proxyActivities, executeChild } from "@temporalio/workflow";
import type * as activities from "../activities/hello.activity";

const { greet } = proxyActivities<typeof activities>({
  startToCloseTimeout: "1 minute",
});

// Child workflow
export async function greetingWorkflow(name: string): Promise<string> {
  return await greet(name);
}

// Parent workflow that spawns children
export async function parentGreetingWorkflow(
  names: string[]
): Promise<string[]> {
  const results = await Promise.all(
    names.map((name) =>
      executeChild(greetingWorkflow, {
        args: [name],
        workflowId: `greeting-${name}-${Date.now()}`,
      })
    )
  );
  return results;
}
```

```typescript
// packages/worker/src/activities/hello.activity.ts
export async function greet(name: string): Promise<string> {
  return `Hello, ${name}!`;
}
```

```typescript
// packages/worker/src/worker.ts
import { Worker } from "@temporalio/worker";
import * as activities from "./activities/hello.activity";

async function run() {
  const worker = await Worker.create({
    workflowsPath: require.resolve("./workflows/hello.workflow"),
    activities,
    taskQueue: "hello-world",
  });
  await worker.run();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

### Anti-Patterns to Avoid

- **Putting all schemas in one file:** Split Drizzle schemas by domain (users.ts, test-runs.ts) and re-export from index.ts. One giant schema file becomes unmaintainable.
- **Skipping the cookie plugin:** Without `tanstackStartCookies()`, Better Auth sessions will not persist across browser refresh in TanStack Start. This is the most common auth integration failure.
- **Using Bun runtime:** Bun has dynamic route bugs with Nitro (which TanStack Start uses). Use Node.js 22 for runtime. Bun is package manager only.
- **Importing activity implementations in workflow files:** Workflows must only import activity types (`import type * as activities`), never the actual implementations. The Temporal sandbox will throw errors otherwise.
- **Running Temporal worker with `ts-node` or `tsx`:** Temporal workers require the `workflowsPath` to point to compiled JS or use the built-in bundler. Use `require.resolve` or pre-bundle workflows.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session management | Custom JWT/cookie handling | Better Auth `tanstackStartCookies` plugin | Session persistence, CSRF, cookie security, refresh tokens all handled automatically. |
| Password hashing | Custom bcrypt/argon2 implementation | Better Auth email/password plugin | Salt generation, timing-safe comparison, configurable rounds handled internally. |
| Database migrations | Manual SQL scripts | Drizzle Kit `generate` + `migrate` | Tracks migration state, generates diffs, handles rollbacks. |
| Auth schema tables | Manual user/session table definitions | Better Auth CLI `npx auth@latest generate` | Generates correct Drizzle schema for user, session, account, verification tables with proper relations. |
| Monorepo task orchestration | Custom shell scripts | Turborepo `turbo.json` pipeline | Dependency graph, caching, parallelization handled automatically. |
| Route protection middleware | Custom auth checking on every route | TanStack Router `beforeLoad` + pathless layouts | Type-safe, runs on both server and client navigation, redirect handling built in. |

**Key insight:** Phase 1 is almost entirely "wire existing tools together correctly." The risk is in misconfiguration, not in missing functionality. Every capability needed already exists in the chosen libraries.

## Common Pitfalls

### Pitfall 1: shadcn Path Aliases Break in Monorepo

**What goes wrong:** After moving the scaffolded app into `packages/web/`, shadcn component imports (`@/components/ui/button`) stop resolving because `tsconfig.json` paths are relative to the original project root.
**Why it happens:** The `create` command generates a single-app project. Moving it into a monorepo changes relative paths.
**How to avoid:** After restructuring, update `packages/web/tsconfig.json` to set `paths` relative to the new location. Update `components.json` aliases to match. Verify `@/` resolves to `packages/web/src/`.
**Warning signs:** TypeScript errors on shadcn component imports, `Module not found` during build.

### Pitfall 2: Better Auth Cookie Plugin Order

**What goes wrong:** Sessions do not persist across browser refresh.
**Why it happens:** The `tanstackStartCookies()` plugin must be the LAST plugin in the plugins array. If another plugin is added after it, cookies are not set correctly.
**How to avoid:** Always place `tanstackStartCookies()` as the final element in the `plugins` array. Add a comment: `// MUST be last plugin`.
**Warning signs:** Login succeeds but refreshing the page logs the user out.

### Pitfall 3: Temporal Workflow Determinism Violations

**What goes wrong:** Workflow replays produce different results, causing non-determinism errors.
**Why it happens:** Using `Date.now()`, `Math.random()`, or making network calls directly in workflow code instead of through activities.
**How to avoid:** All non-deterministic operations must be in activities. Workflows use `proxyActivities` to call them. The Temporal sandbox replaces `Date` and `Math.random` with deterministic versions, but direct I/O will still break.
**Warning signs:** `DeterminismViolationError` in worker logs during replay.

### Pitfall 4: Database Connection Pool Exhaustion

**What goes wrong:** App crashes with "too many connections" error.
**Why it happens:** Creating a new `Pool` instance on every import instead of using a singleton.
**How to avoid:** Export a single `db` instance from `packages/db/src/client.ts`. All consumers import from there. Set pool `max` to a reasonable number (10-20 for dev).
**Warning signs:** Connection timeout errors, especially after hot reload in dev.

### Pitfall 5: Temporal SDK Node.js Version Mismatch

**What goes wrong:** `@temporalio/worker` fails to load native modules or crashes on startup.
**Why it happens:** Temporal SDK 1.15.0 requires Node.js 20, 22, or 24. Running on an unsupported version causes native module load failures.
**How to avoid:** Pin Node.js 22 in `.nvmrc` or `package.json` engines field. Verify with `node --version` before running workers.
**Warning signs:** Segfaults, `Error: Cannot find module` for native bindings.

### Pitfall 6: pnpm Workspace Protocol in package.json

**What goes wrong:** Internal packages cannot find each other.
**Why it happens:** Using exact version numbers instead of `workspace:*` for internal dependencies.
**How to avoid:** Reference internal packages with `"@validater/db": "workspace:*"` in `package.json` dependencies. pnpm resolves these to the local workspace packages.
**Warning signs:** `ERR_PNPM_NO_MATCHING_VERSION` during install.

## Code Examples

### Drizzle Schema for Better Auth Tables

```typescript
// packages/db/src/schema/users.ts
// Source: Better Auth CLI generates this, but here's the expected shape
import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

**Note:** Use `npx auth@latest generate` to generate the exact schema matching your Better Auth config and plugins. The above is the expected shape for email/password auth. The generated schema should be placed in `packages/db/src/schema/` and may need minor adjustments for table naming (Better Auth expects singular names by default; use `usePlural: true` in the Drizzle adapter if using plural table names).

### Better Auth Client (Browser-side)

```typescript
// packages/web/src/lib/auth-client.ts
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_APP_URL || "http://localhost:3000",
});

// Usage in components:
// const { signIn, signUp, signOut, useSession } = authClient;
```

### Podman Compose for Dev Environment

```yaml
# docker/docker-compose.yml (read by podman compose)
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: validater
      POSTGRES_PASSWORD: validater
      POSTGRES_DB: validater
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  temporal:
    image: temporalio/auto-setup:latest
    environment:
      - DB=postgres12
      - DB_PORT=5432
      - POSTGRES_USER=temporal
      - POSTGRES_PWD=temporal
      - POSTGRES_SEEDS=temporal-db
    ports:
      - "7233:7233"
    depends_on:
      - temporal-db

  temporal-db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: temporal
      POSTGRES_PASSWORD: temporal
      POSTGRES_DB: temporal
    volumes:
      - temporal_data:/var/lib/postgresql/data

  temporal-ui:
    image: temporalio/ui:latest
    environment:
      - TEMPORAL_ADDRESS=temporal:7233
      - TEMPORAL_CORS_ORIGINS=http://localhost:3000
    ports:
      - "8080:8080"
    depends_on:
      - temporal

volumes:
  postgres_data:
  temporal_data:
```

### Internal Package Structure

```json
// packages/core/package.json
{
  "name": "@validater/core",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./types": "./src/types/index.ts",
    "./schemas": "./src/schemas/index.ts"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  },
  "dependencies": {
    "zod": "^3.0.0"
  }
}
```

```json
// packages/db/package.json
{
  "name": "@validater/db",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/client.ts",
    "./schema": "./src/schema/index.ts"
  },
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio"
  },
  "dependencies": {
    "drizzle-orm": "^0.45.0",
    "pg": "^8.0.0",
    "dotenv": "^16.0.0"
  },
  "devDependencies": {
    "drizzle-kit": "latest",
    "@types/pg": "^8.0.0",
    "typescript": "^5.7.0"
  }
}
```

### Root package.json Scripts

```json
{
  "name": "validater",
  "private": true,
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "typecheck": "turbo typecheck",
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "format": "biome format --write .",
    "test": "turbo test",
    "db:push": "pnpm --filter @validater/db db:push",
    "db:generate": "pnpm --filter @validater/db db:generate",
    "db:migrate": "pnpm --filter @validater/db db:migrate",
    "podman:up": "podman compose -f docker/docker-compose.yml up -d",
    "podman:down": "podman compose -f docker/docker-compose.yml down",
    "temporal:worker": "pnpm --filter @validater/worker start"
  },
  "devDependencies": {
    "turbo": "^2.8.0",
    "@biomejs/biome": "^1.0.0",
    "typescript": "^5.7.0"
  },
  "packageManager": "pnpm@9.15.0",
  "engines": {
    "node": ">=22.0.0"
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@radix-ui/react-*` individual packages | `radix-ui` unified package | Feb 2026 | shadcn/ui now uses single radix-ui import. Components generated by CLI already use the new import. |
| Lucia Auth | Better Auth | Mar 2025 (Lucia deprecated) | Better Auth is now the standard. Auth.js team joined Better Auth Sep 2025. |
| Tailwind CSS v3 (JS config) | Tailwind CSS v4 (CSS-first config) | 2025 | No `tailwind.config.ts`. Configuration via CSS `@theme` directive. shadcn CLI handles this. |
| `temporalio/docker-compose` repo | `temporalio/samples-server` repo | Jan 2026 (archived) | Compose files moved. Use `temporalio/auto-setup` image for simplest dev server. |
| `next()` middleware pattern | TanStack Start composable middleware | 2025 | Middleware uses `.middleware([fn])` chain with typed context passing. |
| Drizzle Kit `introspect` | Drizzle Kit `pull` | 2025 | Command renamed. `generate` for code-first, `pull` for database-first. |

**Deprecated/outdated:**
- `temporalio/docker-compose` GitHub repo: archived Jan 2026. Compose examples moved to `temporalio/samples-server`.
- Lucia Auth: deprecated March 2025. Use Better Auth.
- `@radix-ui/react-dialog` (individual packages): replaced by unified `radix-ui` package (Feb 2026).

## Open Questions

1. **shadcn `create` command vs `pnpm create @tanstack/start`**
   - What we know: Two scaffolding approaches exist. The `bunx --bun shadcn@latest create --rtl --preset "..."` command from the project context uses a specific preset URL. The `pnpm create @tanstack/start@latest --tailwind --add-ons shadcn` command is the TanStack-recommended approach.
   - What's unclear: Whether the preset URL from the project context produces a different output than the TanStack CLI approach. The preset URL includes RTL, Lyra style, emerald theme, and Remix icons specifically.
   - Recommendation: Try the preset URL command first since it's explicitly specified in the project decisions. If it fails or produces unexpected output, fall back to `pnpm create @tanstack/start@latest` and manually configure shadcn with the preset settings. Document what actually works in the plan.

2. **Better Auth schema generation in monorepo**
   - What we know: `npx auth@latest generate` generates Drizzle schema files. It needs to find the auth config to determine which tables to generate.
   - What's unclear: Whether the CLI correctly finds the auth config when it's in `packages/web/` and the schema output needs to go to `packages/db/`. May need `--output` flag or manual file relocation.
   - Recommendation: Generate schema in `packages/web/`, then move the generated files to `packages/db/src/schema/`. Alternatively, write the schema manually based on Better Auth's documented table structure (it's only 4 tables for email/password).

3. **Temporal auto-setup image with separate PostgreSQL**
   - What we know: `temporalio/auto-setup` supports PostgreSQL. It can use an external PostgreSQL instance.
   - What's unclear: Whether sharing the same PostgreSQL server for both app data and Temporal data causes issues, or if separate instances are cleaner.
   - Recommendation: Use separate PostgreSQL containers (one for app, one for Temporal) to avoid conflicts. This matches the docker-compose example above.

## Sources

### Primary (HIGH confidence)
- [Better Auth TanStack Start Integration](https://better-auth.com/docs/integrations/tanstack) - Route handler, cookie plugin, session helpers, route protection patterns
- [Better Auth Drizzle Adapter](https://better-auth.com/docs/adapters/drizzle) - Adapter config, schema generation, table mapping, usePlural option
- [Better Auth Installation](https://better-auth.com/docs/installation) - Auth instance setup, email/password config, env vars
- [Drizzle ORM PostgreSQL Setup](https://orm.drizzle.team/docs/get-started/postgresql-new) - Schema definition, drizzle.config.ts, migration commands
- [Temporal TypeScript SDK Core Application](https://docs.temporal.io/develop/typescript/core-application) - Workflow/activity definition, worker setup, client config
- [Temporal Child Workflows](https://docs.temporal.io/develop/typescript/child-workflows) - startChild, executeChild, parentClosePolicy
- [shadcn/ui Monorepo Guide](https://ui.shadcn.com/docs/monorepo) - Workspace structure, dual components.json, alias configuration
- [shadcn/ui TanStack Start Installation](https://ui.shadcn.com/docs/installation/tanstack) - Create command, component adding
- [TanStack Start Server Functions](https://tanstack.com/start/latest/docs/framework/react/guide/server-functions) - createServerFn API
- [TanStack Start Middleware](https://tanstack.com/start/latest/docs/framework/react/guide/middleware) - Composable middleware chain

### Secondary (MEDIUM confidence)
- [Temporal Docker Compose (archived)](https://github.com/temporalio/docker-compose) - Port mappings, available configurations, auto-setup image (works with podman compose)
- [monorepo-tanstarter (archived)](https://github.com/dotnize/monorepo-tanstarter) - Reference implementation of Turborepo + TanStack Start + Better Auth + Drizzle
- [daveyplate/better-auth-tanstack-starter](https://github.com/daveyplate/better-auth-tanstack-starter) - Better Auth + TanStack Start + PostgreSQL + Drizzle reference
- [Turborepo Structuring Guide](https://turborepo.dev/docs/crafting-your-repository/structuring-a-repository) - apps vs packages pattern, internal package design

### Tertiary (LOW confidence)
- [WorkOS: Top 5 Auth for TanStack Start 2026](https://workos.com/blog/top-authentication-solutions-tanstack-start-2026) - Ecosystem overview (marketing content)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries are locked decisions with verified versions and official documentation
- Architecture: HIGH - Patterns verified against official TanStack Start, Better Auth, and Temporal documentation
- Pitfalls: HIGH - Based on official docs, known issues, and documented gotchas from framework authors
- Code examples: MEDIUM - Synthesized from official docs but not all tested in this exact monorepo configuration

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (30 days - stack is stable, TanStack Start RC is the most volatile component)
