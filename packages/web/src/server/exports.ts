import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const ExportInputSchema = z.object({
  testRunId: z.string().min(1),
});

const VideoFileInputSchema = z.object({
  testRunId: z.string().min(1),
  viewport: z.string().min(1),
});

const TriggerExportInputSchema = z.object({
  testRunId: z.string().min(1),
  viewport: z.string().min(1),
  resolution: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }),
  includeAnnotations: z.boolean(),
  trimDeadTime: z.boolean(),
});

const ExportStatusInputSchema = z.object({
  exportId: z.string().min(1),
});

const DownloadExportInputSchema = z.object({
  outputPath: z.string().min(1),
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

// ---------------------------------------------------------------------------
// getVideoFile -- serve debug video recording as base64
// ---------------------------------------------------------------------------

export const getVideoFile = createServerFn({ method: "GET" })
  .inputValidator(VideoFileInputSchema)
  .handler(async ({ data }) => {
    const { getRequestHeaders } = await import("@tanstack/react-start/server");
    const { auth } = await import("@/lib/auth");
    const { db, testRuns, testRunResults } = await import("@validater/db");
    const { eq, and } = await import("drizzle-orm");
    const { readFile } = await import("fs/promises");

    const headers = getRequestHeaders();
    const session = await auth.api.getSession({ headers });
    if (!session) throw new Error("Unauthorized");

    // Verify test run ownership
    const runRows = await db
      .select()
      .from(testRuns)
      .where(eq(testRuns.id, data.testRunId))
      .limit(1);
    const run = runRows[0];
    if (!run) throw new Error("Not found");
    if (run.userId !== session.user.id) throw new Error("Not found");

    // Fetch result for the viewport
    const resultRows = await db
      .select()
      .from(testRunResults)
      .where(
        and(
          eq(testRunResults.testRunId, data.testRunId),
          eq(testRunResults.viewport, data.viewport),
        ),
      )
      .limit(1);
    const result = resultRows[0];
    if (!result?.videoPath) {
      return { found: false as const };
    }

    // Resolve absolute path and read file
    const { getVideoPath } = await import("@validater/worker");
    const absPath = getVideoPath(result.videoPath);
    const fileBuffer = await readFile(absPath);
    const videoBase64 = fileBuffer.toString("base64");

    return {
      found: true as const,
      videoBase64,
      mimeType: "video/webm" as const,
    };
  });

// ---------------------------------------------------------------------------
// triggerVideoExport -- start polished video export via Temporal
// ---------------------------------------------------------------------------

export const triggerVideoExport = createServerFn({ method: "POST" })
  .inputValidator(TriggerExportInputSchema)
  .handler(async ({ data }) => {
    const { getRequestHeaders } = await import("@tanstack/react-start/server");
    const { auth } = await import("@/lib/auth");
    const { db, testRuns, testRunResults, testRunSteps } = await import(
      "@validater/db"
    );
    const { eq, and, asc } = await import("drizzle-orm");
    const { nanoid } = await import("nanoid");

    const headers = getRequestHeaders();
    const session = await auth.api.getSession({ headers });
    if (!session) throw new Error("Unauthorized");

    // Verify test run ownership
    const runRows = await db
      .select()
      .from(testRuns)
      .where(eq(testRuns.id, data.testRunId))
      .limit(1);
    const run = runRows[0];
    if (!run) throw new Error("Not found");
    if (run.userId !== session.user.id) throw new Error("Not found");

    // Fetch result for the viewport
    const resultRows = await db
      .select()
      .from(testRunResults)
      .where(
        and(
          eq(testRunResults.testRunId, data.testRunId),
          eq(testRunResults.viewport, data.viewport),
        ),
      )
      .limit(1);
    const result = resultRows[0];
    if (!result?.videoPath) {
      throw new Error("No debug video available for this viewport");
    }

    // Fetch step data for annotations and timing
    const steps = await db
      .select()
      .from(testRunSteps)
      .where(eq(testRunSteps.resultId, result.id))
      .orderBy(asc(testRunSteps.stepOrder));

    const stepData = steps.map((s) => ({
      stepOrder: s.stepOrder,
      action: s.action ?? "unknown",
      description: s.description ?? "",
      durationMs: s.durationMs,
    }));

    // Start export workflow
    const exportId = nanoid();
    const {
      createTemporalClient,
      exportVideoWorkflow,
    } = await import("@validater/worker");

    const client = await createTemporalClient();
    await client.workflow.start(exportVideoWorkflow, {
      args: [
        {
          testRunId: data.testRunId,
          viewport: data.viewport,
          videoPath: result.videoPath,
          resolution: data.resolution,
          includeAnnotations: data.includeAnnotations,
          trimDeadTime: data.trimDeadTime,
          steps: stepData,
        },
      ],
      taskQueue: "test-pipeline",
      workflowId: `export-${exportId}`,
    });

    return { exportId };
  });

// ---------------------------------------------------------------------------
// getExportStatus -- poll Temporal workflow status
// ---------------------------------------------------------------------------

export const getExportStatus = createServerFn({ method: "GET" })
  .inputValidator(ExportStatusInputSchema)
  .handler(async ({ data }) => {
    const { createTemporalClient } = await import("@validater/worker");

    const client = await createTemporalClient();
    const handle = client.workflow.getHandle(`export-${data.exportId}`);

    try {
      const description = await handle.describe();
      const status = description.status.name;

      if (status === "COMPLETED") {
        const result = await handle.result();
        return {
          status: "complete" as const,
          outputPath: (result as { outputPath: string }).outputPath,
        };
      }

      if (status === "FAILED" || status === "TERMINATED" || status === "CANCELLED") {
        return { status: "failed" as const };
      }

      return { status: "processing" as const };
    } catch {
      return { status: "failed" as const };
    }
  });

// ---------------------------------------------------------------------------
// downloadExportedVideo -- serve processed MP4 as base64
// ---------------------------------------------------------------------------

export const downloadExportedVideo = createServerFn({ method: "GET" })
  .inputValidator(DownloadExportInputSchema)
  .handler(async ({ data }) => {
    const { getRequestHeaders } = await import("@tanstack/react-start/server");
    const { auth } = await import("@/lib/auth");
    const { readFile } = await import("fs/promises");

    const headers = getRequestHeaders();
    const session = await auth.api.getSession({ headers });
    if (!session) throw new Error("Unauthorized");

    // Security: prevent path traversal
    if (data.outputPath.includes("..")) {
      throw new Error("Invalid path");
    }

    const { getVideoPath } = await import("@validater/worker");
    const absPath = getVideoPath(data.outputPath);
    const fileBuffer = await readFile(absPath);
    const videoBase64 = fileBuffer.toString("base64");

    return {
      videoBase64,
      mimeType: "video/mp4" as const,
      filename: data.outputPath.split("/").pop() ?? "export.mp4",
    };
  });
