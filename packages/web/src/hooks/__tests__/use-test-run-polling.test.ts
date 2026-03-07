import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mock the server function BEFORE importing the hook
// ---------------------------------------------------------------------------

const mockGetTestRunStatusFn = vi.fn();

vi.mock('@/server/run-test', () => ({
  getTestRunStatusFn: (...args: unknown[]) => mockGetTestRunStatusFn(...args),
}));

import { useTestRunPolling } from '../use-test-run-polling';

// ---------------------------------------------------------------------------
// Helper: flush pending microtasks (resolved promises)
// ---------------------------------------------------------------------------

async function flushMicrotasks() {
  await act(async () => {
    // Flush all resolved promises
    await vi.advanceTimersByTimeAsync(0);
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useTestRunPolling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockGetTestRunStatusFn.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null status and isPolling false when testRunId is null', () => {
    const { result } = renderHook(() => useTestRunPolling(null));
    expect(result.current.status).toBeNull();
    expect(result.current.isPolling).toBe(false);
  });

  it('immediately polls on mount when testRunId is provided', async () => {
    mockGetTestRunStatusFn.mockResolvedValue({
      found: true,
      status: { phase: 'executing', viewportsComplete: 0, viewportsTotal: 2 },
    });

    const { result } = renderHook(() => useTestRunPolling('run-1', 2000));

    // Flush the initial poll() call (which is an async function)
    await flushMicrotasks();

    expect(mockGetTestRunStatusFn).toHaveBeenCalledWith({ data: { testRunId: 'run-1' } });
    expect(result.current.status).toEqual({
      phase: 'executing',
      viewportsComplete: 0,
      viewportsTotal: 2,
    });
    expect(result.current.isPolling).toBe(true);
  });

  it('polls at the specified interval', async () => {
    mockGetTestRunStatusFn.mockResolvedValue({
      found: true,
      status: { phase: 'executing', viewportsComplete: 0, viewportsTotal: 2 },
    });

    renderHook(() => useTestRunPolling('run-1', 1000));

    // Flush initial poll
    await flushMicrotasks();
    expect(mockGetTestRunStatusFn).toHaveBeenCalledTimes(1);

    // Advance past one interval
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(mockGetTestRunStatusFn).toHaveBeenCalledTimes(2);
  });

  it('stops polling when status phase is "complete"', async () => {
    mockGetTestRunStatusFn.mockResolvedValue({
      found: true,
      status: { phase: 'complete', viewportsComplete: 2, viewportsTotal: 2 },
    });

    const { result } = renderHook(() => useTestRunPolling('run-1', 1000));

    // Flush initial poll which returns terminal status
    await flushMicrotasks();

    expect(result.current.status?.phase).toBe('complete');
    expect(result.current.isPolling).toBe(false);

    const callCount = mockGetTestRunStatusFn.mock.calls.length;

    // Advance timers -- no new calls expected
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(mockGetTestRunStatusFn).toHaveBeenCalledTimes(callCount);
  });

  it('stops polling when status phase is "failed"', async () => {
    mockGetTestRunStatusFn.mockResolvedValue({
      found: true,
      status: { phase: 'failed', viewportsComplete: 1, viewportsTotal: 2, error: 'timeout' },
    });

    const { result } = renderHook(() => useTestRunPolling('run-1', 1000));

    await flushMicrotasks();

    expect(result.current.status?.phase).toBe('failed');
    expect(result.current.isPolling).toBe(false);
  });

  it('clears interval on unmount', async () => {
    mockGetTestRunStatusFn.mockResolvedValue({
      found: true,
      status: { phase: 'executing', viewportsComplete: 0, viewportsTotal: 2 },
    });

    const { unmount } = renderHook(() => useTestRunPolling('run-1', 1000));

    await flushMicrotasks();

    const callCount = mockGetTestRunStatusFn.mock.calls.length;
    unmount();

    // Advance timers after unmount -- no new calls expected
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(mockGetTestRunStatusFn).toHaveBeenCalledTimes(callCount);
  });

  it('returns stopPolling callback', () => {
    const { result } = renderHook(() => useTestRunPolling(null));
    expect(typeof result.current.stopPolling).toBe('function');
  });

  it('silently ignores polling errors', async () => {
    mockGetTestRunStatusFn.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useTestRunPolling('run-1', 1000));

    // Flush the failed call
    await flushMicrotasks();

    // Status remains null since the call failed
    expect(result.current.status).toBeNull();
    // But hook doesn't crash -- isPolling is still true
    expect(result.current.isPolling).toBe(true);
  });

  it('resets status when testRunId changes to null', async () => {
    mockGetTestRunStatusFn.mockResolvedValue({
      found: true,
      status: { phase: 'executing', viewportsComplete: 0, viewportsTotal: 2 },
    });

    const { result, rerender } = renderHook(
      ({ id }: { id: string | null }) => useTestRunPolling(id, 1000),
      { initialProps: { id: 'run-1' as string | null } },
    );

    await flushMicrotasks();
    expect(result.current.status).not.toBeNull();

    // Change to null
    rerender({ id: null });

    expect(result.current.status).toBeNull();
    expect(result.current.isPolling).toBe(false);
  });

  it('restarts polling when testRunId changes', async () => {
    mockGetTestRunStatusFn.mockResolvedValue({
      found: true,
      status: { phase: 'executing', viewportsComplete: 0, viewportsTotal: 2 },
    });

    const { rerender } = renderHook(
      ({ id }: { id: string | null }) => useTestRunPolling(id, 1000),
      { initialProps: { id: 'run-1' as string | null } },
    );

    await flushMicrotasks();
    expect(mockGetTestRunStatusFn).toHaveBeenCalledWith({ data: { testRunId: 'run-1' } });

    // Change to different run
    rerender({ id: 'run-2' });
    await flushMicrotasks();

    expect(mockGetTestRunStatusFn).toHaveBeenCalledWith({ data: { testRunId: 'run-2' } });
  });
});
