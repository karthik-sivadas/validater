import type { Page } from 'playwright';
import type { TestStep } from '../types/index.js';
import type { ExecutionConfig, StepResult } from './types.js';
import { executeStep } from './step-runner.js';

/**
 * Execute an array of test steps sequentially against a Playwright Page.
 *
 * Steps are run in order (browser has single page state -- no parallelism).
 * Continues executing ALL remaining steps even after a failure so users
 * can see which steps are independently valid vs cascade failures.
 *
 * @param page - Playwright Page instance (caller manages browser lifecycle)
 * @param steps - Array of TestStep to execute in order
 * @param config - Optional execution configuration (timeouts, screenshot options)
 * @returns Array of StepResult with pass/fail status, screenshots, and timing
 */
export async function executeSteps(
  page: Page,
  steps: TestStep[],
  config?: ExecutionConfig,
): Promise<StepResult[]> {
  const mergedConfig: ExecutionConfig = {
    stepTimeoutMs: 10_000,
    navigationTimeoutMs: 30_000,
    screenshotFullPage: false,
    ...config,
  };

  const results: StepResult[] = [];

  for (const step of steps) {
    const result = await executeStep(page, step, mergedConfig);
    results.push(result);

    // Notify caller of step completion (for real-time streaming)
    if (mergedConfig.onStepComplete) {
      try {
        await mergedConfig.onStepComplete(result);
      } catch {
        // Callback failure must not break execution
      }
    }
    // IMPORTANT: Continue executing ALL remaining steps even after failure.
    // Users need to see which steps are independently valid vs cascade failures.
  }

  return results;
}
