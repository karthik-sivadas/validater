import type { TestStep, ViewportConfig, ExecutionConfig, ExecutionResult } from '@validater/core';
import { executeSteps } from '@validater/core';
import { getDefaultPool } from '../browser/pool.js';
import type { StreamingConfig } from '../streaming/types.js';
import { startScreencast } from '../streaming/screencast.js';
import { publishFrame, publishStepEvent, publishStreamEnd } from '../streaming/redis-publisher.js';

export interface ExecuteStepsParams {
  url: string;
  steps: TestStep[];
  viewport: ViewportConfig;
  config?: ExecutionConfig;
  streamingConfig?: StreamingConfig;
}

/**
 * Temporal activity: execute test steps in a single viewport.
 *
 * Acquires a pooled browser, creates an isolated BrowserContext with
 * the specified viewport settings, runs all steps via the core execution
 * engine, captures screenshots, and returns a fully serializable
 * ExecutionResult.
 *
 * When streamingConfig.enabled is true, starts CDP screencast to capture
 * browser frames and publishes them to Redis. After execution completes,
 * publishes step events and a stream-end signal.
 *
 * All streaming operations are best-effort -- failures are caught and
 * do not affect test execution.
 *
 * Browser acquire/release and context lifecycle are guaranteed via
 * try/finally -- no leaked resources even on step failure.
 */
export async function executeStepsActivity(params: ExecuteStepsParams): Promise<ExecutionResult> {
  const startTime = new Date().toISOString();
  const pool = getDefaultPool();
  const pooled = await pool.acquire();

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
        waitUntil: 'networkidle',
        timeout: params.config?.navigationTimeoutMs ?? 30_000,
      });

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

      const stepResults = await executeSteps(page, params.steps, params.config);

      // Publish step events to Redis after execution (best-effort)
      if (params.streamingConfig?.enabled) {
        try {
          for (const result of stepResults) {
            await publishStepEvent(params.streamingConfig.testRunId, {
              stepId: result.stepId,
              stepOrder: result.stepOrder,
              status: result.status,
              durationMs: result.durationMs,
              error: result.error?.message,
            });
          }
        } catch {
          // Step event publishing failed -- non-critical
        }
      }

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

      return {
        viewport: params.viewport.name,
        url: params.url,
        stepResults,
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
