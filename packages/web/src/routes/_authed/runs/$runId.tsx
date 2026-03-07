import { useState, useEffect, useRef, useCallback } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { getTestRunDetail } from "@/server/test-runs";
import {
  exportHtmlReport,
  exportPdfReport,
  getVideoFile,
  triggerVideoExport,
  getExportStatus,
  downloadExportedVideo,
} from "@/server/exports";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

// ---------------------------------------------------------------------------
// Types for loader data (explicit to avoid implicit-any from dynamic imports)
// ---------------------------------------------------------------------------

interface TestRunStep {
  id: string;
  resultId: string;
  stepId: string;
  stepOrder: number;
  action: string | null;
  description: string | null;
  status: string;
  durationMs: number;
  errorMessage: string | null;
  errorExpected: string | null;
  errorActual: string | null;
  screenshotBase64: string | null;
}

interface TestRunResult {
  id: string;
  testRunId: string;
  viewport: string;
  url: string;
  totalDurationMs: number;
  videoPath: string | null;
  startedAt: Date;
  completedAt: Date;
  createdAt: Date;
  steps: TestRunStep[];
}

interface TestRun {
  id: string;
  userId: string;
  url: string;
  testDescription: string;
  status: string;
  viewports: string[];
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

interface TestRunDetailData {
  run: TestRun;
  results: TestRunResult[];
}

export const Route = createFileRoute("/_authed/runs/$runId")({
  loader: async ({ params }): Promise<TestRunDetailData> => {
    const detail = await getTestRunDetail({
      data: { testRunId: params.runId },
    });
    if (!detail) throw new Error("Test run not found");
    return detail as TestRunDetailData;
  },
  component: TestRunDetailPage,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDate(timestamp: string | Date): string {
  return dateFormatter.format(new Date(timestamp));
}

type StatusVariant = "default" | "destructive" | "secondary";

function statusVariant(status: string): StatusVariant {
  if (status === "complete") return "default";
  if (status === "failed") return "destructive";
  return "secondary";
}

function passRateColor(rate: number): string {
  if (rate >= 100) return "text-emerald-600 dark:text-emerald-400";
  if (rate > 50) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

interface ResolutionOption {
  label: string;
  width: number;
  height: number;
}

const RESOLUTION_OPTIONS: ResolutionOption[] = [
  { label: "720p", width: 1280, height: 720 },
  { label: "1080p", width: 1920, height: 1080 },
];

const ACTION_COLORS: Record<string, string> = {
  click: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  fill: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  assert: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  navigate: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  select: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  check: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
  hover: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  wait: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function TestRunDetailPage() {
  const loaderData = Route.useLoaderData() as TestRunDetailData;
  const { run, results } = loaderData;
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(
    null,
  );
  const [exporting, setExporting] = useState<null | "html" | "pdf">(null);

  // Compute summary stats per viewport and overall
  const viewportSummaries = results.map((result: TestRunResult) => {
    const totalSteps = result.steps.length;
    const passed = result.steps.filter((s) => s.status === "pass").length;
    const failed = totalSteps - passed;
    return {
      viewport: result.viewport,
      totalSteps,
      passed,
      failed,
      durationSec: (result.totalDurationMs / 1000).toFixed(1),
    };
  });

  const totalSteps = viewportSummaries.reduce((a, v) => a + v.totalSteps, 0);
  const totalPassed = viewportSummaries.reduce((a, v) => a + v.passed, 0);
  const totalFailed = viewportSummaries.reduce((a, v) => a + v.failed, 0);
  const passRate =
    totalSteps > 0 ? Math.round((totalPassed / totalSteps) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      {/* ---- Header ---- */}
      <div className="flex flex-col gap-2">
        <Link
          to="/runs"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; Back to History
        </Link>

        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Test Run</h1>
          <span className="text-sm text-muted-foreground">{run.id}</span>
          <Badge variant={statusVariant(run.status)}>{run.status}</Badge>
        </div>

        <a
          href={run.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary underline underline-offset-4 hover:text-primary/80"
        >
          {run.url}
        </a>

        <p className="text-sm text-muted-foreground">{run.testDescription}</p>

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>Created {formatDate(run.createdAt)}</span>
          {run.completedAt && (
            <span>Completed {formatDate(run.completedAt)}</span>
          )}
        </div>

        {run.error && (
          <p className="text-sm text-destructive">{run.error}</p>
        )}
      </div>

      {/* ---- Export Actions ---- */}
      {run.status === "complete" && (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={exporting !== null}
            onClick={async () => {
              setExporting("html");
              try {
                const result = await exportHtmlReport({
                  data: { testRunId: run.id },
                });
                const blob = new Blob([result.html], { type: "text/html" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = result.filename;
                a.click();
                URL.revokeObjectURL(url);
              } finally {
                setExporting(null);
              }
            }}
          >
            {exporting === "html" ? "Exporting..." : "Export HTML"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={exporting !== null}
            onClick={async () => {
              setExporting("pdf");
              try {
                const result = await exportPdfReport({
                  data: { testRunId: run.id },
                });
                const binary = atob(result.pdfBase64);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++)
                  bytes[i] = binary.charCodeAt(i);
                const blob = new Blob([bytes], {
                  type: "application/pdf",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = result.filename;
                a.click();
                URL.revokeObjectURL(url);
              } finally {
                setExporting(null);
              }
            }}
          >
            {exporting === "pdf" ? "Exporting..." : "Export PDF"}
          </Button>
        </div>
      )}

      {/* ---- Summary Card ---- */}
      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            {results.length} viewport(s) tested
          </p>

          <div className="flex flex-col gap-1">
            {viewportSummaries.map((vs) => (
              <div
                key={vs.viewport}
                className="flex items-center justify-between rounded-sm bg-muted/50 px-3 py-1.5 text-sm"
              >
                <span className="font-medium">{vs.viewport}</span>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{vs.totalSteps} steps</span>
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {vs.passed} passed
                  </span>
                  {vs.failed > 0 && (
                    <span className="text-red-600 dark:text-red-400">
                      {vs.failed} failed
                    </span>
                  )}
                  <span>{vs.durationSec}s</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 pt-1 text-sm font-medium">
            <span>
              Overall: {totalPassed}/{totalSteps} steps passed
            </span>
            <span className={passRateColor(passRate)}>
              ({passRate}% passed)
            </span>
            {totalFailed > 0 && (
              <span className="text-xs text-red-600 dark:text-red-400">
                {totalFailed} failed
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ---- Viewport Tabs ---- */}
      {results.length > 0 && (
        <Tabs defaultValue={results[0].viewport}>
          <TabsList>
            {results.map((result) => {
              const allPassed = result.steps.every(
                (s) => s.status === "pass",
              );
              return (
                <TabsTrigger key={result.viewport} value={result.viewport}>
                  <span className="flex items-center gap-1.5">
                    {result.viewport}
                    <span
                      className={`inline-block size-2 rounded-full ${allPassed ? "bg-emerald-500" : "bg-red-500"}`}
                    />
                  </span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {results.map((result) => (
            <TabsContent key={result.viewport} value={result.viewport}>
              <ViewportPanel
                testRunId={run.id}
                result={result}
                onScreenshotClick={setSelectedScreenshot}
              />
            </TabsContent>
          ))}
        </Tabs>
      )}

      {/* ---- Screenshot Zoom Dialog ---- */}
      <Dialog
        open={!!selectedScreenshot}
        onOpenChange={(open) => {
          if (!open) setSelectedScreenshot(null);
        }}
      >
        <DialogContent className="sm:max-w-4xl">
          <DialogTitle className="sr-only">Screenshot preview</DialogTitle>
          {selectedScreenshot && (
            <img
              src={`data:image/png;base64,${selectedScreenshot}`}
              alt="Step screenshot full size"
              className="w-full rounded-md"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ViewportPanel (step list for a single viewport)
// ---------------------------------------------------------------------------

interface ViewportPanelProps {
  testRunId: string;
  result: {
    viewport: string;
    totalDurationMs: number;
    videoPath?: string | null;
    startedAt: string | Date;
    completedAt: string | Date;
    steps: Array<{
      id: string;
      stepId: string;
      stepOrder: number;
      action: string | null;
      description: string | null;
      status: string;
      durationMs: number;
      errorMessage: string | null;
      errorExpected: string | null;
      errorActual: string | null;
      screenshotBase64: string | null;
    }>;
  };
  onScreenshotClick: (base64: string) => void;
}

function ViewportPanel({ testRunId, result, onScreenshotClick }: ViewportPanelProps) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loadingVideo, setLoadingVideo] = useState(false);

  // Export state
  const [exportState, setExportState] = useState<
    "idle" | "processing" | "complete" | "failed"
  >("idle");
  const [resolution, setResolution] = useState<ResolutionOption>(RESOLUTION_OPTIONS[0]);
  const [includeAnnotations, setIncludeAnnotations] = useState(true);
  const [trimDeadTime, setTrimDeadTime] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up object URL on unmount or when videoUrl changes
  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleExport = useCallback(async () => {
    setExportState("processing");
    try {
      const res = await triggerVideoExport({
        data: {
          testRunId,
          viewport: result.viewport,
          resolution: { width: resolution.width, height: resolution.height },
          includeAnnotations,
          trimDeadTime,
        },
      });
      // Start polling
      pollRef.current = setInterval(async () => {
        try {
          const status = await getExportStatus({
            data: { exportId: res.exportId },
          });

          if (status.status === "complete") {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            setExportState("complete");

            // Download the video
            const dl = await downloadExportedVideo({
              data: { outputPath: status.outputPath },
            });
            const binary = atob(dl.videoBase64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++)
              bytes[i] = binary.charCodeAt(i);
            const blob = new Blob([bytes], { type: dl.mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = dl.filename;
            a.click();
            URL.revokeObjectURL(url);

            // Reset to idle after download
            setTimeout(() => setExportState("idle"), 2000);
          } else if (status.status === "failed") {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            setExportState("failed");
          }
        } catch {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setExportState("failed");
        }
      }, 2000);
    } catch {
      setExportState("failed");
    }
  }, [testRunId, result.viewport, resolution, includeAnnotations, trimDeadTime]);

  const durationSec = (result.totalDurationMs / 1000).toFixed(1);
  const sortedSteps = [...result.steps].sort(
    (a, b) => a.stepOrder - b.stepOrder,
  );
  const useScrollArea = sortedSteps.length > 5;

  const stepList = (
    <div className="flex flex-col gap-3">
      {sortedSteps.map((step) => (
        <StepCard
          key={step.id}
          step={step}
          onScreenshotClick={onScreenshotClick}
        />
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-4 pt-4">
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{result.viewport}</span>
        <span>{durationSec}s total</span>
        <span>Started {formatDate(result.startedAt)}</span>
        <span>Completed {formatDate(result.completedAt)}</span>
      </div>

      {/* Debug video playback and export controls */}
      {result.videoPath && (
        <div className="flex flex-col gap-3 rounded-md border border-border p-4">
          <div className="flex items-center gap-2">
            {!videoUrl && (
              <Button
                variant="outline"
                size="sm"
                disabled={loadingVideo}
                onClick={async () => {
                  setLoadingVideo(true);
                  try {
                    const res = await getVideoFile({
                      data: { testRunId, viewport: result.viewport },
                    });
                    if (res.found) {
                      const binary = atob(res.videoBase64);
                      const bytes = new Uint8Array(binary.length);
                      for (let i = 0; i < binary.length; i++)
                        bytes[i] = binary.charCodeAt(i);
                      const blob = new Blob([bytes], { type: res.mimeType });
                      setVideoUrl(URL.createObjectURL(blob));
                    }
                  } finally {
                    setLoadingVideo(false);
                  }
                }}
              >
                {loadingVideo ? "Loading..." : "Play Debug Video"}
              </Button>
            )}
          </div>

          {videoUrl && (
            <div className="rounded-md border border-border overflow-hidden">
              <video
                controls
                preload="metadata"
                className="w-full max-h-[480px]"
                src={videoUrl}
              >
                <p className="text-sm text-muted-foreground p-4">
                  Your browser does not support WebM video playback.
                </p>
              </video>
            </div>
          )}

          {/* Polished video export controls */}
          <div className="flex flex-col gap-2 border-t border-border pt-3">
            <p className="text-sm font-medium">Export Polished Video</p>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                Resolution:
                <select
                  className="rounded-sm border border-border bg-background px-2 py-1 text-xs"
                  value={resolution.label}
                  onChange={(e) => {
                    const opt = RESOLUTION_OPTIONS.find(
                      (o) => o.label === e.target.value,
                    );
                    if (opt) setResolution(opt);
                  }}
                >
                  {RESOLUTION_OPTIONS.map((opt) => (
                    <option key={opt.label} value={opt.label}>
                      {opt.label} ({opt.width}x{opt.height})
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={includeAnnotations}
                  onChange={(e) => setIncludeAnnotations(e.target.checked)}
                  className="rounded-sm"
                />
                Step annotations
              </label>

              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={trimDeadTime}
                  onChange={(e) => setTrimDeadTime(e.target.checked)}
                  className="rounded-sm"
                />
                Trim dead time
              </label>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={exportState === "processing"}
                onClick={handleExport}
              >
                {exportState === "processing"
                  ? "Processing video..."
                  : exportState === "complete"
                    ? "Export complete"
                    : exportState === "failed"
                      ? "Export failed - Retry"
                      : "Export Polished Video"}
              </Button>

              {exportState === "processing" && (
                <span className="inline-flex items-center rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 animate-pulse dark:bg-amber-900 dark:text-amber-200">
                  Processing...
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {useScrollArea ? (
        <ScrollArea className="h-[600px]">{stepList}</ScrollArea>
      ) : (
        stepList
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StepCard (individual step)
// ---------------------------------------------------------------------------

interface StepCardProps {
  step: {
    id: string;
    stepId: string;
    stepOrder: number;
    action: string | null;
    description: string | null;
    status: string;
    durationMs: number;
    errorMessage: string | null;
    errorExpected: string | null;
    errorActual: string | null;
    screenshotBase64: string | null;
  };
  onScreenshotClick: (base64: string) => void;
}

function StepCard({ step, onScreenshotClick }: StepCardProps) {
  const isPassed = step.status === "pass";

  return (
    <div className="flex flex-col gap-2 rounded-sm border border-border p-4">
      {/* Step header */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Step {step.stepOrder}</span>
        {step.action && (
          <span
            className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium ${ACTION_COLORS[step.action] ?? "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"}`}
          >
            {step.action}
          </span>
        )}
        <Badge variant={isPassed ? "default" : "destructive"}>
          {step.status}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {step.durationMs}ms
        </span>
      </div>

      <p className="text-xs text-muted-foreground">{step.description ?? step.stepId}</p>

      {/* Error details */}
      {!isPassed && step.errorMessage && (
        <div className="flex flex-col gap-1">
          <p className="text-sm text-destructive">{step.errorMessage}</p>
          {(step.errorExpected || step.errorActual) && (
            <div className="rounded-sm bg-muted p-2 font-mono text-xs">
              {step.errorExpected && (
                <p>
                  <span className="text-muted-foreground">Expected: </span>
                  {step.errorExpected}
                </p>
              )}
              {step.errorActual && (
                <p>
                  <span className="text-muted-foreground">Actual: </span>
                  {step.errorActual}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Screenshot */}
      {step.screenshotBase64 ? (
        <button
          type="button"
          onClick={() => onScreenshotClick(step.screenshotBase64!)}
          className="cursor-pointer"
        >
          <img
            src={`data:image/png;base64,${step.screenshotBase64}`}
            alt={`Step ${step.stepOrder} screenshot`}
            className="w-full max-w-md max-h-48 rounded-md border border-border object-cover"
            loading="lazy"
          />
        </button>
      ) : (
        <p className="text-xs text-muted-foreground">
          No screenshot available
        </p>
      )}
    </div>
  );
}
