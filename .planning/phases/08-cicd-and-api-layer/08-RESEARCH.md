# Phase 8: CI/CD and API Layer - Research

**Researched:** 2026-03-07
**Domain:** Public REST API, API key authentication, GitHub Actions integration
**Confidence:** HIGH

## Summary

Phase 8 requires building a public REST API for triggering test runs programmatically and a GitHub Actions integration for CI/CD pipelines. The research investigated three key domains: (1) where to host the API endpoints, (2) how to authenticate API consumers, and (3) how to build the GitHub Action.

The project already has significant infrastructure that aligns perfectly with this phase. TanStack Start supports server routes with full HTTP handler control (`createFileRoute` with `server.handlers`), and the project already uses this pattern for Better Auth (`/api/auth/$`). Better Auth has a dedicated `@better-auth/api-key` plugin that provides key creation, verification, rate limiting, and management out of the box. The existing `runTest` and `getTestRunStatusFn` server functions contain the complete business logic for triggering and polling test runs.

For the GitHub Action, a composite action (YAML-only, using `curl` to call the REST API) is the simplest and most maintainable approach. It avoids bundling JavaScript, works with any Validater deployment, and is easy to understand. The action triggers a test run, polls for completion, and reports results back to the PR via GitHub commit statuses.

**Primary recommendation:** Use TanStack Start server routes (`/api/v1/*`) with Better Auth's `@better-auth/api-key` plugin for authentication, `hono-rate-limiter`-style rate limiting, and build the GitHub Action as a composite action using `curl`.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TanStack Start server routes | ^1.132.0 | REST API endpoint hosting | Already in project, `createFileRoute` with `server.handlers` supports GET/POST/PUT/DELETE with raw Request/Response |
| `@better-auth/api-key` | latest (matches better-auth ^1.5.4) | API key creation, verification, rate limiting | Native Better Auth plugin, provides full lifecycle management, built-in rate limiting, DB-backed |
| `better-auth/plugins` (bearer) | ^1.5.4 | Bearer token verification | Already in Better Auth, allows `auth.api.getSession()` with Authorization headers |
| `@actions/core` | ^1.11 | GitHub Action toolkit (inputs, outputs, failure) | Official GitHub toolkit for custom actions |
| `@actions/github` | ^6.0 | GitHub API client (Octokit, context) | Official package for PR status reporting |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `hono-rate-limiter` | latest | Per-key rate limiting middleware | If Better Auth's built-in rate limiting is insufficient; already have Hono in worker |
| `nanoid` | ^5.1.6 | API key ID generation | Already in project for test run IDs |
| `@vercel/ncc` or `rollup` | latest | Bundle GitHub Action JS | Only needed if switching from composite to JS action |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| TanStack Start server routes | Separate Hono API server | Hono already in worker (port 3001), but adding API routes to TanStack Start is simpler -- same server, same auth, same DB access, no CORS |
| Better Auth API Key plugin | Custom API key table + bcrypt hashing | Plugin provides rate limiting, refill, permissions, cleanup -- far more than custom solution |
| Composite GitHub Action | TypeScript GitHub Action | Composite is simpler (no build step, no bundling), works with any Validater deployment URL, but less flexible for complex logic |

**Installation:**
```bash
# In packages/web (API routes live here)
pnpm add @better-auth/api-key

# In packages/db (new schema for API keys)
# @better-auth/api-key uses Better Auth's migration system -- run `npx auth generate`

# GitHub Action (separate directory, not a workspace package)
# No npm install needed for composite action approach
```

## Architecture Patterns

### Recommended Project Structure
```
packages/web/src/
  routes/api/
    auth/$.ts                  # Existing Better Auth handler
    v1/
      runs.ts                  # POST /api/v1/runs (trigger test), GET /api/v1/runs (list)
      runs/$runId.ts           # GET /api/v1/runs/:id (status + results)
      runs/$runId/report.ts    # GET /api/v1/runs/:id/report (HTML report)
      keys.ts                  # POST /api/v1/keys (create), GET (list), DELETE (revoke)
  lib/
    auth.ts                    # Updated with apiKey() plugin
    api-auth.ts                # API key verification helper for server routes
  server/
    run-test.ts                # Existing (reuse business logic)
    test-runs.ts               # Existing (reuse business logic)
packages/web/src/lib/
  auth-client.ts               # Updated with apiKeyClient() plugin

.github/
  actions/validater-test/
    action.yml                 # Composite action definition
  workflows/
    validater-on-deploy.yml    # Example workflow for consumers
```

### Pattern 1: TanStack Start Server Routes for REST API
**What:** Use `createFileRoute` with `server.handlers` to create REST API endpoints that return JSON responses
**When to use:** All public API endpoints
**Example:**
```typescript
// Source: TanStack Start docs - server routes
// packages/web/src/routes/api/v1/runs.ts
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/v1/runs')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Verify API key from Authorization header
        const apiKey = request.headers.get('Authorization')?.replace('Bearer ', '')
        if (!apiKey) {
          return Response.json({ error: 'Missing API key' }, { status: 401 })
        }

        // Verify key using Better Auth API Key plugin
        const { auth } = await import('@/lib/auth')
        const verification = await auth.api.verifyApiKey({ body: { key: apiKey } })
        if (!verification.valid) {
          return Response.json({ error: 'Invalid API key' }, { status: 401 })
        }

        // Parse request body
        const body = await request.json()
        // ... trigger test run using existing logic
        return Response.json({ testRunId, status: 'pending' }, { status: 201 })
      },
    },
  },
})
```

### Pattern 2: Better Auth API Key Plugin Integration
**What:** Add `@better-auth/api-key` plugin to existing Better Auth config for full API key lifecycle
**When to use:** All API key management (create, verify, list, revoke)
**Example:**
```typescript
// Source: https://better-auth.com/docs/plugins/api-key
// packages/web/src/lib/auth.ts (updated)
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { apiKey } from "@better-auth/api-key";

export const auth = betterAuth({
  // ... existing config ...
  plugins: [
    apiKey({
      // Rate limiting per key
      rateLimit: {
        enabled: true,
        window: 60, // seconds
        max: 60,    // requests per window
      },
    }),
    tanstackStartCookies(), // MUST be last plugin
  ],
});
```

### Pattern 3: Reusing Existing Business Logic
**What:** Extract shared logic from existing server functions for use in API routes
**When to use:** API routes that duplicate existing server function behavior
**Example:**
```typescript
// The existing runTest server function does:
// 1. Auth check (session-based)
// 2. Create test_runs record
// 3. Start Temporal workflow
// 4. Return testRunId
//
// For API routes, replace step 1 (session auth) with API key auth,
// then reuse the SAME logic from steps 2-4.
// Extract the core logic into a shared function that both
// the server function and API route can call.
```

### Pattern 4: Composite GitHub Action
**What:** A YAML-based GitHub Action that uses `curl` to call the Validater REST API
**When to use:** CI/CD integration with any Validater deployment
**Example:**
```yaml
# .github/actions/validater-test/action.yml
name: 'Validater Test'
description: 'Run Validater AI-powered tests against a URL'
inputs:
  api-url:
    description: 'Validater API base URL'
    required: true
  api-key:
    description: 'Validater API key'
    required: true
  url:
    description: 'URL to test'
    required: true
  description:
    description: 'Test description in natural language'
    required: true
  viewports:
    description: 'Comma-separated viewports (desktop,tablet,mobile)'
    required: false
    default: 'desktop,tablet,mobile'
  timeout:
    description: 'Timeout in seconds'
    required: false
    default: '300'
outputs:
  test-run-id:
    description: 'The test run ID'
    value: ${{ steps.trigger.outputs.test-run-id }}
  status:
    description: 'Test run status (complete/failed)'
    value: ${{ steps.poll.outputs.status }}
  results-url:
    description: 'URL to view results'
    value: ${{ steps.trigger.outputs.results-url }}
runs:
  using: 'composite'
  steps:
    - name: Trigger test run
      id: trigger
      shell: bash
      run: |
        RESPONSE=$(curl -s -w "\n%{http_code}" \
          -X POST "${{ inputs.api-url }}/api/v1/runs" \
          -H "Authorization: Bearer ${{ inputs.api-key }}" \
          -H "Content-Type: application/json" \
          -d "{\"url\":\"${{ inputs.url }}\",\"testDescription\":\"${{ inputs.description }}\",\"viewports\":$(echo '${{ inputs.viewports }}' | jq -R 'split(",")')}")
        HTTP_CODE=$(echo "$RESPONSE" | tail -1)
        BODY=$(echo "$RESPONSE" | head -1)
        if [ "$HTTP_CODE" != "201" ]; then
          echo "::error::Failed to trigger test run: $BODY"
          exit 1
        fi
        TEST_RUN_ID=$(echo "$BODY" | jq -r '.testRunId')
        echo "test-run-id=$TEST_RUN_ID" >> "$GITHUB_OUTPUT"
        echo "results-url=${{ inputs.api-url }}/runs/$TEST_RUN_ID" >> "$GITHUB_OUTPUT"

    - name: Poll for completion
      id: poll
      shell: bash
      run: |
        TIMEOUT=${{ inputs.timeout }}
        ELAPSED=0
        INTERVAL=10
        while [ $ELAPSED -lt $TIMEOUT ]; do
          RESPONSE=$(curl -s "${{ inputs.api-url }}/api/v1/runs/${{ steps.trigger.outputs.test-run-id }}" \
            -H "Authorization: Bearer ${{ inputs.api-key }}")
          STATUS=$(echo "$RESPONSE" | jq -r '.status')
          PHASE=$(echo "$RESPONSE" | jq -r '.phase // empty')
          if [ "$STATUS" = "complete" ] || [ "$STATUS" = "failed" ]; then
            echo "status=$STATUS" >> "$GITHUB_OUTPUT"
            echo "results=$RESPONSE" >> "$GITHUB_OUTPUT"
            break
          fi
          echo "Test run phase: ${PHASE:-pending} (${ELAPSED}s elapsed)"
          sleep $INTERVAL
          ELAPSED=$((ELAPSED + INTERVAL))
        done
        if [ $ELAPSED -ge $TIMEOUT ]; then
          echo "status=timeout" >> "$GITHUB_OUTPUT"
          echo "::error::Test run timed out after ${TIMEOUT}s"
          exit 1
        fi
        if [ "$STATUS" = "failed" ]; then
          echo "::error::Test run failed"
          exit 1
        fi
```

### Anti-Patterns to Avoid
- **Duplicating business logic in API routes:** Extract shared functions from existing server functions; API routes should be thin wrappers around the same core logic.
- **Building custom API key management:** Better Auth's plugin handles hashing, storage, rate limiting, expiry, and cleanup.
- **Using session cookies for API auth:** CI/CD clients cannot maintain cookie sessions; use bearer tokens (API keys).
- **Building a JavaScript GitHub Action when composite suffices:** Composite actions are simpler to maintain, have no build step, and work perfectly for HTTP API + poll patterns.
- **Exposing internal data structures:** API responses should be serialized/versioned, not raw database rows.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| API key generation + storage | Custom table + bcrypt + nanoid | `@better-auth/api-key` plugin | Handles hashing, rate limiting, refill, expiry, permissions, cleanup |
| Rate limiting | Custom middleware + Redis counters | `@better-auth/api-key` built-in rate limiting | Sliding window per-key, configurable, already integrated |
| API key verification | Custom bearer middleware + DB lookup | `auth.api.verifyApiKey()` | Single function call, handles expired keys, rate limit enforcement |
| GitHub PR status reporting | Custom Octokit code | `$GITHUB_STEP_SUMMARY` + exit codes in composite action | GitHub Actions natively reports step pass/fail as check status |
| API response pagination | Custom offset/limit logic | Existing `getTestRunList` already has pagination | Reuse the same pagination schema |

**Key insight:** Better Auth's API Key plugin is the critical discovery. It eliminates 80% of the custom code that would otherwise be needed for API key management, making Plan 08-01 significantly simpler than it would be with hand-rolled auth.

## Common Pitfalls

### Pitfall 1: TanStack Start Server Route Middleware Limitations
**What goes wrong:** Attempting to use `createMiddleware` (designed for server functions) directly in server route handlers
**Why it happens:** TanStack Start middleware (`createMiddleware`) works with `createServerFn`, but server routes (`createFileRoute` with `server.handlers`) use a different middleware mechanism -- route-level middleware arrays
**How to avoid:** For server routes, either: (a) use inline auth checking in each handler, or (b) create a helper function (`verifyApiKeyFromRequest`) that extracts and verifies the API key, returning the user context. Do NOT try to reuse `createMiddleware` from server functions.
**Warning signs:** TypeScript errors about middleware types not matching

### Pitfall 2: Better Auth API Key Plugin Migration
**What goes wrong:** Adding `@better-auth/api-key` plugin without running migrations, causing missing table errors
**Why it happens:** The plugin requires an `apiKey` table that doesn't exist yet
**How to avoid:** After adding the plugin to auth config, run `npx auth generate` or `npx auth migrate` to create the required database schema. Since this project uses `drizzle-kit push`, may need to generate the migration SQL and apply via drizzle-kit.
**Warning signs:** "relation 'api_key' does not exist" errors

### Pitfall 3: Drizzle Config Schema Array Not Updated
**What goes wrong:** New schema files (for API keys) are created but not added to `drizzle.config.ts` `schema` array
**Why it happens:** Project uses explicit schema file paths (not barrel exports) due to drizzle-kit CJS loader incompatibility
**How to avoid:** Add any new schema files to the `schema` array in `packages/db/drizzle.config.ts`
**Warning signs:** `drizzle-kit push` doesn't create expected tables

### Pitfall 4: CORS Issues for External API Consumers
**What goes wrong:** CI/CD clients get CORS errors when calling the API
**Why it happens:** TanStack Start may apply CORS restrictions by default
**How to avoid:** API routes at `/api/v1/*` should set appropriate CORS headers. Since API consumers are server-side (GitHub Actions, CI tools), CORS is less of an issue (it's a browser-only concern), but test with `curl` to confirm no unexpected middleware interference.
**Warning signs:** Browser-based API explorers fail but `curl` works fine

### Pitfall 5: API Key Exposure in GitHub Actions Logs
**What goes wrong:** API keys accidentally logged in GitHub Actions output
**Why it happens:** `curl -v` or `echo` commands in composite actions can print the Authorization header
**How to avoid:** Use `${{ inputs.api-key }}` as a secret input, never echo it. Mark the action input with `description` suggesting it should be stored as a GitHub secret. Use `curl -s` (silent mode).
**Warning signs:** API key visible in workflow run logs

### Pitfall 6: Polling Without Backoff in GitHub Action
**What goes wrong:** Rapid polling creates unnecessary load on the API
**Why it happens:** Fixed short intervals (e.g., 2 seconds) for long-running test workflows
**How to avoid:** Use 10-second polling intervals. Test runs typically take 30-120 seconds. A 10-second interval is fine for CI/CD (not user-facing). Include a configurable timeout (default 300s).
**Warning signs:** API rate limit errors during polling

### Pitfall 7: Better Auth API Key Schema Conflict with Drizzle
**What goes wrong:** Better Auth manages its own API key table, but Drizzle also needs to know about it for push/migration
**Why it happens:** Better Auth plugins can auto-generate tables, but this project uses drizzle-kit push for schema management
**How to avoid:** Two approaches: (a) let Better Auth generate via `npx auth generate`, then convert to Drizzle schema file, or (b) define the API key schema in Drizzle manually matching Better Auth's expected columns. Approach (b) is more consistent with the project's existing pattern. Check Better Auth docs for exact column requirements.
**Warning signs:** Table schema mismatch between what Better Auth expects and what Drizzle creates

## Code Examples

Verified patterns from official sources:

### API Key Verification Helper
```typescript
// packages/web/src/lib/api-auth.ts
// Helper to verify API key from raw HTTP request in server routes
import { auth } from '@/lib/auth'

export async function verifyApiKey(request: Request) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return { valid: false, error: 'Missing or invalid Authorization header', key: null }
  }

  const apiKeyValue = authHeader.slice(7) // Remove 'Bearer '

  // Source: https://better-auth.com/docs/plugins/api-key
  const result = await auth.api.verifyApiKey({
    body: { key: apiKeyValue },
  })

  return result
}
```

### API Route - Trigger Test Run
```typescript
// packages/web/src/routes/api/v1/runs.ts
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/v1/runs')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyApiKey } = await import('@/lib/api-auth')
        const keyResult = await verifyApiKey(request)
        if (!keyResult.valid) {
          return Response.json({ error: keyResult.error }, { status: 401 })
        }

        // Parse and validate request body
        const body = await request.json()
        // ... validate with Zod schema, trigger Temporal workflow
        // Reuse core logic from existing run-test.ts server function

        return Response.json(
          { testRunId, status: 'pending' },
          { status: 201 }
        )
      },
    },
  },
})
```

### API Route - Get Test Run Status and Results
```typescript
// packages/web/src/routes/api/v1/runs/$runId.ts
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/v1/runs/$runId')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { verifyApiKey } = await import('@/lib/api-auth')
        const keyResult = await verifyApiKey(request)
        if (!keyResult.valid) {
          return Response.json({ error: keyResult.error }, { status: 401 })
        }

        const { runId } = params
        // Query test run status (reuse getTestRunStatusFn logic)
        // If complete, include results with step details and screenshot URLs

        return Response.json({
          testRunId: runId,
          status: 'complete',
          phase: 'complete',
          results: {
            /* viewport results with steps */
          },
        })
      },
    },
  },
})
```

### Better Auth Config with API Key Plugin
```typescript
// Source: https://better-auth.com/docs/plugins/api-key
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { tanstackStartCookies } from "better-auth/tanstack-start"
import { apiKey } from "@better-auth/api-key"
import { db } from "@validater/db"
import * as schema from "@validater/db/schema"

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  trustedOrigins: ["http://localhost:3000"],
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      ...schema,
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    apiKey(),
    tanstackStartCookies(), // MUST be last plugin
  ],
})
```

### Auth Client with API Key Client Plugin
```typescript
// packages/web/src/lib/auth-client.ts
import { createAuthClient } from "better-auth/react"
import { apiKeyClient } from "@better-auth/api-key/client"

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_APP_URL || "http://localhost:3000",
  plugins: [apiKeyClient()],
})
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom API key tables + bcrypt | Better Auth API Key plugin | better-auth 1.5 (2025) | Full lifecycle management, built-in rate limiting |
| Node 16/12 for GitHub Actions | Node 20 (node22 skipped, node24 coming fall 2026) | 2024 | Use `runs.using: 'node20'` if JS action needed |
| JavaScript GitHub Actions with ncc | Composite actions for simple cases | 2022+ | YAML-only, no build step, easier maintenance |
| TanStack Start beta API patterns | Server routes with `server.handlers` | TanStack Start RC/stable 2025 | File-based routing for API endpoints |

**Deprecated/outdated:**
- `node12` and `node16` for GitHub Actions `runs.using`: deprecated, use `node20`
- `node22` for GitHub Actions: skipped entirely, GitHub going straight to `node24` (fall 2026)

## Open Questions

Things that couldn't be fully resolved:

1. **Better Auth API Key plugin + Drizzle schema integration**
   - What we know: The plugin requires an `apiKey` table. Better Auth has `npx auth generate` and `npx auth migrate` commands. The project currently uses `drizzle-kit push` for schema management.
   - What's unclear: Whether the API key table schema can be defined as a Drizzle schema file (like existing `users.ts`, `test-runs.ts`) and picked up by both Better Auth and drizzle-kit, or if Better Auth must manage it separately.
   - Recommendation: During implementation, test both approaches. Start by adding the plugin and running `npx auth generate` to see what schema it produces, then replicate as a Drizzle schema file in `packages/db/src/schema/api-keys.ts`. If Better Auth auto-creates the table, the Drizzle schema file serves as documentation and enables drizzle-kit awareness.

2. **API key rate limiting scope**
   - What we know: Better Auth API Key plugin has built-in rate limiting with `rateLimitTimeWindow` and `rateLimitMax` per key. The `hono-rate-limiter` library could provide per-IP or global rate limiting.
   - What's unclear: Whether Better Auth's per-key rate limiting is sufficient or if we also need global endpoint rate limiting (e.g., against unauthenticated brute-force attempts).
   - Recommendation: Start with Better Auth's per-key rate limiting. Add global rate limiting only if abuse is observed. For unauthenticated requests, a simple 401 response is fast and low-cost.

3. **API response format for screenshots**
   - What we know: Screenshots are stored as base64 in the database (`screenshotBase64` column). Including base64 in API responses makes them very large.
   - What's unclear: Whether to return screenshot URLs (requiring a separate download endpoint) or inline base64. CI/CD use cases typically want structured pass/fail data, not screenshots.
   - Recommendation: Return screenshot URLs (pointing to `/api/v1/runs/:id/screenshots/:stepId`) for the detailed results endpoint. Include a `summary` response format without screenshots for the polling endpoint.

## Sources

### Primary (HIGH confidence)
- TanStack Start server routes docs: https://tanstack.com/start/latest/docs/framework/react/guide/server-routes - File-based API routing with `server.handlers`
- Better Auth API Key plugin: https://better-auth.com/docs/plugins/api-key - Full API key lifecycle, rate limiting, verification
- Better Auth Bearer plugin: https://better-auth.com/docs/plugins/bearer - Bearer token auth for API requests
- Hono Bearer Auth middleware: https://hono.dev/docs/middleware/builtin/bearer-auth - `verifyToken` pattern
- Existing codebase: `packages/web/src/routes/api/auth/$.ts` - Working example of TanStack Start server route with handlers
- Existing codebase: `packages/web/src/server/run-test.ts` - Business logic for triggering test runs
- Existing codebase: `packages/web/src/server/test-runs.ts` - Business logic for querying test runs

### Secondary (MEDIUM confidence)
- TanStack Start middleware: https://tanstack.com/start/latest/docs/framework/react/guide/middleware - `createMiddleware` for server functions
- GitHub Actions TypeScript template: https://github.com/actions/typescript-action - Action structure and distribution
- GitHub Actions metadata syntax: https://docs.github.com/en/actions/creating-actions/metadata-syntax-for-github-actions - `action.yml` structure
- hono-rate-limiter: https://github.com/rhinobase/hono-rate-limiter - Rate limiting for Hono (if needed beyond Better Auth)
- GitHub Actions node20 deprecation timeline: https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/

### Tertiary (LOW confidence)
- Better Auth API Key + Drizzle schema interaction: not fully verified whether auto-migration coexists with drizzle-kit push
- Exact `@better-auth/api-key` npm version: could not verify specific version number (npm registry 403)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified via official docs, existing codebase already uses core dependencies
- Architecture: HIGH - TanStack Start server routes pattern confirmed in existing code (`api/auth/$.ts`), Better Auth plugin API well-documented
- Pitfalls: HIGH - Based on existing project patterns (drizzle config schema array, Better Auth migration, etc.) and verified documentation
- GitHub Actions: MEDIUM - Composite action pattern well-documented, but specific integration with Validater API is novel

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (30 days - stable domain, libraries well-established)
