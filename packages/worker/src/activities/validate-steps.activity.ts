import { chromium } from 'playwright';
import { verifyStepLocators, healStepLocators } from '@validater/core';
import type { TestStep, ValidationResult } from '@validater/core';

/**
 * Temporal activity: Validate and heal test step locators against a live page.
 *
 * Navigates to the target URL, verifies all step locators, and heals any
 * broken primary locators using the cheapest-first strategy.
 * Manages browser lifecycle (launch/close) with a finally block for cleanup.
 * Phase 3 will replace this with browser pool management.
 */
export async function validateSteps(params: {
  url: string;
  steps: TestStep[];
}): Promise<{
  validatedSteps: TestStep[];
  validationResults: ValidationResult[];
}> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(params.url, { waitUntil: 'networkidle', timeout: 30_000 });

    // Validate all steps
    const validationResults: ValidationResult[] = [];
    for (const step of params.steps) {
      const result = await verifyStepLocators(page, step);
      validationResults.push(result);
    }

    // Heal failed steps
    const healedSteps = await healStepLocators(
      page,
      params.steps,
      validationResults,
    );

    return { validatedSteps: healedSteps, validationResults };
  } finally {
    await browser.close();
  }
}
