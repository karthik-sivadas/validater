import { verifyStepLocators, healStepLocators } from '@validater/core';
import type { TestStep, ValidationResult } from '@validater/core';
import { getDefaultPool } from '../browser/pool.js';
import { heartbeat } from '@temporalio/activity';

/**
 * Temporal activity: Validate and heal test step locators against a live page.
 *
 * Acquires a pooled browser, creates an isolated BrowserContext, navigates
 * to the target URL, verifies all step locators, and heals any broken
 * primary locators using the cheapest-first strategy.
 *
 * Browser acquire/release and context lifecycle are guaranteed via
 * nested try/finally -- no leaked resources even on validation failure.
 */
export async function validateSteps(params: {
  url: string;
  steps: TestStep[];
}): Promise<{
  validatedSteps: TestStep[];
  validationResults: ValidationResult[];
}> {
  const pool = getDefaultPool();
  const pooled = await pool.acquire();
  heartbeat('browser acquired');

  try {
    const context = await pooled.browser.newContext();
    const page = await context.newPage();
    heartbeat('page created');

    try {
      await page.goto(params.url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      heartbeat('page loaded');

      // Validate all steps
      const validationResults: ValidationResult[] = [];
      for (const step of params.steps) {
        const result = await verifyStepLocators(page, step);
        validationResults.push(result);
        heartbeat(`validated step ${step.id}`);
      }

      // Heal failed steps
      const healedSteps = await healStepLocators(
        page,
        params.steps,
        validationResults,
      );

      return { validatedSteps: healedSteps, validationResults };
    } finally {
      await page.close();
      await context.close();
    }
  } finally {
    pooled.pagesProcessed++;
    await pool.release(pooled);
  }
}
