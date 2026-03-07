import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// ---------------------------------------------------------------------------
// generateSuite -- creates suite record and starts workflow
// ---------------------------------------------------------------------------

const GenerateSuiteInputSchema = z.object({
  url: z.string().url(),
  featureDescription: z.string().min(1).max(5000),
});

/**
 * Create a test_suites DB record and start the testSuiteWorkflow via Temporal.
 *
 * Returns immediately with suiteId so the frontend can poll for progress.
 * Auth is session-based (uses getRequestHeaders + auth.api.getSession).
 */
export const generateSuite = createServerFn({ method: "POST" })
  .inputValidator(GenerateSuiteInputSchema)
  .handler(async ({ data }) => {
    const { getRequestHeaders } = await import("@tanstack/react-start/server");
    const { auth } = await import("@/lib/auth");
    const headers = getRequestHeaders();
    const session = await auth.api.getSession({ headers });
    if (!session) throw new Error("Unauthorized");

    const { nanoid } = await import("nanoid");
    const { createTemporalClient, testSuiteWorkflow } = await import(
      "@validater/worker"
    );
    const { db, testSuites } = await import("@validater/db");

    const suiteId = nanoid();

    // Insert initial suite record
    await db.insert(testSuites).values({
      id: suiteId,
      userId: session.user.id,
      url: data.url,
      featureDescription: data.featureDescription,
      status: "pending",
    });

    // Start workflow non-blocking
    const client = await createTemporalClient();
    await client.workflow.start(testSuiteWorkflow, {
      args: [
        {
          suiteId,
          url: data.url,
          featureDescription: data.featureDescription,
        },
      ],
      taskQueue: "test-pipeline",
      workflowId: suiteId,
    });

    return { suiteId };
  });

// ---------------------------------------------------------------------------
// getSuiteList -- paginated, user-scoped suite list
// ---------------------------------------------------------------------------

const GetSuiteListInputSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(10),
});

/**
 * Fetch paginated test suites for the authenticated user.
 * Ordered by createdAt desc.
 */
export const getSuiteList = createServerFn({ method: "GET" })
  .inputValidator(GetSuiteListInputSchema)
  .handler(async ({ data }) => {
    const { getRequestHeaders } = await import("@tanstack/react-start/server");
    const { auth } = await import("@/lib/auth");
    const { db, testSuites } = await import("@validater/db");
    const { eq, desc, sql } = await import("drizzle-orm");

    const headers = getRequestHeaders();
    const session = await auth.api.getSession({ headers });
    if (!session) throw new Error("Unauthorized");

    // Get total count
    const countResult = await db
      .select({ total: sql<number>`count(*)` })
      .from(testSuites)
      .where(eq(testSuites.userId, session.user.id));
    const total = Number(countResult[0].total);

    // Get paginated suites
    const suites = await db
      .select()
      .from(testSuites)
      .where(eq(testSuites.userId, session.user.id))
      .orderBy(desc(testSuites.createdAt))
      .limit(data.pageSize)
      .offset((data.page - 1) * data.pageSize);

    return {
      suites,
      total,
      page: data.page,
      pageSize: data.pageSize,
      totalPages: Math.ceil(total / data.pageSize),
    };
  });

// ---------------------------------------------------------------------------
// getSuiteDetail -- single suite with all test cases
// ---------------------------------------------------------------------------

const GetSuiteDetailInputSchema = z.object({
  suiteId: z.string().min(1),
});

/**
 * Fetch a single suite with all its test cases.
 * Returns null if not found or not owned by the authenticated user.
 */
export const getSuiteDetail = createServerFn({ method: "GET" })
  .inputValidator(GetSuiteDetailInputSchema)
  .handler(async ({ data }) => {
    const { getRequestHeaders } = await import("@tanstack/react-start/server");
    const { auth } = await import("@/lib/auth");
    const { db, testSuites, testCases } = await import("@validater/db");
    const { eq, asc } = await import("drizzle-orm");

    const headers = getRequestHeaders();
    const session = await auth.api.getSession({ headers });
    if (!session) throw new Error("Unauthorized");

    // Query suite
    const suiteRows = await db
      .select()
      .from(testSuites)
      .where(eq(testSuites.id, data.suiteId))
      .limit(1);
    const suite = suiteRows[0];

    if (!suite) return null;

    // Ownership check
    if (suite.userId !== session.user.id) return null;

    // Query test cases ordered by `order`
    const rawCases = await db
      .select()
      .from(testCases)
      .where(eq(testCases.suiteId, data.suiteId))
      .orderBy(asc(testCases.order));

    // Cast jsonb fields (steps returns unknown from drizzle jsonb, creates
    // incompatible Promise types with dynamic imports -- same pattern as 05-01)
    const cases = rawCases.map((c) => ({
      ...c,
      steps: c.steps as object[] | null,
    }));

    return { suite, testCases: cases };
  });

// ---------------------------------------------------------------------------
// getSuiteStatusFn -- query workflow status for progress polling
// ---------------------------------------------------------------------------

const GetSuiteStatusInputSchema = z.object({
  suiteId: z.string().min(1),
});

/**
 * Query real-time suite workflow status by suiteId.
 *
 * First attempts a Temporal query (live in-memory status), then
 * falls back to database status if workflow completed or not found.
 */
export const getSuiteStatusFn = createServerFn({ method: "GET" })
  .inputValidator(GetSuiteStatusInputSchema)
  .handler(async ({ data }) => {
    const { createTemporalClient, getSuiteStatus } = await import(
      "@validater/worker"
    );

    const client = await createTemporalClient();
    const handle = client.workflow.getHandle(data.suiteId);

    try {
      const status = await handle.query(getSuiteStatus);
      return { status, found: true };
    } catch {
      // Workflow may have completed or not exist -- fall back to DB
      const { db, testSuites } = await import("@validater/db");
      const { eq } = await import("drizzle-orm");

      const rows = await db
        .select()
        .from(testSuites)
        .where(eq(testSuites.id, data.suiteId))
        .limit(1);
      const suite = rows[0];

      if (!suite) {
        return { status: null, found: false };
      }

      return {
        status: {
          phase: suite.status,
          testCasesTotal: suite.testCaseCount,
          testCasesGenerated: suite.testCaseCount,
          error: undefined,
        },
        found: true,
      };
    }
  });

// ---------------------------------------------------------------------------
// runTestCase -- run a single test case from a suite
// ---------------------------------------------------------------------------

const RunTestCaseInputSchema = z.object({
  testCaseId: z.string().min(1),
  viewports: z
    .array(z.string())
    .min(1)
    .max(10)
    .default(["desktop", "tablet", "mobile"]),
});

/**
 * Run a single test case from a suite using the existing triggerTestRun
 * infrastructure. Updates the test_cases.testRunId with the new run ID.
 */
export const runTestCase = createServerFn({ method: "POST" })
  .inputValidator(RunTestCaseInputSchema)
  .handler(async ({ data }) => {
    const { getRequestHeaders } = await import("@tanstack/react-start/server");
    const { auth } = await import("@/lib/auth");
    const { db, testCases, testSuites } = await import("@validater/db");
    const { eq } = await import("drizzle-orm");

    const headers = getRequestHeaders();
    const session = await auth.api.getSession({ headers });
    if (!session) throw new Error("Unauthorized");

    // Query the test case
    const caseRows = await db
      .select()
      .from(testCases)
      .where(eq(testCases.id, data.testCaseId))
      .limit(1);
    const testCase = caseRows[0];

    if (!testCase) throw new Error("Test case not found");

    // Query the parent suite for ownership and URL
    const suiteRows = await db
      .select()
      .from(testSuites)
      .where(eq(testSuites.id, testCase.suiteId))
      .limit(1);
    const suite = suiteRows[0];

    if (!suite) throw new Error("Suite not found");
    if (suite.userId !== session.user.id) throw new Error("Unauthorized");

    // Use shared triggerTestRun
    const { triggerTestRun } = await import("@/server/run-test-core");
    const result = await triggerTestRun({
      userId: session.user.id,
      url: suite.url,
      testDescription: testCase.description,
      viewports: data.viewports,
    });

    // Update the test case with the new testRunId
    await db
      .update(testCases)
      .set({ testRunId: result.testRunId })
      .where(eq(testCases.id, data.testCaseId));

    return { testRunId: result.testRunId };
  });
