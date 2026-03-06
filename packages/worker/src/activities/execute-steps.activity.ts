import type { TestStep, ViewportConfig, ExecutionConfig, ExecutionResult } from '@validater/core';
import { executeSteps } from '@validater/core';
import { getDefaultPool } from '../browser/pool.js';
import type { StreamingConfig } from '../streaming/types.js';
import { startScreencast } from '../streaming/screencast.js';
import { publishFrame, publishStepEvent, publishStreamEnd } from '../streaming/redis-publisher.js';
import { heartbeat } from '@temporalio/activity';
import type { Database } from '@validater/db';
import { stepScreenshots } from '@validater/db';
import { nanoid } from 'nanoid';

export interface ExecuteStepsParams {
  url: string;
  steps: TestStep[];
  viewport: ViewportConfig;
  config?: ExecutionConfig;
  streamingConfig?: StreamingConfig;
}

/**
 * Factory function for execute activities.
 *
 * Uses dependency injection -- the db client is injected at worker setup
 * to persist screenshots to a staging table (bypassing Temporal's 2MB
 * payload limit). This keeps activities testable and allows the worker
 * registration to control the database connection lifecycle.
 *
 * Same pattern as createPersistActivities in persist-results.activity.ts.
 */
export function createExecuteActivities(db: Database) {
  /**
   * Temporal activity: execute test steps in a single viewport.
   *
   * Acquires a pooled browser, creates an isolated BrowserContext with
   * the specified viewport settings, runs all steps via the core execution
   * engine, captures screenshots, and returns a fully serializable
   * ExecutionResult.
   *
   * Screenshots are persisted to the step_screenshots staging table
   * during execution (side-channel, bypasses Temporal payload limit).
   * The persist-results activity reads from this staging table when
   * creating final test_run_steps rows.
   *
   * When streamingConfig.enabled is true, starts CDP screencast to capture
   * browser frames and publishes them to Redis. Step events include
   * action and description for enriched live streaming.
   *
   * All streaming and screenshot-staging operations are best-effort --
   * failures are caught and do not affect test execution.
   *
   * Browser acquire/release and context lifecycle are guaranteed via
   * try/finally -- no leaked resources even on step failure.
   */
  async function executeStepsActivity(params: ExecuteStepsParams): Promise<ExecutionResult> {
    const startTime = new Date().toISOString();
    const pool = getDefaultPool();
    const pooled = await pool.acquire();
    heartbeat('browser acquired');

    try {
      const context = await pooled.browser.newContext({
        viewport: { width: params.viewport.width, height: params.viewport.height },
        deviceScaleFactor: params.viewport.deviceScaleFactor,
        isMobile: params.viewport.isMobile,
        hasTouch: params.viewport.hasTouch,
      });

      try {
        const page = await context.newPage();

        // Navigate to the target URL before executing steps
        await page.goto(params.url, {
          waitUntil: 'domcontentloaded',
          timeout: params.config?.navigationTimeoutMs ?? 30_000,
        });
        heartbeat('page loaded');

        // Start screencast if streaming is enabled (best-effort)
        let stopScreencast: (() => Promise<void>) | null = null;
        if (params.streamingConfig?.enabled) {
          try {
            stopScreencast = await startScreencast(page, (frame) => {
              publishFrame(params.streamingConfig!.testRunId, frame).catch(() => {});
            });
          } catch {
            // Screencast start failed -- continue without streaming
          }
        }

        const stepResults = await executeSteps(page, params.steps, {
          ...params.config,
          // Publish step events in real-time as each step completes (best-effort)
          onStepComplete: async (result) => {
            heartbeat(`step ${result.stepOrder} complete`);

            // Persist screenshot to staging table (side-channel, bypasses Temporal payload)
            if (result.screenshotBase64) {
              try {
                await db.insert(stepScreenshots).values({
                  id: nanoid(),
                  testRunId: params.streamingConfig?.testRunId ?? '',
                  viewport: params.viewport.name,
                  stepOrder: result.stepOrder,
                  screenshotBase64: result.screenshotBase64,
                }).onConflictDoNothing();
              } catch {
                // Screenshot persist failure must not break execution
              }
            }

            if (params.streamingConfig?.enabled) {
              publishStepEvent(params.streamingConfig!.testRunId, {
                stepId: result.stepId,
                stepOrder: result.stepOrder,
                status: result.status,
                action: result.action,
                description: result.description,
                durationMs: result.durationMs,
                error: result.error?.message,
              }).catch(() => {});
            }
          },
        });

        // Stop screencast (best-effort)
        if (stopScreencast) {
          try {
            await stopScreencast();
          } catch {
            // Screencast stop failed -- non-critical
          }
        }

        // Signal stream end (best-effort)
        if (params.streamingConfig?.enabled) {
          try {
            await publishStreamEnd(params.streamingConfig.testRunId);
          } catch {
            // Stream end signal failed -- non-critical
          }
        }

        // Strip screenshotBase64 from results to stay within Temporal's
        // gRPC payload size limit (~2MB). Screenshots are already persisted
        // to the staging table above.
        const lightResults = stepResults.map(({ screenshotBase64, ...rest }) => ({
          ...rest,
          screenshotBase64: '',
        }));

        return {
          viewport: params.viewport.name,
          url: params.url,
          stepResults: lightResults,
          totalDurationMs: stepResults.reduce((sum, r) => sum + r.durationMs, 0),
          startedAt: startTime,
          completedAt: new Date().toISOString(),
        };
      } finally {
        await context.close();
      }
    } finally {
      pooled.pagesProcessed++;
      await pool.release(pooled);
    }
  }

  return { executeStepsActivity };
}

export type ExecuteActivities = ReturnType<typeof createExecuteActivities>;
