import { useState, useEffect, useRef, useCallback } from "react";

export interface StepEvent {
  stepId: string;
  stepOrder: number;
  status: "pass" | "fail";
  durationMs: number;
  error?: string;
}

interface StreamMessage {
  type: "frame" | "step-start" | "step-complete" | "stream-end";
  testRunId: string;
  timestamp: number;
  payload: unknown;
}

interface LiveStreamState {
  frame: string | null;
  steps: StepEvent[];
  connected: boolean;
  ended: boolean;
}

export function useLiveStream(testRunId: string | null): LiveStreamState {
  const [frame, setFrame] = useState<string | null>(null);
  const [steps, setSteps] = useState<StepEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [ended, setEnded] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endedRef = useRef(false);

  const cleanup = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  useEffect(() => {
    // Reset all state when testRunId changes
    setFrame(null);
    setSteps([]);
    setConnected(false);
    setEnded(false);
    endedRef.current = false;
    retryCountRef.current = 0;

    if (!testRunId) {
      return;
    }

    let unmounted = false;

    function connect() {
      if (unmounted) return;

      const wsBase =
        import.meta.env.VITE_WS_URL ?? "ws://localhost:3001";
      const wsUrl = `${wsBase}/stream/${testRunId}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (unmounted) return;
        setConnected(true);
        retryCountRef.current = 0;
      };

      ws.onmessage = (event) => {
        if (unmounted) return;
        try {
          const msg = JSON.parse(event.data as string) as StreamMessage;
          switch (msg.type) {
            case "frame": {
              const payload = msg.payload as { data: string };
              setFrame(payload.data);
              break;
            }
            case "step-complete": {
              const step = msg.payload as StepEvent;
              setSteps((prev) => [...prev, step]);
              break;
            }
            case "stream-end": {
              endedRef.current = true;
              setEnded(true);
              ws.close();
              break;
            }
            // step-start: ignored for now (no UI for in-progress steps)
          }
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = () => {
        if (unmounted) return;
        setConnected(false);

        // Do NOT reconnect if stream ended normally or retries exhausted
        if (!endedRef.current && retryCountRef.current < 10) {
          const delay = Math.min(
            500 * Math.pow(2, retryCountRef.current),
            30000,
          );
          const jitter = Math.random() * 500;
          retryCountRef.current += 1;

          retryTimerRef.current = setTimeout(() => {
            if (!unmounted) {
              connect();
            }
          }, delay + jitter);
        }
      };

      ws.onerror = () => {
        // onclose will fire after onerror, so reconnect logic is handled there
        if (!unmounted) {
          console.warn(`[useLiveStream] WebSocket error for ${testRunId}`);
        }
      };
    }

    connect();

    return () => {
      unmounted = true;
      cleanup();
    };
  }, [testRunId, cleanup]);

  return { frame, steps, connected, ended };
}
