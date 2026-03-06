---
phase: 01-foundation-and-infrastructure
plan: 04
subsystem: authentication
tags: [better-auth, tanstack-start, drizzle-adapter, session, cookies]

# Dependency graph
requires:
  - phase: 01-foundation-and-infrastructure/03
    provides: "PostgreSQL database with Better Auth schema tables"
provides:
  - "Email/password sign-up and login via Better Auth"
  - "Session persistence across browser refresh (tanstackStartCookies)"
  - "Route protection for authenticated areas (_authed layout)"
  - "Server-side session helpers (getSession, ensureSession)"
affects:
  - "All future phases requiring authenticated user context"
  - "Phase 5 dashboard and results viewer"

# Tech stack
dependencies_added:
  - better-auth: "^1.5.4"
---

# Plan 01-04: Better Auth Authentication

## Status: COMPLETE

## Accomplishments

### Task 1: Better Auth server instance, API route, session helpers
- Created `packages/web/src/lib/auth.ts` with betterAuth instance, drizzle adapter (with schema mapping for singular model names), tanstackStartCookies plugin, baseURL and trustedOrigins config
- Created `packages/web/src/lib/auth-client.ts` with browser-side createAuthClient
- Created `packages/web/src/routes/api/auth/$.ts` catch-all API route for Better Auth
- Created `packages/web/src/server/auth.ts` with getSession and ensureSession server functions

### Task 2: Auth UI pages and route protection
- Created login page (`/login`) with email/password form using shadcn components
- Created sign-up page (`/signup`) with name/email/password form
- Created `_authed.tsx` layout route with beforeLoad session check and redirect
- Created dashboard page showing user info and sign-out button
- Updated home page with Validater branding and login/signup links

### Task 3: Verification (Playwright MCP)
- Sign-up creates account and redirects to dashboard instantly
- Session persists across browser refresh
- Sign-out clears session and redirects to login
- Route protection redirects unauthenticated users from /dashboard to /login
- Login with existing credentials works

## Deviations

1. **Schema mapping required** — Better Auth expects singular model names (user, session, account, verification) but Drizzle schema exports plural. Fixed by passing explicit schema mapping in drizzle adapter options.
2. **Renamed auth.server.ts to auth.ts** — TanStack Start's import protection blocks `*.server.*` files from client code. Since `createServerFn` already handles server-only execution, the `.server.ts` suffix is unnecessary and caused the `_authed.tsx` beforeLoad to hang.
3. **Added dotenv loading in db client** — Nitro (TanStack Start's server runtime) doesn't load `.env` from monorepo root. Added conditional dotenv loading in `packages/db/src/client.ts` when `DATABASE_URL` isn't set.
4. **Added envDir to vite.config.ts** — Points Vite to monorepo root for `.env` loading.
5. **Added baseURL and trustedOrigins** — Better Auth requires explicit origin configuration to prevent CSRF.

## Commits
- `473a853` feat(01-04): Better Auth server instance, API route, session helpers
- `5f93dfa` feat(01-04): Auth UI pages, route protection, dashboard
- `5eb8a0c` fix(01-04): resolve auth sign-up failures and import protection

## Files Modified
- packages/web/src/lib/auth.ts
- packages/web/src/lib/auth-client.ts
- packages/web/src/routes/api/auth/$.ts
- packages/web/src/server/auth.ts
- packages/web/src/routes/_authed.tsx
- packages/web/src/routes/_authed/dashboard.tsx
- packages/web/src/routes/login.tsx
- packages/web/src/routes/signup.tsx
- packages/web/src/routes/index.tsx
- packages/web/src/routes/__root.tsx
- packages/web/vite.config.ts
- packages/db/src/client.ts
