import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { getTestRunDetail } from "@/server/test-runs";
import { Badge } from "@/components/ui/badge";
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function TestRunDetailPage() {
  const loaderData = Route.useLoaderData() as TestRunDetailData;
  const { run, results } = loaderData;
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(
    null,
  );

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
  result: {
    viewport: string;
    totalDurationMs: number;
    startedAt: string | Date;
    completedAt: string | Date;
    steps: Array<{
      id: string;
      stepId: string;
      stepOrder: number;
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

function ViewportPanel({ result, onScreenshotClick }: ViewportPanelProps) {
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
        <Badge variant={isPassed ? "default" : "destructive"}>
          {step.status}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {step.durationMs}ms
        </span>
      </div>

      <p className="text-xs text-muted-foreground">{step.stepId}</p>

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
            className="w-full max-w-2xl rounded-md border border-border"
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
