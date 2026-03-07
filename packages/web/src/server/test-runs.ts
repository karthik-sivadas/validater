import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// ---------------------------------------------------------------------------
// getTestRunList -- paginated, user-scoped test runs
// ---------------------------------------------------------------------------

const GetTestRunListInputSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(10),
  status: z.string().optional(),
  search: z.string().optional(),
});

/**
 * Fetch paginated test runs for the authenticated user.
 *
 * Supports optional status filter (skip if "all" or undefined) and
 * search filter (ILIKE on url). Returns paginated result with total count.
 */
export const getTestRunList = createServerFn({ method: "GET" })
  .inputValidator(GetTestRunListInputSchema)
  .handler(async ({ data }) => {
    const { getRequestHeaders } = await import(
      "@tanstack/react-start/server"
    );
    const { auth } = await import("@/lib/auth");
    const { db, testRuns } = await import("@validater/db");
    const { eq, desc, sql, and, like } = await import("drizzle-orm");

    const headers = getRequestHeaders();
    const session = await auth.api.getSession({ headers });
    if (!session) throw new Error("Unauthorized");

    // Build where conditions
    const conditions = [eq(testRuns.userId, session.user.id)];

    if (data.status && data.status !== "all") {
      conditions.push(eq(testRuns.status, data.status as any));
    }

    if (data.search) {
      conditions.push(like(testRuns.url, `%${data.search}%`));
    }

    const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

    // Get total count
    const countResult = await db
      .select({ total: sql<number>`count(*)` })
      .from(testRuns)
      .where(whereClause);
    const total = Number(countResult[0].total);

    // Get paginated runs
    const rawRuns = await db
      .select()
      .from(testRuns)
      .where(whereClause)
      .orderBy(desc(testRuns.createdAt))
      .limit(data.pageSize)
      .offset((data.page - 1) * data.pageSize);

    // Serialize to plain objects with typed viewports (jsonb returns unknown)
    const runs = rawRuns.map((r) => ({
      ...r,
      viewports: r.viewports as string[],
    }));

    return {
      runs,
      total,
      page: data.page,
      pageSize: data.pageSize,
      totalPages: Math.ceil(total / data.pageSize),
    };
  });

// ---------------------------------------------------------------------------
// getTestRunDetail -- single test run with results and steps
// ---------------------------------------------------------------------------

const GetTestRunDetailInputSchema = z.object({
  testRunId: z.string().min(1),
});

/**
 * Fetch a single test run with its results and steps (including screenshots).
 *
 * Returns null if the test run is not found or does not belong to the
 * authenticated user. Each result includes its ordered steps array.
 */
export const getTestRunDetail = createServerFn({ method: "GET" })
  .inputValidator(GetTestRunDetailInputSchema)
  .handler(async ({ data }) => {
    const { getRequestHeaders } = await import(
      "@tanstack/react-start/server"
    );
    const { auth } = await import("@/lib/auth");
    const { db, testRuns, testRunResults, testRunSteps, accessibilityResults } =
      await import("@validater/db");
    const { eq, asc } = await import("drizzle-orm");

    const headers = getRequestHeaders();
    const session = await auth.api.getSession({ headers });
    if (!session) throw new Error("Unauthorized");

    // Query test run by id
    const runRows = await db
      .select()
      .from(testRuns)
      .where(eq(testRuns.id, data.testRunId))
      .limit(1);
    const run = runRows[0];

    if (!run) return null;

    // Auth ownership check: verify the run belongs to the authenticated user
    if (run.userId !== session.user.id) return null;

    // Serialize run with typed viewports (jsonb returns unknown)
    const typedRun = { ...run, viewports: run.viewports as string[] };

    // Query results for this test run
    const results = await db
      .select()
      .from(testRunResults)
      .where(eq(testRunResults.testRunId, data.testRunId));

    // For each result, query its steps and accessibility results
    const resultsWithSteps = await Promise.all(
      results.map(async (result) => {
        const steps = await db
          .select()
          .from(testRunSteps)
          .where(eq(testRunSteps.resultId, result.id))
          .orderBy(asc(testRunSteps.stepOrder));

        // Query accessibility results for this viewport result
        const a11yRows = await db
          .select()
          .from(accessibilityResults)
          .where(eq(accessibilityResults.resultId, result.id))
          .limit(1);

        // Cast jsonb violations to typed array (jsonb returns unknown)
        const a11y = a11yRows[0]
          ? {
              ...a11yRows[0],
              violations: a11yRows[0].violations as Array<{
                id: string;
                impact: string | null;
                description: string;
                help: string;
                helpUrl: string;
                tags: string[];
                nodes: Array<{
                  target: string[];
                  html: string;
                  impact: string | null;
                  failureSummary: string | undefined;
                }>;
                nodeCount: number;
              }>,
            }
          : null;

        return {
          ...result,
          steps,
          accessibility: a11y,
        };
      }),
    );

    return { run: typedRun, results: resultsWithSteps };
  });
