---
phase: 08-cicd-and-api-layer
plan: 01
subsystem: api
tags: [better-auth, api-key, drizzle, tanstack-start, settings]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: Better Auth config, drizzle schema, authed layout
provides:
  - "@better-auth/api-key plugin configured in auth.ts with rate limiting"
  - "apiKeyClient configured in auth-client.ts for client-side CRUD"
  - "apikey database table matching Better Auth plugin expectations"
  - "verifyApiKey() helper for API route bearer token validation"
  - "Server functions for API key create, list, and revoke"
  - "Settings page at /settings with API key management UI"
affects: [08-02-rest-api-endpoints]

# Tech tracking
tech-stack:
  added: ["@better-auth/api-key ^1.5.4"]
  patterns: ["Better Auth plugin for API key lifecycle", "Bearer token verification helper pattern"]

key-files:
  created:
    - "packages/db/src/schema/api-keys.ts"
    - "packages/web/src/lib/api-auth.ts"
    - "packages/web/src/server/api-keys.ts"
    - "packages/web/src/routes/_authed/settings.tsx"
  modified:
    - "packages/web/src/lib/auth.ts"
    - "packages/web/src/lib/auth-client.ts"
    - "packages/db/src/schema/index.ts"
    - "packages/db/drizzle.config.ts"
    - "packages/web/src/routes/_authed.tsx"
    - "packages/web/package.json"

key-decisions:
  - "Table name is 'apikey' (no underscore) matching Better Auth API_KEY_TABLE_NAME constant"
  - "API key prefix set to 'vld_' for Validater-branded keys"
  - "Rate limiting: 60 requests per 60-second window per key"
  - "listApiKeys returns { apiKeys, total, limit, offset } -- destructured correctly"
  - "verifyApiKey helper uses dynamic import of auth to avoid circular dependencies"
  - "Used inline 'Copied' state instead of sonner/toast (not in project)"

patterns-established:
  - "Pattern: verifyApiKey(request) for all /api/v1/* route handlers"
  - "Pattern: auth.api.* with forwarded headers for session-scoped plugin calls"

# Metrics
duration: 6min
completed: 2026-03-07
---

# Phase 8 Plan 1: API Key Infrastructure Summary

**Better Auth API key plugin with vld_ prefix, rate-limited verification helper, Drizzle schema for apikey table, and settings page with create/list/revoke UI**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-07T04:47:59Z
- **Completed:** 2026-03-07T04:54:50Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments
- Installed and configured @better-auth/api-key plugin with rate limiting (60 req/60s) and vld_ prefix
- Created apikey database table schema matching Better Auth's expected structure and pushed to PostgreSQL
- Built verifyApiKey() helper that extracts Bearer tokens and validates via auth.api for use in API routes
- Built full settings page with create dialog (key shown once), table display, and revoke functionality

## Task Commits

Each task was committed atomically:

1. **Task 1: Install @better-auth/api-key and configure auth plugins** - `017dee5` (feat)
2. **Task 2: Create API key database schema and verification helper** - `576195b` (feat)
3. **Task 3: Create API key management server functions and settings page** - `0fbb349` (feat)

## Files Created/Modified
- `packages/web/package.json` - Added @better-auth/api-key dependency
- `packages/web/src/lib/auth.ts` - Added apiKey() plugin with rate limiting before tanstackStartCookies
- `packages/web/src/lib/auth-client.ts` - Added apiKeyClient() plugin for client-side CRUD
- `packages/db/src/schema/api-keys.ts` - Drizzle schema for apikey table (21 columns matching plugin)
- `packages/db/src/schema/index.ts` - Added api-keys.js export
- `packages/db/drizzle.config.ts` - Added api-keys.ts to schema array
- `packages/web/src/lib/api-auth.ts` - verifyApiKey(request) helper for Bearer token validation
- `packages/web/src/server/api-keys.ts` - createApiKeyFn, listApiKeysFn, revokeApiKeyFn server functions
- `packages/web/src/routes/_authed/settings.tsx` - Settings page with API key management UI
- `packages/web/src/routes/_authed.tsx` - Added Settings nav link in authed layout

## Decisions Made
- **Table name "apikey":** Better Auth's API_KEY_TABLE_NAME constant is "apikey" (no underscore, singular). The Drizzle schema mirrors this exactly.
- **vld_ prefix:** API keys are prefixed with "vld_" for easy identification in CI/CD configs.
- **Rate limiting config:** Used `timeWindow` (milliseconds) and `maxRequests` (not `window`/`max` as the plan suggested) -- the actual plugin API uses different property names than the plan anticipated.
- **listApiKeys return shape:** The plugin returns `{ apiKeys: [...], total, limit, offset }`, not a flat array. Had to destructure the `apiKeys` property.
- **No sonner/toast:** Project doesn't have sonner installed. Used inline "Copied" text state for clipboard feedback instead.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed listApiKeys return type mismatch**
- **Found during:** Task 3 (Server function implementation)
- **Issue:** Plan assumed `auth.api.listApiKeys` returns a flat array, but it returns `{ apiKeys: [...], total, limit, offset }`
- **Fix:** Destructured `result.apiKeys` and mapped to safe subset
- **Files modified:** packages/web/src/server/api-keys.ts
- **Verification:** TypeScript typechecks pass
- **Committed in:** 0fbb349 (Task 3 commit)

**2. [Rule 1 - Bug] Fixed verifyApiKey type errors**
- **Found during:** Task 2 (Verification helper)
- **Issue:** `result.error.message` type is `string | RawError<"INVALID_API_KEY">` (not plain string), and `result.key` is possibly null
- **Fix:** Added typeof guard for error message and null check for key
- **Files modified:** packages/web/src/lib/api-auth.ts
- **Verification:** TypeScript typechecks pass
- **Committed in:** 576195b (Task 2 commit)

**3. [Rule 1 - Bug] Removed unused users import in api-keys schema**
- **Found during:** Task 2 (Schema creation)
- **Issue:** Initially imported users table for foreign key but Better Auth manages referenceId internally
- **Fix:** Removed unused import
- **Files modified:** packages/db/src/schema/api-keys.ts
- **Verification:** No TS6133 unused import error
- **Committed in:** 576195b (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (3 bugs)
**Impact on plan:** All auto-fixes necessary for correct typing. No scope creep.

## Issues Encountered
- Better Auth CLI (`npx @better-auth/cli generate`) cannot read auth config in monorepo structure -- used TypeScript type definitions from the package dist to determine exact table schema instead.
- Plan's rate limit config property names were incorrect (`window`/`max` vs `timeWindow`/`maxRequests`) -- corrected based on actual plugin types.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- API key infrastructure complete, ready for REST API endpoints (Plan 08-02)
- `verifyApiKey()` helper ready for use in `/api/v1/*` server routes
- Settings page provides user-facing key management before API consumption

---
*Phase: 08-cicd-and-api-layer*
*Completed: 2026-03-07*
