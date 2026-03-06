import { useEffect, useRef } from "react";
import type { StepEvent } from "@/hooks/use-live-stream";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

// ---------------------------------------------------------------------------
// Action badge color map (shared with results page for visual consistency)
// ---------------------------------------------------------------------------

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
// Canvas-based browser frame display (double-buffered, flicker-free)
// ---------------------------------------------------------------------------

function BrowserCanvas({ frame }: { frame: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      // Only resize canvas when dimensions change (avoids canvas clear)
      if (canvas.width !== img.width || canvas.height !== img.height) {
        canvas.width = img.width;
        canvas.height = img.height;
      }
      ctx.drawImage(img, 0, 0);
    };
    img.src = `data:image/jpeg;base64,${frame}`;
  }, [frame]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ display: "block" }}
    />
  );
}

// ---------------------------------------------------------------------------
// LiveViewer
// ---------------------------------------------------------------------------

interface LiveViewerProps {
  frame: string | null;
  steps: StepEvent[];
  connected: boolean;
  ended: boolean;
}

export function LiveViewer({ frame, steps, connected, ended }: LiveViewerProps) {
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

        {/* Frame display (canvas-based, flicker-free) */}
        {frame ? (
          <div className="aspect-video overflow-hidden rounded-lg border">
            <BrowserCanvas frame={frame} />
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

// ---------------------------------------------------------------------------
// StepRow (enriched with action badge and description)
// ---------------------------------------------------------------------------

function StepRow({ step }: { step: StepEvent }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md border px-2.5 py-1.5">
      <div className="flex items-center gap-2">
        <Badge variant={step.status === "pass" ? "default" : "destructive"}>
          {step.status}
        </Badge>
        <span
          className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium ${ACTION_COLORS[step.action] ?? ACTION_COLORS.wait}`}
        >
          {step.action}
        </span>
        <span className="text-xs text-muted-foreground ml-auto">
          {step.durationMs}ms
        </span>
      </div>
      <p className="text-xs text-muted-foreground truncate">
        {step.description}
      </p>
      {step.error && (
        <p className="text-xs text-destructive mt-0.5">{step.error}</p>
      )}
    </div>
  );
}
