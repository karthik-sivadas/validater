import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { runTest } from "@/server/run-test";
import { useTestRunPolling } from "@/hooks/use-test-run-polling";
import { useLiveStream } from "@/hooks/use-live-stream";
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
import { LiveViewer } from "@/components/live-viewer";

export const Route = createFileRoute("/_authed/dashboard")({
  component: DashboardPage,
});

const PHASE_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  pending: { label: "Pending", variant: "outline" },
  crawling: { label: "Crawling Page", variant: "secondary" },
  generating: { label: "Generating Steps", variant: "secondary" },
  validating: { label: "Validating Locators", variant: "secondary" },
  executing: { label: "Executing Tests", variant: "secondary" },
  persisting: { label: "Saving Results", variant: "secondary" },
  complete: { label: "Complete", variant: "default" },
  failed: { label: "Failed", variant: "destructive" },
};

const PHASE_PROGRESS: Record<string, number> = {
  pending: 0,
  crawling: 15,
  generating: 30,
  validating: 50,
  executing: 70,
  persisting: 85,
  complete: 100,
  failed: 100,
};

function DashboardPage() {
  const navigate = useNavigate();

  const [url, setUrl] = useState("");
  const [testDescription, setTestDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testRunId, setTestRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { status, isPolling } = useTestRunPolling(testRunId);

  // Connect WebSocket early (as soon as testRunId exists) so the stream
  // is ready before execution starts. This prevents the race condition
  // where execution finishes before the WS handshake completes.
  const liveStream = useLiveStream(testRunId);

  async function handleSubmit() {
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await runTest({ data: { url, testDescription } });
      setTestRunId(result.testRunId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start test");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleNewTest() {
    setTestRunId(null);
    setUrl("");
    setTestDescription("");
    setError(null);
  }

  function getProgressPercent(): number {
    if (!status) return 0;
    if (status.phase === "executing" && status.viewportsTotal > 0) {
      // Interpolate between 70-85 based on viewport progress
      const base = PHASE_PROGRESS.executing;
      const next = PHASE_PROGRESS.persisting;
      return base + ((next - base) * status.viewportsComplete) / status.viewportsTotal;
    }
    return PHASE_PROGRESS[status.phase] ?? 0;
  }

  // Progress state
  if (testRunId) {
    const phaseInfo = status ? PHASE_LABELS[status.phase] : null;
    const progressPercent = getProgressPercent();
    const isTerminal = status?.phase === "complete" || status?.phase === "failed";

    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <Card className={`w-full ${status?.phase === 'executing' ? 'max-w-5xl' : 'max-w-xl'}`}>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Test Run in Progress</CardTitle>
            <p className="text-xs text-muted-foreground font-mono">{testRunId}</p>
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
                <span className="text-xs text-muted-foreground animate-pulse">polling</span>
              )}
            </div>

            {/* Progress bar */}
            <Progress value={progressPercent} />

            {/* Live viewer during execution */}
            {status?.phase === 'executing' && testRunId && (
              <LiveViewer
                frame={liveStream.frame}
                steps={liveStream.steps}
                connected={liveStream.connected}
                ended={liveStream.ended}
              />
            )}

            {/* Viewport progress */}
            {status && (
              <p className="text-sm text-muted-foreground">
                {status.viewportsComplete} of {status.viewportsTotal} viewports complete
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
                      to: "/runs/$runId",
                      params: { runId: testRunId },
                    })
                  }
                >
                  View Results
                </Button>
              )}
              {isTerminal && (
                <Button variant="outline" onClick={handleNewTest}>
                  New Test
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Form state
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Create New Test</CardTitle>
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
            <Label htmlFor="testDescription">Test Description</Label>
            <Textarea
              id="testDescription"
              placeholder="Describe what to test..."
              value={testDescription}
              onChange={(e) => setTestDescription(e.target.value)}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Describe the user journey to test in plain English
            </p>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !url || !testDescription}
          >
            {isSubmitting ? "Starting..." : "Run Test"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
