import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// ---------------------------------------------------------------------------
// runTest -- starts a workflow non-blocking
// ---------------------------------------------------------------------------

const RunTestInputSchema = z.object({
  url: z.string().url(),
  testDescription: z.string().min(1).max(2000),
  viewports: z
    .array(z.string())
    .min(1)
    .max(10)
    .default(["desktop", "tablet", "mobile"]),
});

/**
 * Start a full test run pipeline via Temporal workflow.
 *
 * Creates a test_runs DB record and starts the testRunWorkflow non-blocking.
 * Returns immediately with the testRunId so the frontend can poll for status.
 *
 * Auth is session-based (for frontend). Core logic is delegated to
 * triggerTestRun which is shared with the REST API route.
 */
export const runTest = createServerFn({ method: "POST" })
  .inputValidator(RunTestInputSchema)
  .handler(async ({ data }) => {
    // Auth: get authenticated user session
    const { getRequestHeaders } = await import("@tanstack/react-start/server");
    const { auth } = await import("@/lib/auth");
    const headers = getRequestHeaders();
    const session = await auth.api.getSession({ headers });
    if (!session) throw new Error("Unauthorized");

    // Delegate to shared core logic
    const { triggerTestRun } = await import("@/server/run-test-core");
    return triggerTestRun({
      userId: session.user.id,
      url: data.url,
      testDescription: data.testDescription,
      viewports: data.viewports,
    });
  });

// ---------------------------------------------------------------------------
// getTestRunStatusFn -- queries workflow status with DB fallback
// ---------------------------------------------------------------------------

const GetStatusInputSchema = z.object({
  testRunId: z.string().min(1),
});

/**
 * Query real-time workflow status by testRunId.
 *
 * First attempts a Temporal query (returns live in-memory status from the
 * running workflow). If the workflow has completed or doesn't exist, falls
 * back to the database record.
 *
 * Uses db.select().from().where() builder API (NOT the relational query API
 * which uses callback-style where clauses).
 */
export const getTestRunStatusFn = createServerFn({ method: "GET" })
  .inputValidator(GetStatusInputSchema)
  .handler(async ({ data }) => {
    const { createTemporalClient, getTestRunStatus } = await import(
      "@validater/worker"
    );

    const client = await createTemporalClient();
    const handle = client.workflow.getHandle(data.testRunId);

    try {
      const status = await handle.query(getTestRunStatus);
      return { status, found: true };
    } catch {
      // Workflow may have completed or not exist
      // Fall back to database status using db.select() with eq()
      const { db, testRuns } = await import("@validater/db");
      const { eq } = await import("drizzle-orm");

      const rows = await db
        .select()
        .from(testRuns)
        .where(eq(testRuns.id, data.testRunId))
        .limit(1);
      const run = rows[0];

      if (!run) {
        return { status: null, found: false };
      }

      return {
        status: {
          phase: run.status,
          viewportsComplete:
            run.status === "complete"
              ? (run.viewports as string[]).length
              : 0,
          viewportsTotal: (run.viewports as string[]).length,
          error: run.error ?? undefined,
        },
        found: true,
      };
    }
  });
