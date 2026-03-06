import { useState, useEffect, useRef, useCallback } from "react";
import { getTestRunStatusFn } from "@/server/run-test";

interface TestRunStatus {
  phase: string;
  viewportsComplete: number;
  viewportsTotal: number;
  error?: string;
}

const TERMINAL_PHASES = ["complete", "failed"];

export function useTestRunPolling(
  testRunId: string | null,
  intervalMs = 2000,
) {
  const [status, setStatus] = useState<TestRunStatus | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPolling(false);
  }, []);

  useEffect(() => {
    if (!testRunId) {
      setStatus(null);
      setIsPolling(false);
      return;
    }

    let cancelled = false;

    async function poll() {
      try {
        const result = await getTestRunStatusFn({ data: { testRunId: testRunId! } });
        if (cancelled) return;

        if (result.found && result.status) {
          const s = result.status as TestRunStatus;
          setStatus(s);

          if (TERMINAL_PHASES.includes(s.phase)) {
            stopPolling();
          }
        }
      } catch {
        // Silently ignore polling errors -- will retry on next interval
      }
    }

    // Immediately fetch on mount / testRunId change
    setIsPolling(true);
    poll();

    // Set up polling interval
    intervalRef.current = setInterval(poll, intervalMs);

    return () => {
      cancelled = true;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [testRunId, intervalMs, stopPolling]);

  return { status, isPolling, stopPolling };
}
