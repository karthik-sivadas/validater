import type { Database } from '@validater/db';
import { testRuns, testRunResults, testRunSteps, stepScreenshots } from '@validater/db';
import type { ExecutionResult } from '@validater/core';
import { nanoid } from 'nanoid';
import { eq, and } from 'drizzle-orm';

export interface PersistResultsParams {
  testRunId: string;
  results: ExecutionResult[];
}

/**
 * Factory function for persist activities.
 *
 * Uses dependency injection -- the db client is injected at worker setup
 * rather than imported directly. This keeps activities testable and allows
 * the worker registration to control the database connection lifecycle.
 */
export function createPersistActivities(db: Database) {
  async function persistResults(params: PersistResultsParams): Promise<void> {
    for (const result of params.results) {
      const resultId = nanoid();

      await db.insert(testRunResults).values({
        id: resultId,
        testRunId: params.testRunId,
        viewport: result.viewport,
        url: result.url,
        totalDurationMs: result.totalDurationMs,
        startedAt: new Date(result.startedAt),
        completedAt: new Date(result.completedAt),
      });

      for (const stepResult of result.stepResults) {
        // Read screenshot from staging table (side-channel from execute activity)
        const cached = await db
          .select()
          .from(stepScreenshots)
          .where(
            and(
              eq(stepScreenshots.testRunId, params.testRunId),
              eq(stepScreenshots.viewport, result.viewport),
              eq(stepScreenshots.stepOrder, stepResult.stepOrder),
            ),
          )
          .limit(1);

        await db.insert(testRunSteps).values({
          id: nanoid(),
          resultId,
          stepId: stepResult.stepId,
          stepOrder: stepResult.stepOrder,
          action: stepResult.action,
          description: stepResult.description,
          status: stepResult.status,
          errorMessage: stepResult.error?.message,
          errorExpected: stepResult.error?.expected,
          errorActual: stepResult.error?.actual,
          screenshotBase64: cached[0]?.screenshotBase64 ?? stepResult.screenshotBase64 ?? null,
          durationMs: stepResult.durationMs,
        });
      }
    }

    // Clean up staging table after all results persisted
    await db
      .delete(stepScreenshots)
      .where(eq(stepScreenshots.testRunId, params.testRunId));

    // Mark test run as complete after all results persisted
    await db
      .update(testRuns)
      .set({ status: 'complete', completedAt: new Date(), updatedAt: new Date() })
      .where(eq(testRuns.id, params.testRunId));
  }

  async function updateTestRunStatus(params: {
    testRunId: string;
    status: string;
    error?: string;
  }): Promise<void> {
    const setValues: Record<string, unknown> = {
      status: params.status,
      updatedAt: new Date(),
    };
    if (params.error !== undefined) {
      setValues.error = params.error;
    }

    await db
      .update(testRuns)
      .set(setValues)
      .where(eq(testRuns.id, params.testRunId));
  }

  return { persistResults, updateTestRunStatus };
}

export type PersistActivities = ReturnType<typeof createPersistActivities>;
