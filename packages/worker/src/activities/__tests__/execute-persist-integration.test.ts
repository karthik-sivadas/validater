import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockDb } from '@validater/core/__test-utils__';
import type { ExecutionResult } from '@validater/core';

// ---------------------------------------------------------------------------
// Mock drizzle-orm operators (they're used in where/eq clauses)
// ---------------------------------------------------------------------------

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => args),
  and: vi.fn((...args: unknown[]) => args),
}));

// ---------------------------------------------------------------------------
// Mock nanoid (deterministic IDs for assertions)
// ---------------------------------------------------------------------------

let nanoidCounter = 0;
vi.mock('nanoid', () => ({
  nanoid: vi.fn(() => `mock-id-${++nanoidCounter}`),
}));

// ---------------------------------------------------------------------------
// Import the factory under test
// ---------------------------------------------------------------------------

import { createPersistActivities } from '../persist-results.activity.js';

// ---------------------------------------------------------------------------
// Realistic fixture data matching ExecutionResult shapes
// ---------------------------------------------------------------------------

function makeRealisticResult(overrides: Partial<ExecutionResult> = {}): ExecutionResult {
  return {
    viewport: 'desktop',
    url: 'https://example.com',
    stepResults: [
      {
        stepId: 'step-1',
        stepOrder: 1,
        action: 'navigate',
        description: 'Go to homepage',
        status: 'pass',
        durationMs: 1500,
        screenshotBase64: '',
        error: undefined,
      },
      {
        stepId: 'step-2',
        stepOrder: 2,
        action: 'click',
        description: 'Click login button',
        status: 'fail',
        durationMs: 500,
        screenshotBase64: '',
        error: { message: 'Element not found', expected: 'visible', actual: 'hidden' },
      },
    ],
    totalDurationMs: 2000,
    startedAt: '2026-01-01T00:00:00.000Z',
    completedAt: '2026-01-01T00:00:02.000Z',
    videoPath: 'test-run-1/desktop.webm',
    accessibilityData: {
      violationCount: 2,
      passCount: 10,
      incompleteCount: 1,
      inapplicableCount: 5,
      violations: [
        {
          id: 'color-contrast',
          impact: 'serious',
          description: 'Elements must have sufficient color contrast',
          help: 'Fix contrast',
          helpUrl: 'https://dequeuniversity.com/rules/axe/4.x/color-contrast',
          tags: ['wcag2aa'],
          nodes: [
            {
              target: ['button.submit'],
              html: '<button class="submit">Submit</button>',
              impact: 'serious',
              failureSummary: 'Fix contrast ratio',
            },
          ],
          nodeCount: 1,
        },
      ],
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('execution-to-persistence integration', () => {
  let mockDb: ReturnType<typeof createMockDb>;
  let activities: ReturnType<typeof createPersistActivities>;

  // Track the mock chain's methods to inspect calls
  let mockChain: {
    values: ReturnType<typeof vi.fn>;
    where: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    from: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    nanoidCounter = 0;

    mockDb = createMockDb();
    activities = createPersistActivities(mockDb);

    // Extract the mock chain for assertions
    // The chain is created on each insert/update/delete/select call
    // We need to capture it from the mock return value
    const chain = (mockDb.insert as ReturnType<typeof vi.fn>)();
    mockChain = {
      values: chain.values,
      where: chain.where,
      set: chain.set,
      from: chain.from,
      limit: chain.limit,
    };
  });

  it('persistResults completes without error for realistic ExecutionResult', async () => {
    await expect(
      activities.persistResults({
        testRunId: 'run-1',
        results: [makeRealisticResult()],
      }),
    ).resolves.toBeUndefined();
  });

  it('inserts testRunResults with correct viewport, url, totalDurationMs, videoPath', async () => {
    await activities.persistResults({
      testRunId: 'run-1',
      results: [makeRealisticResult()],
    });

    // First insert call is for testRunResults
    const insertCalls = (mockDb.insert as ReturnType<typeof vi.fn>).mock.calls;
    expect(insertCalls.length).toBeGreaterThan(0);

    // The values mock is called with the result data
    const valuesCalls = mockChain.values.mock.calls;
    const resultInsert = valuesCalls[0]![0];

    expect(resultInsert).toMatchObject({
      testRunId: 'run-1',
      viewport: 'desktop',
      url: 'https://example.com',
      totalDurationMs: 2000,
      videoPath: 'test-run-1/desktop.webm',
    });
  });

  it('inserts testRunSteps for each stepResult with correct fields', async () => {
    await activities.persistResults({
      testRunId: 'run-1',
      results: [makeRealisticResult()],
    });

    const valuesCalls = mockChain.values.mock.calls;

    // Find step inserts (calls after the first result insert, before accessibility)
    // Call 0: testRunResults
    // Call 1: first step (after select for screenshot staging)
    // Call 2: second step (after select for screenshot staging)
    // Call 3: accessibilityResults
    // We verify step data was inserted with correct actions/descriptions

    // There should be multiple values calls
    expect(valuesCalls.length).toBeGreaterThanOrEqual(3);

    // Find step inserts by checking for action field
    const stepInserts = valuesCalls
      .map((call: unknown[]) => call[0] as Record<string, unknown>)
      .filter((val: Record<string, unknown>) => 'action' in val);

    expect(stepInserts).toHaveLength(2);

    expect(stepInserts[0]).toMatchObject({
      stepId: 'step-1',
      stepOrder: 1,
      action: 'navigate',
      description: 'Go to homepage',
      status: 'pass',
      durationMs: 1500,
    });

    expect(stepInserts[1]).toMatchObject({
      stepId: 'step-2',
      stepOrder: 2,
      action: 'click',
      description: 'Click login button',
      status: 'fail',
      durationMs: 500,
    });
  });

  it('maps error fields correctly for failed steps', async () => {
    await activities.persistResults({
      testRunId: 'run-1',
      results: [makeRealisticResult()],
    });

    const valuesCalls = mockChain.values.mock.calls;
    const stepInserts = valuesCalls
      .map((call: unknown[]) => call[0] as Record<string, unknown>)
      .filter((val: Record<string, unknown>) => 'action' in val);

    // First step (passed) has no error fields
    expect(stepInserts[0]!.errorMessage).toBeUndefined();

    // Second step (failed) has error fields mapped
    expect(stepInserts[1]).toMatchObject({
      errorMessage: 'Element not found',
      errorExpected: 'visible',
      errorActual: 'hidden',
    });
  });

  it('inserts accessibilityResults with violation data', async () => {
    await activities.persistResults({
      testRunId: 'run-1',
      results: [makeRealisticResult()],
    });

    const valuesCalls = mockChain.values.mock.calls;

    // Find accessibility insert by checking for violationCount field
    const a11yInserts = valuesCalls
      .map((call: unknown[]) => call[0] as Record<string, unknown>)
      .filter((val: Record<string, unknown>) => 'violationCount' in val);

    expect(a11yInserts).toHaveLength(1);
    expect(a11yInserts[0]).toMatchObject({
      violationCount: 2,
      passCount: 10,
      incompleteCount: 1,
      inapplicableCount: 5,
    });
    expect(a11yInserts[0]!.violations).toBeDefined();
  });

  it('deletes from stepScreenshots staging table to clean up', async () => {
    await activities.persistResults({
      testRunId: 'run-1',
      results: [makeRealisticResult()],
    });

    expect(mockDb.delete).toHaveBeenCalled();
  });

  it('updates testRuns to set status=complete', async () => {
    await activities.persistResults({
      testRunId: 'run-1',
      results: [makeRealisticResult()],
    });

    expect(mockDb.update).toHaveBeenCalled();
    const setCalls = mockChain.set.mock.calls;
    const statusUpdate = setCalls.find(
      (call: unknown[]) => (call[0] as Record<string, unknown>).status === 'complete',
    );
    expect(statusUpdate).toBeDefined();
  });

  it('persists multiple viewports when given 2 ExecutionResult objects', async () => {
    const desktopResult = makeRealisticResult({ viewport: 'desktop' });
    const mobileResult = makeRealisticResult({
      viewport: 'mobile',
      stepResults: [
        {
          stepId: 'step-m1',
          stepOrder: 1,
          action: 'navigate',
          description: 'Go to homepage',
          status: 'pass',
          durationMs: 800,
          screenshotBase64: '',
        },
      ],
      totalDurationMs: 800,
      videoPath: 'test-run-1/mobile.webm',
    });

    await activities.persistResults({
      testRunId: 'run-1',
      results: [desktopResult, mobileResult],
    });

    // Should have 2 result inserts (desktop and mobile)
    const valuesCalls = mockChain.values.mock.calls;
    const resultInserts = valuesCalls
      .map((call: unknown[]) => call[0] as Record<string, unknown>)
      .filter((val: Record<string, unknown>) => 'viewport' in val && 'url' in val && !('action' in val));

    expect(resultInserts).toHaveLength(2);
    expect(resultInserts[0]!.viewport).toBe('desktop');
    expect(resultInserts[1]!.viewport).toBe('mobile');
  });

  it('looks up screenshots from staging table for each step', async () => {
    await activities.persistResults({
      testRunId: 'run-1',
      results: [makeRealisticResult()],
    });

    // select() should be called for each step to check staging table
    expect(mockDb.select).toHaveBeenCalled();
  });

  it('uses cached screenshot from staging table when available', async () => {
    // Override the select mock to return a cached screenshot for step 1
    const selectChain = (mockDb.select as ReturnType<typeof vi.fn>)();
    selectChain.limit.mockResolvedValue([
      { screenshotBase64: 'data:image/png;base64,cached-screenshot' },
    ]);

    await activities.persistResults({
      testRunId: 'run-1',
      results: [makeRealisticResult()],
    });

    const valuesCalls = mockChain.values.mock.calls;
    const stepInserts = valuesCalls
      .map((call: unknown[]) => call[0] as Record<string, unknown>)
      .filter((val: Record<string, unknown>) => 'action' in val);

    // Steps should use the cached screenshot from staging table
    for (const step of stepInserts) {
      expect(step.screenshotBase64).toBe('data:image/png;base64,cached-screenshot');
    }
  });

  it('handles ExecutionResult without accessibilityData', async () => {
    const result = makeRealisticResult();
    delete (result as Partial<ExecutionResult>).accessibilityData;

    await expect(
      activities.persistResults({
        testRunId: 'run-1',
        results: [result],
      }),
    ).resolves.toBeUndefined();

    // No accessibility insert should be attempted
    const valuesCalls = mockChain.values.mock.calls;
    const a11yInserts = valuesCalls
      .map((call: unknown[]) => call[0] as Record<string, unknown>)
      .filter((val: Record<string, unknown>) => 'violationCount' in val);

    expect(a11yInserts).toHaveLength(0);
  });

  it('handles ExecutionResult without videoPath', async () => {
    const result = makeRealisticResult({ videoPath: undefined });

    await expect(
      activities.persistResults({
        testRunId: 'run-1',
        results: [result],
      }),
    ).resolves.toBeUndefined();

    const valuesCalls = mockChain.values.mock.calls;
    const resultInsert = valuesCalls[0]![0] as Record<string, unknown>;
    expect(resultInsert.videoPath).toBeNull();
  });

  it('updateTestRunStatus sets status correctly', async () => {
    await activities.updateTestRunStatus({
      testRunId: 'run-1',
      status: 'failed',
      error: 'Browser crashed',
    });

    expect(mockDb.update).toHaveBeenCalled();
    const setCalls = mockChain.set.mock.calls;
    const failedUpdate = setCalls.find(
      (call: unknown[]) => (call[0] as Record<string, unknown>).status === 'failed',
    );
    expect(failedUpdate).toBeDefined();
    expect((failedUpdate![0] as Record<string, unknown>).error).toBe('Browser crashed');
  });

  it('updateTestRunStatus without error omits error field', async () => {
    await activities.updateTestRunStatus({
      testRunId: 'run-1',
      status: 'executing',
    });

    expect(mockDb.update).toHaveBeenCalled();
    const setCalls = mockChain.set.mock.calls;
    const updateArg = setCalls[0]![0] as Record<string, unknown>;
    expect(updateArg.status).toBe('executing');
    expect('error' in updateArg).toBe(false);
  });
});
