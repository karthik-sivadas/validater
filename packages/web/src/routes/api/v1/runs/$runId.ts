import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/v1/runs/$runId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        // Dynamic imports to avoid bundling server-only deps in client
        const { verifyApiKey } = await import("@/lib/api-auth");

        // Authenticate via API key
        const keyResult = await verifyApiKey(request);
        if (!keyResult.valid) {
          return Response.json(
            { error: keyResult.error },
            { status: 401 },
          );
        }

        try {
          const { db, testRuns, testRunResults, testRunSteps } = await import(
            "@validater/db"
          );
          const { eq, asc } = await import("drizzle-orm");

          const runId = (params as { runId: string }).runId;

          // Query test run by id
          const runRows = await db
            .select()
            .from(testRuns)
            .where(eq(testRuns.id, runId))
            .limit(1);
          const run = runRows[0];

          if (!run) {
            return Response.json(
              { error: "Not found" },
              { status: 404 },
            );
          }

          // Ownership check: API key owner must own the test run
          if (run.userId !== keyResult.userId) {
            return Response.json(
              { error: "Not found" },
              { status: 404 },
            );
          }

          // Try Temporal query for live status first
          let liveStatus: {
            phase: string;
            viewportsComplete: number;
            viewportsTotal: number;
            error?: string;
          } | null = null;

          try {
            const { createTemporalClient, getTestRunStatus } = await import(
              "@validater/worker"
            );
            const client = await createTemporalClient();
            const handle = client.workflow.getHandle(runId);
            liveStatus = await handle.query(getTestRunStatus);
          } catch {
            // Workflow may have completed or not exist -- fall back to DB
          }

          const status = liveStatus?.phase ?? run.status;
          const viewportsTotal = (run.viewports as string[]).length;
          const viewportsComplete =
            liveStatus?.viewportsComplete ??
            (run.status === "complete" ? viewportsTotal : 0);

          // Base response fields
          const baseResponse = {
            testRunId: run.id,
            url: run.url,
            testDescription: run.testDescription,
            status,
            phase: status,
            viewportsComplete,
            viewportsTotal,
            createdAt: run.createdAt.toISOString(),
            completedAt: run.completedAt
              ? run.completedAt.toISOString()
              : null,
          };

          // If not complete, return status only (no results)
          if (status !== "complete") {
            return Response.json(baseResponse);
          }

          // For complete runs, include full results with inline screenshots
          const results = await db
            .select()
            .from(testRunResults)
            .where(eq(testRunResults.testRunId, runId));

          const resultsWithSteps = await Promise.all(
            results.map(async (result) => {
              const steps = await db
                .select()
                .from(testRunSteps)
                .where(eq(testRunSteps.resultId, result.id))
                .orderBy(asc(testRunSteps.stepOrder));

              return {
                viewport: result.viewport,
                totalDurationMs: result.totalDurationMs,
                steps: steps.map((s) => ({
                  stepOrder: s.stepOrder,
                  action: s.action,
                  description: s.description,
                  status: s.status,
                  durationMs: s.durationMs,
                  errorMessage: s.errorMessage,
                  screenshotBase64: s.screenshotBase64 || null,
                })),
              };
            }),
          );

          return Response.json({
            ...baseResponse,
            results: resultsWithSteps,
          });
        } catch (err) {
          console.error("[GET /api/v1/runs/:id] Error:", err);
          return Response.json(
            { error: "Internal server error" },
            { status: 500 },
          );
        }
      },
    },
  },
});
