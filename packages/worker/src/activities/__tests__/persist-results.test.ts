import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createMockDb } from '@validater/core/__test-utils__';

// Mock nanoid
vi.mock('nanoid', () => ({
  nanoid: vi.fn(() => 'mock-id-123'),
}));

// Mock drizzle-orm operators
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => args),
  and: vi.fn((...args: unknown[]) => args),
}));

// Mock @validater/db table imports
vi.mock('@validater/db', () => ({
  testRuns: { id: 'testRuns.id' },
  testRunResults: { id: 'testRunResults.id' },
  testRunSteps: { id: 'testRunSteps.id' },
  stepScreenshots: {
    testRunId: 'stepScreenshots.testRunId',
    viewport: 'stepScreenshots.viewport',
    stepOrder: 'stepScreenshots.stepOrder',
  },
  accessibilityResults: { id: 'accessibilityResults.id' },
}));

import { createPersistActivities } from '../persist-results.activity.js';

describe('createPersistActivities', () => {
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
  });

  it('returns object with persistResults and updateTestRunStatus functions', () => {
    const activities = createPersistActivities(mockDb);
    expect(typeof activities.persistResults).toBe('function');
    expect(typeof activities.updateTestRunStatus).toBe('function');
  });

  describe('persistResults', () => {
    it('inserts results and steps into database', async () => {
      const activities = createPersistActivities(mockDb);
      await activities.persistResults({
        testRunId: 'run-1',
        results: [
          {
            viewport: 'desktop',
            url: 'https://example.com',
            stepResults: [
              {
                stepId: 'step-1',
                stepOrder: 1,
                action: 'click',
                description: 'Click button',
                status: 'pass' as const,
                screenshotBase64: 'base64data',
                durationMs: 100,
              },
            ],
            totalDurationMs: 500,
            startedAt: '2024-01-01T00:00:00Z',
            completedAt: '2024-01-01T00:00:01Z',
          },
        ],
      });

      // Should insert into testRunResults
      expect(mockDb.insert).toHaveBeenCalled();
      // Should also select from stepScreenshots (staging table)
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('cleans up staging table and updates test run status after persistence', async () => {
      const activities = createPersistActivities(mockDb);
      await activities.persistResults({
        testRunId: 'run-1',
        results: [
          {
            viewport: 'desktop',
            url: 'https://example.com',
            stepResults: [],
            totalDurationMs: 0,
            startedAt: '2024-01-01T00:00:00Z',
            completedAt: '2024-01-01T00:00:01Z',
          },
        ],
      });

      // Should call delete (staging cleanup) and update (status)
      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe('updateTestRunStatus', () => {
    it('calls db.update with correct status', async () => {
      const activities = createPersistActivities(mockDb);
      await activities.updateTestRunStatus({
        testRunId: 'run-1',
        status: 'executing',
      });

      expect(mockDb.update).toHaveBeenCalled();
    });

    it('includes error field when provided', async () => {
      const activities = createPersistActivities(mockDb);
      await activities.updateTestRunStatus({
        testRunId: 'run-1',
        status: 'failed',
        error: 'Something went wrong',
      });

      expect(mockDb.update).toHaveBeenCalled();
    });
  });
});
