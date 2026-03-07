import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef, useCallback } from "react";
import { generateSuite, getSuiteStatusFn } from "@/server/test-suites";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authed/suites/new")({
  component: NewSuitePage,
});

// ---------------------------------------------------------------------------
// Phase labels and progress
// ---------------------------------------------------------------------------

const PHASE_LABELS: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  pending: { label: "Pending", variant: "outline" },
  crawling: { label: "Crawling Page", variant: "secondary" },
  generating_specs: { label: "Generating Test Cases", variant: "secondary" },
  generating_steps: { label: "Generating Steps", variant: "secondary" },
  persisting: { label: "Saving Suite", variant: "secondary" },
  complete: { label: "Complete", variant: "default" },
  failed: { label: "Failed", variant: "destructive" },
};

const PHASE_PROGRESS: Record<string, number> = {
  pending: 0,
  crawling: 15,
  generating_specs: 30,
  generating_steps: 50,
  persisting: 85,
  complete: 100,
  failed: 100,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface SuiteStatus {
  phase: string;
  testCasesTotal: number;
  testCasesGenerated: number;
  error?: string;
}

function NewSuitePage() {
  const navigate = useNavigate();

  const [url, setUrl] = useState("");
  const [featureDescription, setFeatureDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [suiteId, setSuiteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Polling state
  const [status, setStatus] = useState<SuiteStatus | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPolling(false);
  }, []);

  // Poll for status
  useEffect(() => {
    if (!suiteId) return;

    let cancelled = false;

    async function poll() {
      try {
        const result = await getSuiteStatusFn({ data: { suiteId: suiteId! } });
        if (cancelled) return;

        if (result.found && result.status) {
          const s = result.status as SuiteStatus;
          setStatus(s);

          if (s.phase === "complete" || s.phase === "failed") {
            stopPolling();
          }
        }
      } catch {
        // Silently ignore polling errors
      }
    }

    setIsPolling(true);
    poll();
    intervalRef.current = setInterval(poll, 2000);

    return () => {
      cancelled = true;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [suiteId, stopPolling]);

  async function handleSubmit() {
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await generateSuite({
        data: { url, featureDescription },
      });
      setSuiteId(result.suiteId);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to start suite generation",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleTryAgain() {
    setSuiteId(null);
    setStatus(null);
    setError(null);
  }

  function getProgressPercent(): number {
    if (!status) return 0;
    if (
      status.phase === "generating_steps" &&
      status.testCasesTotal > 0
    ) {
      // Interpolate between 50-85 based on step generation progress
      const base = PHASE_PROGRESS.generating_steps;
      const next = PHASE_PROGRESS.persisting;
      return (
        base +
        ((next - base) * status.testCasesGenerated) / status.testCasesTotal
      );
    }
    return PHASE_PROGRESS[status.phase] ?? 0;
  }

  // ---- Progress view ----
  if (suiteId) {
    const phaseInfo = status ? PHASE_LABELS[status.phase] : null;
    const progressPercent = getProgressPercent();
    const isTerminal =
      status?.phase === "complete" || status?.phase === "failed";

    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">
              Suite Generation in Progress
            </CardTitle>
            <p className="text-xs text-muted-foreground font-mono">
              {suiteId}
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {/* Phase badge */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Status:</span>
              {phaseInfo ? (
                <Badge variant={phaseInfo.variant}>{phaseInfo.label}</Badge>
              ) : (
                <Badge variant="outline">Loading...</Badge>
              )}
              {isPolling && (
                <span className="text-xs text-muted-foreground animate-pulse">
                  polling
                </span>
              )}
            </div>

            {/* Progress bar */}
            <Progress value={progressPercent} />

            {/* Step generation progress */}
            {status &&
              status.phase === "generating_steps" &&
              status.testCasesTotal > 0 && (
                <p className="text-sm text-muted-foreground">
                  {status.testCasesGenerated} of {status.testCasesTotal} test
                  cases generated
                </p>
              )}

            {/* Error display */}
            {status?.error && (
              <p className="text-sm text-destructive">{status.error}</p>
            )}

            {/* Action buttons */}
            <div className="flex gap-3">
              {status?.phase === "complete" && (
                <Button
                  onClick={() =>
                    navigate({
                      to: "/suites/$suiteId",
                      params: { suiteId: suiteId },
                    })
                  }
                >
                  View Suite
                </Button>
              )}
              {status?.phase === "failed" && (
                <Button variant="outline" onClick={handleTryAgain}>
                  Try Again
                </Button>
              )}
              {isTerminal && (
                <Button
                  variant="outline"
                  onClick={() => navigate({ to: "/suites" })}
                >
                  Back to Suites
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---- Form view ----
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">
            Generate Test Suite
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="url">Target URL</Label>
            <Input
              id="url"
              type="url"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="featureDescription">Feature Description</Label>
            <Textarea
              id="featureDescription"
              placeholder="Describe the feature to test comprehensively..."
              value={featureDescription}
              onChange={(e) => setFeatureDescription(e.target.value)}
              rows={6}
            />
            <p className="text-xs text-muted-foreground">
              Describe the feature or user flow you want to generate tests for.
              The AI will create 4-8 test cases covering happy path, edge cases,
              error states, and boundary conditions.
            </p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !url || !featureDescription}
          >
            {isSubmitting ? "Starting..." : "Generate Suite"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
