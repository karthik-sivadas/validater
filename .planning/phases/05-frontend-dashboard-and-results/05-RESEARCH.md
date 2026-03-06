# Phase 5: Frontend -- Dashboard and Results - Research

**Researched:** 2026-03-07
**Domain:** TanStack Start/Router frontend with shadcn/ui, server functions, Drizzle ORM data queries
**Confidence:** HIGH

## Summary

This phase builds the complete user-facing web interface on top of the existing TanStack Start app scaffolded in Phase 1. The existing codebase already has: authentication (Better Auth with route protection via `_authed.tsx` layout), shadcn/ui components (button, card, input, label, select, textarea, badge, dropdown-menu, etc.), server functions (`runTest`, `getTestRunStatusFn`, `generateTest`), and a database schema with `test_runs`, `test_run_results`, and `test_run_steps` tables.

The work divides into four clear plans: (1) expanding the TanStack Start app with proper routing structure, navigation layout, and auth-context wiring; (2) building the test creation form with a progress polling UI; (3) building the results viewer with step-by-step screenshot replay and multi-viewport comparison; (4) building the test history list with filtering, pagination, and inline pass/fail reporting.

Key technical concerns are: screenshots are stored as base64 text in the database (which has performance implications for large result sets), polling for workflow status needs a clean React pattern with proper cleanup, TanStack Router search params should drive filtering/pagination state for shareable URLs, and new server functions are needed for fetching test run details and history lists.

**Primary recommendation:** Use TanStack Router's file-based routing with `_authed` layout for all dashboard pages, `validateSearch` with Zod for URL-driven filter/pagination state, `@tanstack/react-table` for the history table, and a custom `usePolling` hook for status updates during test execution.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tanstack/react-start | ^1.132.0 | Full-stack framework with server functions | Already chosen, createServerFn is the data-fetching layer |
| @tanstack/react-router | ^1.132.0 | File-based routing with type-safe search params | Already chosen, provides validateSearch, loaders, beforeLoad |
| shadcn/ui (base-lyra) | ^3.8.5 | Component library with Tailwind CSS | Already chosen, Lyra theme with emerald accent |
| drizzle-orm | ^0.45.0 | Database queries for test history/results | Already chosen, select builder API for joins and pagination |
| @remixicon/react | ^4.9.0 | Icon library | Already chosen per shadcn config (remixicon) |

### New Dependencies Required
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tanstack/react-table | latest | Headless table with sort/filter/paginate | Test history list view (05-04) |
| @tanstack/zod-adapter | latest | Zod integration for validateSearch | URL-driven search params on history page (05-04) |

### Additional shadcn/ui Components to Add
| Component | CLI Command | Purpose |
|-----------|-------------|---------|
| table | `pnpm dlx shadcn@latest add table` | Data table for test history |
| tabs | `pnpm dlx shadcn@latest add tabs` | Viewport tabs in results viewer |
| progress | `pnpm dlx shadcn@latest add progress` | Test execution progress bar |
| skeleton | `pnpm dlx shadcn@latest add skeleton` | Loading states for data |
| dialog | `pnpm dlx shadcn@latest add dialog` | Screenshot zoom/detail view |
| scroll-area | `pnpm dlx shadcn@latest add scroll-area` | Step list scrolling in replay viewer |
| tooltip | `pnpm dlx shadcn@latest add tooltip` | Status/action hints |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @tanstack/react-table | Simple map + custom sort | Table gives us free pagination, sorting, filtering -- worth the dependency for history view |
| Polling with setInterval | WebSocket/SSE for live updates | Polling is simpler and sufficient for Phase 5; live streaming deferred to Phase 6 |
| Base64 inline images | Object URL conversion or file storage API | Base64 is what exists in the DB schema -- converting to file storage is a Phase 7+ concern |

**Installation:**
```bash
cd packages/web
pnpm add @tanstack/react-table @tanstack/zod-adapter
pnpm dlx shadcn@latest add table tabs progress skeleton dialog scroll-area tooltip
```

## Architecture Patterns

### Recommended Route Structure
```
packages/web/src/routes/
  __root.tsx                           # Root layout (exists)
  _authed.tsx                          # Auth guard layout (exists, needs nav)
  _authed/
    dashboard.tsx                      # Dashboard home -> becomes test creation
    runs/
      index.tsx                        # Test history list (PLAT-03)
      $runId.tsx                       # Test run detail view (TEXE-06, VREP-01)
  index.tsx                            # Landing page (exists)
  login.tsx                            # Login (exists)
  signup.tsx                           # Signup (exists)
  api/auth/$.ts                        # Auth API (exists)
```

### Pattern 1: Server Functions for Data Fetching
**What:** All data flows through `createServerFn` -- route loaders call server functions, which query the database via Drizzle.
**When to use:** Every data-loading operation (list test runs, get test run details, get steps with screenshots).
**Example:**
```typescript
// Source: Existing pattern from packages/web/src/server/run-test.ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getTestRunDetails = createServerFn({ method: "GET" })
  .inputValidator(z.object({ testRunId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { db, testRuns, testRunResults, testRunSteps } = await import("@validater/db");
    const { eq } = await import("drizzle-orm");

    // Query test run with results and steps
    const run = await db.select().from(testRuns)
      .where(eq(testRuns.id, data.testRunId))
      .limit(1);

    const results = await db.select().from(testRunResults)
      .where(eq(testRunResults.testRunId, data.testRunId));

    // ... return assembled data
  });
```

### Pattern 2: Route Loader + Server Function
**What:** Route `loader` calls a server function to pre-fetch data before render. `beforeLoad` handles auth.
**When to use:** Pages that need data on initial load (test run detail, history list).
**Example:**
```typescript
// Source: TanStack Router docs pattern
import { createFileRoute } from "@tanstack/react-router";
import { getTestRunDetails } from "@/server/test-runs";

export const Route = createFileRoute("/_authed/runs/$runId")({
  loader: async ({ params }) => {
    return getTestRunDetails({ data: { testRunId: params.runId } });
  },
  component: TestRunDetailPage,
});

function TestRunDetailPage() {
  const data = Route.useLoaderData();
  // data is fully typed from the server function return type
}
```

### Pattern 3: URL-Driven Search Params for Filtering
**What:** Test history filtering and pagination state lives in URL search params via `validateSearch` with Zod, making views shareable and bookmarkable.
**When to use:** History list page with status filter, date range, search, and pagination.
**Example:**
```typescript
// Source: TanStack Router + @tanstack/zod-adapter docs
import { createFileRoute } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";

const searchSchema = z.object({
  page: fallback(z.number().int().positive(), 1),
  pageSize: fallback(z.number().int().positive(), 20),
  status: z.enum(["pending","complete","failed","all"]).optional(),
  search: z.string().optional(),
});

export const Route = createFileRoute("/_authed/runs/")({
  validateSearch: zodValidator(searchSchema),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    return getTestRunList({ data: deps });
  },
  component: TestHistoryPage,
});

function TestHistoryPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  // navigate({ search: { ...search, page: 2 } }) to change page
}
```

### Pattern 4: Polling Hook for Status Updates
**What:** Custom `usePolling` hook that calls `getTestRunStatusFn` on an interval, stopping when the run reaches a terminal state.
**When to use:** After submitting a test run, showing real-time progress.
**Example:**
```typescript
// Custom hook for polling workflow status
import { useState, useEffect, useRef, useCallback } from "react";
import { getTestRunStatusFn } from "@/server/run-test";

export function useTestRunPolling(testRunId: string | null, intervalMs = 2000) {
  const [status, setStatus] = useState<TestRunStatus | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!testRunId) return;

    const poll = async () => {
      const result = await getTestRunStatusFn({ data: { testRunId } });
      if (result.found && result.status) {
        setStatus(result.status);
        if (result.status.phase === "complete" || result.status.phase === "failed") {
          stopPolling();
        }
      }
    };

    poll(); // immediate first call
    intervalRef.current = setInterval(poll, intervalMs);

    return stopPolling;
  }, [testRunId, intervalMs, stopPolling]);

  return { status, stopPolling };
}
```

### Pattern 5: Multi-Viewport Tab Navigation
**What:** Results viewer uses Tabs component to switch between viewport results (desktop, tablet, mobile) with synchronized step lists.
**When to use:** Test run detail page showing per-viewport results.
**Example:**
```typescript
// Source: shadcn/ui Tabs + existing viewport data
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function ViewportResults({ results }: { results: TestRunResult[] }) {
  return (
    <Tabs defaultValue={results[0]?.viewport}>
      <TabsList>
        {results.map((r) => (
          <TabsTrigger key={r.viewport} value={r.viewport}>
            {r.viewport}
          </TabsTrigger>
        ))}
      </TabsList>
      {results.map((r) => (
        <TabsContent key={r.viewport} value={r.viewport}>
          <StepReplayViewer steps={r.steps} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
```

### Anti-Patterns to Avoid
- **Fetching screenshots in list queries:** The test history list must NOT load `screenshotBase64` data -- only load screenshots when viewing a specific run's steps. Base64 screenshots are large (~100KB-500KB each) and would destroy list performance.
- **Polling without cleanup:** Always clear intervals on unmount and when reaching terminal states. Forgetting cleanup leads to memory leaks and zombie requests.
- **Importing server-only deps at top level:** Continue the existing pattern of dynamic `import()` for `@validater/db`, `@validater/worker`, `drizzle-orm` inside server function handlers -- never static imports that would leak into the client bundle.
- **Using `db.query.*` relational API in Phase 5:** The existing codebase uses `db.select().from().where()` builder API exclusively. The relational query API (`db.query.testRuns.findMany`) uses a different `where` clause pattern (callback-style). Stick with the builder API for consistency.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Table with sort/filter/paginate | Custom table state management | @tanstack/react-table + shadcn Table | Pagination math, sort direction, filter state, column visibility all handled |
| URL search param parsing | Manual URLSearchParams parsing | @tanstack/zod-adapter validateSearch | Type-safe, validated, with fallbacks; syncs URL and state automatically |
| Loading skeleton layouts | Manual opacity/animation states | shadcn Skeleton component | Consistent with design system, accessible |
| Progress indication | Custom progress bar div | shadcn Progress component | Accessible, themed, animated |
| Viewport tab switching | Custom toggle/radio buttons | shadcn Tabs component | Keyboard-accessible, styled, proper ARIA |
| Image zoom/lightbox | Custom modal with img scaling | shadcn Dialog + CSS object-fit | Accessible modal with proper focus trap |
| Date formatting | Manual date string manipulation | Intl.DateTimeFormat or date-fns | Handles locales, timezones, edge cases |

**Key insight:** shadcn/ui components are copy-pasted into the project (not imported from node_modules), so they are fully customizable. Use the CLI to add components, then modify as needed. Don't build custom primitives.

## Common Pitfalls

### Pitfall 1: Base64 Screenshot Performance in Lists
**What goes wrong:** Loading all test run data including step screenshots in the history list query causes massive payloads (each screenshot is 100-500KB base64), making the page crawl.
**Why it happens:** The `test_run_steps` table stores `screenshotBase64` as a text column. A naive join would include all screenshot data.
**How to avoid:** Two-tier query strategy: (1) History list queries select only from `test_runs` (no joins to steps), (2) Detail view queries steps with screenshots only for the selected viewport tab.
**Warning signs:** History page loads > 2 seconds, browser memory spikes on navigation.

### Pitfall 2: Stale Polling After Navigation
**What goes wrong:** User submits a test, navigates away, interval continues polling in the background, causing errors or stale state.
**Why it happens:** `useEffect` cleanup not triggered if component re-renders but stays mounted within the same layout route.
**How to avoid:** Use `testRunId` as the effect dependency. When user starts a new test, the old polling stops because the dependency changes. Always return cleanup function from `useEffect`.
**Warning signs:** Multiple concurrent polls for different test runs, console errors from unmounted component state updates.

### Pitfall 3: TanStack Start Import Protection
**What goes wrong:** Build fails or client bundle includes server-only code.
**Why it happens:** TanStack Start blocks `*.server.*` files from client code (documented in Phase 1 gotchas). Server functions must use `createServerFn` but file names must NOT end in `.server.ts`.
**How to avoid:** Name server function files descriptively (e.g., `server/test-runs.ts`, `server/run-test.ts`) without `.server` in the name. Use dynamic `import()` for server-only packages inside handlers.
**Warning signs:** Build errors mentioning "server" imports, client bundle size unexpectedly large.

### Pitfall 4: Auth Context Not Wired to Server Functions
**What goes wrong:** Test runs are created with `userId: "anonymous"` (see existing `run-test.ts` TODO comment).
**Why it happens:** Phase 4 deferred auth context wiring to Phase 5.
**How to avoid:** Use `getRequestHeaders()` from `@tanstack/react-start/server` + `auth.api.getSession({ headers })` inside server function handlers to get the authenticated user. Update `runTest` to use `session.user.id` instead of `"anonymous"`.
**Warning signs:** All test runs show same user, no ownership filtering works.

### Pitfall 5: TanStack Router Route File Naming
**What goes wrong:** Routes don't appear or have wrong nesting.
**Why it happens:** TanStack Router file-based routing uses specific conventions: `$param` for dynamic segments, `_layout` prefix for pathless layouts, `index.tsx` for index routes in directories.
**How to avoid:** Follow exact conventions: `routes/_authed/runs/index.tsx` for `/runs`, `routes/_authed/runs/$runId.tsx` for `/runs/:runId`. Run `pnpm dev` and check `routeTree.gen.ts` after adding routes.
**Warning signs:** Routes not showing in devtools, 404 on navigation, wrong component rendering.

### Pitfall 6: Zod Validation in validateSearch with Missing Params
**What goes wrong:** Page crashes or shows error when user navigates without all search params.
**Why it happens:** Strict Zod validation rejects URLs without optional params.
**How to avoid:** Use `fallback()` from `@tanstack/zod-adapter` for all params that have sensible defaults. Make filtering params `.optional()`.
**Warning signs:** Error component renders on first navigation to history page, console shows Zod validation errors.

## Code Examples

Verified patterns from official sources and existing codebase:

### Server Function: Get Test Run List with Pagination
```typescript
// packages/web/src/server/test-runs.ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ListTestRunsSchema = z.object({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().default(20),
  status: z.enum(["pending","complete","failed","all"]).optional(),
  search: z.string().optional(),
});

export const getTestRunList = createServerFn({ method: "GET" })
  .inputValidator(ListTestRunsSchema)
  .handler(async ({ data }) => {
    const { db, testRuns } = await import("@validater/db");
    const { eq, desc, like, and, sql, count } = await import("drizzle-orm");
    const { getRequestHeaders } = await import("@tanstack/react-start/server");
    const { auth } = await import("@/lib/auth");

    // Get authenticated user
    const headers = getRequestHeaders();
    const session = await auth.api.getSession({ headers });
    if (!session) throw new Error("Unauthorized");

    // Build where conditions
    const conditions = [eq(testRuns.userId, session.user.id)];
    if (data.status && data.status !== "all") {
      conditions.push(eq(testRuns.status, data.status));
    }
    if (data.search) {
      conditions.push(like(testRuns.url, `%${data.search}%`));
    }

    const whereClause = and(...conditions);

    // Get total count
    const [{ total }] = await db
      .select({ total: count() })
      .from(testRuns)
      .where(whereClause);

    // Get paginated results (NO screenshot data -- only test_runs table)
    const runs = await db
      .select()
      .from(testRuns)
      .where(whereClause)
      .orderBy(desc(testRuns.createdAt))
      .limit(data.pageSize)
      .offset((data.page - 1) * data.pageSize);

    return {
      runs,
      total,
      page: data.page,
      pageSize: data.pageSize,
      totalPages: Math.ceil(total / data.pageSize),
    };
  });
```

### Server Function: Get Test Run Detail with Steps
```typescript
// packages/web/src/server/test-runs.ts (continued)
export const getTestRunDetail = createServerFn({ method: "GET" })
  .inputValidator(z.object({ testRunId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { db, testRuns, testRunResults, testRunSteps } = await import("@validater/db");
    const { eq } = await import("drizzle-orm");

    const [run] = await db.select().from(testRuns)
      .where(eq(testRuns.id, data.testRunId))
      .limit(1);

    if (!run) return null;

    const results = await db.select().from(testRunResults)
      .where(eq(testRunResults.testRunId, data.testRunId));

    // Load steps per result (includes screenshotBase64)
    const resultsWithSteps = await Promise.all(
      results.map(async (result) => {
        const steps = await db.select().from(testRunSteps)
          .where(eq(testRunSteps.resultId, result.id))
          .orderBy(testRunSteps.stepOrder);
        return { ...result, steps };
      })
    );

    return { run, results: resultsWithSteps };
  });
```

### Route with Loader and Type-Safe Params
```typescript
// packages/web/src/routes/_authed/runs/$runId.tsx
import { createFileRoute } from "@tanstack/react-router";
import { getTestRunDetail } from "@/server/test-runs";

export const Route = createFileRoute("/_authed/runs/$runId")({
  loader: async ({ params }) => {
    const detail = await getTestRunDetail({ data: { testRunId: params.runId } });
    if (!detail) throw new Error("Test run not found");
    return detail;
  },
  component: TestRunDetailPage,
});

function TestRunDetailPage() {
  const { run, results } = Route.useLoaderData();
  // Fully typed: run is test_runs row, results is array with steps
}
```

### Route with Search Params for History
```typescript
// packages/web/src/routes/_authed/runs/index.tsx
import { createFileRoute } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { getTestRunList } from "@/server/test-runs";

const historySearchSchema = z.object({
  page: fallback(z.number().int().positive(), 1),
  pageSize: fallback(z.number().int().positive(), 20),
  status: z.enum(["pending", "complete", "failed", "all"]).optional(),
  search: z.string().optional(),
});

export const Route = createFileRoute("/_authed/runs/")({
  validateSearch: zodValidator(historySearchSchema),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    return getTestRunList({ data: deps });
  },
  component: TestHistoryPage,
});
```

### Updated _authed Layout with Navigation
```typescript
// packages/web/src/routes/_authed.tsx (expanded)
import { createFileRoute, redirect, Outlet, Link } from "@tanstack/react-router";
import { getSession } from "@/server/auth";

export const Route = createFileRoute("/_authed")({
  beforeLoad: async () => {
    const session = await getSession();
    if (!session) {
      throw redirect({ to: "/login" });
    }
    return { user: session.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const { user } = Route.useRouteContext();
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link to="/dashboard" className="text-lg font-semibold">Validater</Link>
            <Link to="/dashboard" activeProps={{ className: "text-primary" }}>New Test</Link>
            <Link to="/runs" activeProps={{ className: "text-primary" }}>History</Link>
          </div>
          <span className="text-sm text-muted-foreground">{user.email}</span>
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
```

### Displaying Base64 Screenshots
```typescript
// Render a base64 PNG screenshot
function StepScreenshot({ base64, alt }: { base64: string; alt: string }) {
  return (
    <img
      src={`data:image/png;base64,${base64}`}
      alt={alt}
      className="w-full rounded-md border border-border"
      loading="lazy"
    />
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| getServerSideProps (Next.js-style) | createServerFn + route loader | TanStack Start 1.x (2024) | Server functions are RPC-style, not page-level |
| React Query for all data | Route loaders for initial, Query for mutations/polling | TanStack Router 1.x (2024) | Loaders handle SSR data, Query handles dynamic updates |
| useEffect for data fetching | Route loader pre-fetching | TanStack Router 1.x | Data available before render, no loading spinners on navigation |
| Manual URL parsing for filters | validateSearch with Zod adapter | TanStack Router 1.x | Type-safe, validated search params with IDE autocomplete |
| Headless UI / Radix directly | shadcn/ui (Base UI or Radix) | shadcn 2025 | Copy-paste components with full ownership |

**Deprecated/outdated:**
- `zodSearchValidator` (old name): Replaced by `zodValidator` from `@tanstack/zod-adapter`
- `useLoaderData()` global hook: Use `Route.useLoaderData()` (route-scoped) for type safety

## Open Questions

Things that couldn't be fully resolved:

1. **Screenshot Storage Strategy Long-Term**
   - What we know: Screenshots are stored as base64 text in PostgreSQL `test_run_steps.screenshotBase64`. This works but is not ideal for performance with many screenshots.
   - What's unclear: Whether base64 decoding in the browser for dozens of screenshots will cause UI jank.
   - Recommendation: For Phase 5, use base64 as-is with `loading="lazy"` on img tags. Limit the detail view to show one viewport's steps at a time (tab-switched, not all at once). If performance is poor, add a lazy-loading pattern that loads screenshots only when the step is scrolled into view. File storage migration is a Phase 7+ concern.

2. **loaderDeps vs Direct Search Access**
   - What we know: TanStack Router provides `loaderDeps` to declare which search params the loader depends on, enabling smart re-fetching.
   - What's unclear: Whether `loaderDeps` correctly triggers re-fetching when search params change in TanStack Start with SSR.
   - Recommendation: Use `loaderDeps` as shown in the code examples. If issues arise, fall back to calling the server function directly in the component with `useEffect`.

3. **Drizzle count() Import Path**
   - What we know: Drizzle ORM provides `count()` for aggregate queries, but the import path may vary between versions.
   - What's unclear: Exact import -- could be `import { count } from "drizzle-orm"` or from a subpath.
   - Recommendation: Try `import { count } from "drizzle-orm"` first. If not available, use `sql<number>\`count(*)\`` as a raw SQL fallback.

## Sources

### Primary (HIGH confidence)
- Existing codebase analysis -- `packages/web/src/server/run-test.ts`, `packages/web/src/routes/_authed.tsx`, `packages/db/src/schema/test-runs.ts` (verified patterns)
- [TanStack Router Routing Concepts](https://tanstack.com/router/latest/docs/routing/routing-concepts) - file-based routing, pathless layouts
- [TanStack Router Data Loading](https://tanstack.com/router/latest/docs/guide/data-loading) - loaders, beforeLoad, useLoaderData
- [TanStack Router Search Params Validation](https://tanstack.com/router/latest/docs/how-to/validate-search-params) - zodValidator, fallback
- [@tanstack/zod-adapter on npm](https://www.npmjs.com/package/@tanstack/zod-adapter) - version 1.144.0
- [shadcn/ui Data Table](https://ui.shadcn.com/docs/components/radix/data-table) - TanStack Table integration
- [Drizzle ORM Limit/Offset Pagination](https://orm.drizzle.team/docs/guides/limit-offset-pagination) - pagination patterns

### Secondary (MEDIUM confidence)
- [TanStack Router beforeLoad vs loader](https://benhouston3d.com/blog/tanstack-router-beforeLoad-loader) - execution order, context flow patterns
- [TanStack Start Server Functions](https://tanstack.com/start/latest/docs/framework/react/guide/server-functions) - createServerFn RPC pattern

### Tertiary (LOW confidence)
- Base64 image performance implications -- community sources suggest performance issues with many large base64 images, but exact thresholds vary by browser and hardware

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All core libraries already installed and verified in codebase; only @tanstack/react-table and @tanstack/zod-adapter are new additions (both from TanStack ecosystem)
- Architecture: HIGH - Route structure, server function patterns, and data flow follow established codebase conventions confirmed against official docs
- Pitfalls: HIGH - Most pitfalls derived from direct codebase analysis (base64 storage, TODO comments, import patterns) and documented Phase 1 gotchas
- Code examples: MEDIUM - Based on official docs patterns adapted to this specific codebase; some patterns (loaderDeps, count() import) need validation during implementation

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (30 days -- stable ecosystem, no rapid changes expected)
