import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const ExportInputSchema = z.object({
  testRunId: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Shared helper: fetch test run data and build ReportData
// ---------------------------------------------------------------------------

async function buildReportData(testRunId: string) {
  const { getRequestHeaders } = await import("@tanstack/react-start/server");
  const { auth } = await import("@/lib/auth");
  const { db, testRuns, testRunResults, testRunSteps } = await import(
    "@validater/db"
  );
  const { eq, asc } = await import("drizzle-orm");

  const headers = getRequestHeaders();
  const session = await auth.api.getSession({ headers });
  if (!session) throw new Error("Unauthorized");

  // Fetch test run
  const runRows = await db
    .select()
    .from(testRuns)
    .where(eq(testRuns.id, testRunId))
    .limit(1);
  const run = runRows[0];

  if (!run) throw new Error("Not found");
  if (run.userId !== session.user.id) throw new Error("Not found");

  // Fetch results with steps
  const results = await db
    .select()
    .from(testRunResults)
    .where(eq(testRunResults.testRunId, testRunId));

  const viewportResults = await Promise.all(
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
          errorExpected: s.errorExpected,
          errorActual: s.errorActual,
          screenshotBase64: s.screenshotBase64,
        })),
      };
    }),
  );

  return {
    testRunId: run.id,
    url: run.url,
    testDescription: run.testDescription,
    createdAt: run.createdAt.toISOString(),
    completedAt: run.completedAt ? run.completedAt.toISOString() : null,
    status: run.status,
    viewportResults,
  };
}

// ---------------------------------------------------------------------------
// exportHtmlReport
// ---------------------------------------------------------------------------

export const exportHtmlReport = createServerFn({ method: "GET" })
  .inputValidator(ExportInputSchema)
  .handler(async ({ data }) => {
    const reportData = await buildReportData(data.testRunId);
    const { generateHtmlReport } = await import("@validater/worker");
    const html = await generateHtmlReport(reportData);
    return {
      html,
      filename: `validater-report-${data.testRunId}.html`,
    };
  });

// ---------------------------------------------------------------------------
// exportPdfReport
// ---------------------------------------------------------------------------

export const exportPdfReport = createServerFn({ method: "GET" })
  .inputValidator(ExportInputSchema)
  .handler(async ({ data }) => {
    const reportData = await buildReportData(data.testRunId);
    const { generateHtmlReport } = await import("@validater/worker");
    const html = await generateHtmlReport(reportData);
    const { generatePdfReport } = await import("@validater/worker");
    const pdfBuffer = await generatePdfReport(html);
    const pdfBase64 = pdfBuffer.toString("base64");
    return {
      pdfBase64,
      filename: `validater-report-${data.testRunId}.pdf`,
    };
  });
