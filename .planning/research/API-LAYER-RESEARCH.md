# API Layer Research: TanStack Start as the Full API Layer

**Researched:** 2026-03-06
**Context:** Evaluating whether TanStack Start server functions can serve as the complete API layer for Validater, a TypeScript application targeting Bun runtime.

---

## 1. TanStack Start Server Functions

Server functions are created via `createServerFn()` and execute exclusively on the server, but can be called from client code (loaders, components, hooks) as if they were local functions. Under the hood, the build process extracts server function implementations into a separate server bundle and replaces them with RPC stubs in client bundles. Communication happens via `fetch`.

**Key characteristics:**
- Support `GET` and `POST` HTTP methods
- Accept a single data parameter with built-in validation (Zod schemas supported)
- Composable middleware chain via `.middleware([...])`
- Client/server split is automatic -- server code never reaches the browser
- Type inference flows from server function definition to call site

**How they differ from Next.js server actions:**
- Server actions are tightly coupled to form submissions and React transitions. TanStack Start server functions are general-purpose RPC -- callable from anywhere (loaders, event handlers, effects, other server functions).
- Server functions support both GET (cacheable) and POST methods, whereas Next.js server actions are POST-only.

**Example pattern:**
```typescript
const getTodos = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(z.object({ userId: z.string() }))
  .handler(async ({ data, context }) => {
    return todoRepository.get(data.userId);
  });
```

**Sources:**
- [Server Functions docs](https://tanstack.com/start/latest/docs/framework/react/guide/server-functions)
- [Server Function Benefits](https://www.brenelz.com/posts/server-function-benefits/)

---

## 2. TanStack Start API Routes (Server Routes)

TanStack Start supports dedicated server routes for raw HTTP request handling. These are defined alongside regular routes in the `./src/routes` directory.

**Two approaches exist:**
1. **`createAPIFileRoute`** -- older pattern for REST-style endpoints with explicit HTTP method handlers (GET, POST, PUT, DELETE). Receives raw `Request`, returns raw `Response`.
2. **`createServerFileRoute().methods({...})`** -- newer pattern with the same capabilities.

**Use cases:** Webhooks, OAuth callbacks, file uploads, third-party integrations, any endpoint that needs to be accessed outside the TanStack Start client (e.g., by external services, mobile apps).

**Limitation:** Server routes are lower-level than server functions -- no automatic type inference across client/server, no built-in validation chain. They are escape hatches, not the primary API pattern.

**Known issue (Bun):** A [Nitro issue (#3808)](https://github.com/nitrojs/nitro/issues/3808) documents that dynamic API endpoints created via `createFileRoute` return 404 errors when using the Bun preset. This is a Nitro-level bug, not a TanStack Start issue, but it affects Bun deployments.

**Sources:**
- [Server Routes docs](https://tanstack.com/start/latest/docs/framework/react/guide/server-routes)
- [API Routes docs](https://tanstack.com/start/latest/docs/framework/react/api-routes)

---

## 3. TanStack Start + Bun Compatibility

Bun is officially supported. The TanStack CLI generates Bun-ready projects, and Bun's docs include a dedicated TanStack Start guide.

**Setup:**
```typescript
// app.config.ts
export default defineConfig({
  server: {
    preset: "bun",
  },
});
```

**Scripts must use `bun --bun` prefix** to ensure Bun (not Node) executes Vite:
```json
{
  "dev": "bun --bun vite dev",
  "build": "bun --bun vite build"
}
```

**Known issues:**
1. **Dynamic API routes returning 404** with the Bun Nitro preset (see Section 2).
2. **Vercel deployment** -- do NOT use the `bun` Nitro preset on Vercel; use the Vercel runtime configured for Bun instead.
3. **Custom server option** -- a custom `server.ts` can bypass Nitro entirely, using Bun's native APIs for asset serving, compression, and ETag support. This is the more reliable path for production.

**Critical caveat for Validater:** The existing STACK.md specifies Node.js 22 LTS as the runtime because **Temporal SDK requires Node.js** (supports 20, 22, 24). Bun cannot run the Temporal worker. The web server could run on Bun, but the Temporal worker process must remain on Node.js. This creates a split-runtime architecture.

**Sources:**
- [Bun TanStack Start guide](https://bun.com/docs/guides/ecosystem/tanstack-start)
- [Deploying on Cloud Run with Bun](https://medium.com/@chadbell045/deploying-tanstack-start-on-cloud-run-with-docker-bun-d4e66c246557)

---

## 4. Type Safety

TanStack Start provides end-to-end type safety between client and server for server functions:

- **Input types** are inferred from the `.validator()` schema (Zod, Valibot, or custom)
- **Return types** flow from the handler back to the call site
- **Middleware context** is fully typed -- if auth middleware provides `userSession`, downstream handlers see it typed
- **Route params** are type-safe via TanStack Router integration

**Compared to tRPC:**
- tRPC provides the same input/output type inference plus: output validation, procedure batching, subscription support (WebSockets), and exportable API contracts.
- TanStack Start server functions lack: batching, output validation, contract export for cross-framework consumption, and automatic query key generation for cache invalidation.

**Tanner Linsley's official position** (from [GitHub Discussion #3884](https://github.com/TanStack/router/discussions/3884)):
> "Server functions are not a reinvention of the wheel since they fundamentally do something that none of these tools do with regards to isomorphism, code splitting and colocation."
>
> The team has "no plans to replicate any full stack public API design tools including tRPC" and recommends tRPC/Hono for advanced API needs.

**Verdict:** Type safety is sufficient for client-to-server calls within the TanStack Start app. It is NOT sufficient for exposing a typed API to external consumers or for advanced patterns like batching.

---

## 5. Comparison: Server Functions vs tRPC vs Hono

| Capability | TanStack Start Server Fns | tRPC | Hono |
|---|---|---|---|
| **Type safety (client-server)** | Full inference | Full inference | Manual (or via RPC mode) |
| **Input validation** | Built-in (Zod) | Built-in (Zod) | Manual or via middleware |
| **Output validation** | No | Yes | No |
| **Batching** | No | Yes | No |
| **Middleware** | Composable, typed | Composable, typed | Composable, typed |
| **WebSocket support** | Experimental (via h3/crossws) | Yes (subscriptions) | Yes (native) |
| **Code splitting** | Automatic | No | No |
| **Colocation** | Yes (in components) | No (separate router) | No (separate server) |
| **External API consumers** | No contract export | Yes (contract export) | Yes (OpenAPI via @hono/zod-openapi) |
| **SSR optimization** | Built-in (no network on server) | Requires setup | N/A |
| **Bun compatibility** | Yes (with caveats) | Yes | Yes (native) |
| **Maturity** | RC / early stable | Stable, battle-tested | Stable, battle-tested |

**DX verdict:** For internal client-server calls within a full-stack app, TanStack Start server functions offer the best DX due to colocation and automatic code splitting. For a public API or cross-service communication, tRPC or Hono are superior.

---

## 6. Middleware (Auth & Validation)

TanStack Start middleware is composable and fully typed.

**Auth middleware pattern:**
```typescript
import { createMiddleware } from '@tanstack/react-start';

export const authMiddleware = createMiddleware({ type: 'function' })
  .server(async ({ next }) => {
    const session = await getUserSession();
    if (!session) throw redirect({ to: '/login' });
    return next({ context: { userSession: session } });
  });

// Usage
const getSecretData = createServerFn()
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    // context.userSession is fully typed
    return db.query(context.userSession.user.id);
  });
```

**Validation:** Input validation via `.validator()` with Zod schemas. Runs before the handler. Type-safe -- the validated type flows to the handler's `data` parameter.

**Global middleware:** `registerGlobalMiddleware()` applies middleware to all server functions (e.g., logging, rate limiting).

**Integrations:** Better Auth and Clerk both have official TanStack Start integrations.

**Sources:**
- [Middleware docs](https://tanstack.com/start/latest/docs/framework/react/guide/middleware)
- [Auth middleware tutorial](https://dev.to/hirotoshioi/how-to-protect-server-functions-with-auth-middleware-in-tanstack-start-opj)

---

## 7. WebSocket Support

**Status: Experimental / Limited**

TanStack Start runs on h3 (via Nitro), which has experimental WebSocket support via [crossws](https://crossws.unjs.io/). You can define WebSocket handlers using `defineWebSocketHandler`.

**Limitations:**
- TanStack Start does not expose the underlying server configuration for WebSocket setup
- Dev and preview modes may not support WebSocket pass-through
- Community workarounds exist but are fragile

**Alternatives for live streaming in Validater:**
1. **Server-Sent Events (SSE)** -- Use `ReadableStream` + `Response` in a server route. Simpler, works reliably, sufficient for server-to-client push (test execution streaming).
2. **Separate WebSocket server** -- Run a Hono or raw Bun WebSocket server alongside TanStack Start for bidirectional communication.
3. **Third-party** -- Pusher, Ably, or similar for managed WebSocket infrastructure.

**Recommendation for Validater:** SSE is the pragmatic choice for streaming test execution results. If true bidirectional WebSocket is needed later (e.g., collaborative editing, live agent interaction), run a separate Hono WebSocket server.

**Sources:**
- [WebSocket discussion #4576](https://github.com/TanStack/router/discussions/4576)
- [WebSocket discussion #3096](https://github.com/TanStack/router/discussions/3096)
- [WebSocket adapter gist](https://gist.github.com/darkobits/4b2073742af7d89707e216915fae7e9d)

---

## 8. Temporal Integration

There is no direct integration between TanStack Start and Temporal. However, server functions can call Temporal workflows just like any other server-side code:

```typescript
const startTestRun = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(z.object({ testSuiteId: z.string(), config: TestConfigSchema }))
  .handler(async ({ data, context }) => {
    const client = getTemporalClient();
    const handle = await client.workflow.start(runTestSuiteWorkflow, {
      args: [{ suiteId: data.testSuiteId, config: data.config }],
      taskQueue: 'test-execution',
      workflowId: `test-run-${data.testSuiteId}-${Date.now()}`,
    });
    return { workflowId: handle.workflowId, runId: handle.firstExecutionRunId };
  });
```

Server functions run on the server, so they have full access to the Temporal client SDK. There are no architectural barriers. The Temporal client (not the worker) is lightweight and works in any Node.js/Bun environment.

---

## Recommendation for Validater

### Use TanStack Start server functions as the PRIMARY API layer

**Rationale:**
1. **Colocation + code splitting** -- Server functions live next to the components that use them. The build automatically splits client/server code. This is a DX advantage that tRPC and Hono cannot match.
2. **Type safety is sufficient** -- For Validater's use case (a single web application, not a public API), the input-type inference and middleware context typing provide adequate type safety.
3. **Middleware is production-ready** -- Auth, validation, and logging middleware patterns are well-established with full type inference.
4. **Temporal integration is straightforward** -- Server functions can call the Temporal client directly.

### Keep Hono as a SECONDARY layer for:
1. **WebSocket/SSE endpoints** -- TanStack Start's WebSocket support is experimental. Use Hono for the live streaming endpoint (test execution progress, agent activity feed).
2. **Webhook receivers** -- External services (GitHub, CI/CD, Stripe) need stable URL endpoints. Hono or TanStack Start server routes can handle these, but Hono is more battle-tested for this.
3. **Future public API** -- If Validater ever needs to expose an API for third-party integrations, Hono with `@hono/zod-openapi` generates OpenAPI specs automatically.

### Do NOT add tRPC
- tRPC would be redundant alongside TanStack Start server functions for internal app communication.
- The TanStack team explicitly recommends against trying to replicate tRPC features in server functions, and instead suggests using them as complementary tools. But for Validater's scope, server functions cover the needs.
- Adding tRPC increases complexity (separate router definition, separate client setup) without clear benefit for a single-app architecture.

### Architecture summary

```
Browser (React + TanStack Router)
  |
  |-- Server Functions (createServerFn) --> Primary API layer
  |     |-- Auth middleware
  |     |-- Input validation (Zod)
  |     |-- Temporal client calls
  |     |-- Database queries (Drizzle)
  |
  |-- SSE/WebSocket (Hono) --> Live streaming layer
  |     |-- Test execution progress
  |     |-- Agent activity feed
  |
  |-- Server Routes (createAPIFileRoute) --> Webhook receivers
        |-- GitHub webhooks
        |-- Payment webhooks
```

### Runtime note
The STACK.md specifies Node.js 22 LTS due to the Temporal SDK requirement. If the web server runs on Bun for performance, the Temporal worker MUST run as a separate Node.js process. Evaluate whether the Bun performance gain justifies the split-runtime complexity. For simplicity, running everything on Node.js 22 is the safer choice; Bun can be adopted later when Temporal adds Bun support.

---

**Confidence: HIGH** -- TanStack Start server functions are well-documented, the middleware system is mature, and the TanStack team's own guidance aligns with using server functions as the primary API layer with Hono/tRPC as optional supplements.
