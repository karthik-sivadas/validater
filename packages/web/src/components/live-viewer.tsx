import { useEffect, useRef } from "react";
import { useLiveStream, type StepEvent } from "@/hooks/use-live-stream";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface LiveViewerProps {
  testRunId: string;
}

export function LiveViewer({ testRunId }: LiveViewerProps) {
  const { frame, steps, connected, ended } = useLiveStream(testRunId);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new steps arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [steps.length]);

  return (
    <div className="grid grid-cols-3 gap-4">
      {/* Left panel: Browser feed (2/3 width) */}
      <div className="col-span-2 relative">
        {/* Connection indicator */}
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5 rounded-md bg-background/80 px-2 py-1 backdrop-blur-sm">
          {connected ? (
            <>
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
              </span>
              <span className="text-xs font-medium text-red-600">LIVE</span>
            </>
          ) : ended ? (
            <span className="text-xs text-muted-foreground">
              Stream ended
            </span>
          ) : (
            <span className="text-xs text-muted-foreground animate-pulse">
              Reconnecting...
            </span>
          )}
        </div>

        {/* Frame display */}
        {frame ? (
          <div className="aspect-video overflow-hidden rounded-lg border">
            <img
              src={`data:image/jpeg;base64,${frame}`}
              alt="Live browser view"
              className="w-full h-full object-contain"
            />
          </div>
        ) : (
          <div className="aspect-video flex items-center justify-center rounded-lg border bg-muted/30">
            <span className="text-sm text-muted-foreground">
              Waiting for stream...
            </span>
          </div>
        )}
      </div>

      {/* Right panel: Step log (1/3 width) */}
      <div className="col-span-1 flex flex-col gap-2">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Step Log</span>
          <Badge variant="outline">{steps.length}</Badge>
        </div>

        {/* Step list */}
        <ScrollArea className="max-h-[500px] overflow-y-auto">
          <div className="flex flex-col gap-2 pr-2">
            {steps.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                Waiting for steps...
              </p>
            ) : (
              steps.map((step: StepEvent) => (
                <StepRow key={step.stepId} step={step} />
              ))
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function StepRow({ step }: { step: StepEvent }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md border px-2.5 py-1.5">
      <div className="flex items-center gap-2">
        <Badge variant={step.status === "pass" ? "default" : "destructive"}>
          {step.status}
        </Badge>
        <span className="text-sm">Step {step.stepOrder}</span>
        <span className="text-xs text-muted-foreground ml-auto">
          {step.durationMs}ms
        </span>
      </div>
      {step.error && (
        <p className="text-xs text-destructive mt-0.5">{step.error}</p>
      )}
    </div>
  );
}
