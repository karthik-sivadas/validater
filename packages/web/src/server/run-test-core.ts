/**
 * Core business logic for triggering test runs.
 *
 * Shared between the TanStack Start server function (session-based auth)
 * and the REST API route (API key auth). Neither authentication layer
 * lives here -- callers verify identity before invoking triggerTestRun.
 */

export interface TriggerTestRunParams {
  userId: string;
  url: string;
  testDescription: string;
  viewports: string[];
}

export interface TriggerTestRunResult {
  testRunId: string;
  workflowId: string;
}

/**
 * Creates a test_runs DB record and starts the Temporal testRunWorkflow.
 *
 * All server-only dependencies are dynamically imported to prevent
 * bundling into the client bundle (Temporal client, db, core, nanoid).
 *
 * @throws Error if no valid viewports are provided
 */
export async function triggerTestRun(
  params: TriggerTestRunParams,
): Promise<TriggerTestRunResult> {
  const { nanoid } = await import("nanoid");
  const { createTemporalClient, testRunWorkflow } = await import(
    "@validater/worker"
  );
  const { db, testRuns } = await import("@validater/db");
  const { VIEWPORT_PRESETS } = await import("@validater/core");

  const testRunId = nanoid();

  // Resolve viewport names to ViewportConfig objects
  const resolvedViewports = params.viewports
    .map((name) => VIEWPORT_PRESETS[name])
    .filter(Boolean);

  if (resolvedViewports.length === 0) {
    throw new Error(
      `No valid viewports found. Available: ${Object.keys(VIEWPORT_PRESETS).join(", ")}`,
    );
  }

  // Insert initial test_run record
  await db.insert(testRuns).values({
    id: testRunId,
    userId: params.userId,
    url: params.url,
    testDescription: params.testDescription,
    status: "pending",
    viewports: params.viewports,
  });

  // Start workflow non-blocking
  const client = await createTemporalClient();
  const handle = await client.workflow.start(testRunWorkflow, {
    args: [
      {
        testRunId,
        url: params.url,
        testDescription: params.testDescription,
        viewports: resolvedViewports,
      },
    ],
    taskQueue: "test-pipeline",
    workflowId: testRunId,
  });

  return {
    testRunId,
    workflowId: handle.workflowId,
  };
}
