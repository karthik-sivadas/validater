import type { TestStep, ViewportConfig, ExecutionConfig, ExecutionResult } from '@validater/core';
import { executeSteps } from '@validater/core';
import { getDefaultPool } from '../browser/pool.js';

export interface ExecuteStepsParams {
  url: string;
  steps: TestStep[];
  viewport: ViewportConfig;
  config?: ExecutionConfig;
}

/**
 * Temporal activity: execute test steps in a single viewport.
 *
 * Acquires a pooled browser, creates an isolated BrowserContext with
 * the specified viewport settings, runs all steps via the core execution
 * engine, captures screenshots, and returns a fully serializable
 * ExecutionResult.
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

      const stepResults = await executeSteps(page, params.steps, params.config);

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
