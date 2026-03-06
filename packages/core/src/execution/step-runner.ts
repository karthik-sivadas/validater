import type { Page, Locator } from 'playwright';
import type { TestStep } from '../types/index.js';
import type { ExecutionConfig, StepResult, StepError } from './types.js';
import { mapLocatorToPlaywright } from '../locators/mapper.js';
import { checkAssertion, AssertionError } from './assertions.js';

/**
 * Resolve a Playwright Locator for a test step.
 *
 * Tries the primary locator first. If it fails (not found or invalid selector),
 * falls back to alternatives sorted by confidence descending.
 *
 * Throws if ALL locators fail.
 */
export async function resolveLocator(page: Page, step: TestStep): Promise<Locator> {
  const { locators, primaryLocatorIndex } = step.target;

  // Try primary locator first
  try {
    const pwLocator = mapLocatorToPlaywright(page, locators[primaryLocatorIndex]!);
    const count = await pwLocator.count();
    if (count > 0) {
      return pwLocator;
    }
  } catch {
    // Primary locator failed (invalid selector, etc.) -- try alternatives
  }

  // Sort alternatives by confidence descending, excluding primary
  const alternatives = locators
    .map((loc, idx) => ({ loc, idx }))
    .filter(({ idx }) => idx !== primaryLocatorIndex)
    .sort((a, b) => b.loc.confidence - a.loc.confidence);

  for (const { loc } of alternatives) {
    try {
      const pwLocator = mapLocatorToPlaywright(page, loc);
      const count = await pwLocator.count();
      if (count > 0) {
        return pwLocator;
      }
    } catch {
      // Invalid selector -- continue to next alternative
    }
  }

  // All locators failed
  const triedLocators = locators
    .map((l) => `${l.type}="${l.value}"`)
    .join(', ');
  throw new Error(
    `Could not resolve any locator for step "${step.description}". Tried: ${triedLocators}`,
  );
}

/**
 * Execute a Playwright action on a resolved locator.
 *
 * Maps each TestStepAction to the corresponding Playwright method.
 * Navigate and assert actions are no-ops here (handled by the caller).
 */
export async function executeAction(
  locator: Locator,
  step: TestStep,
  timeout: number,
): Promise<void> {
  switch (step.action) {
    case 'click':
      await locator.click({ timeout });
      break;
    case 'fill':
      await locator.fill(step.value ?? '', { timeout });
      break;
    case 'select':
      await locator.selectOption(step.value ?? '', { timeout });
      break;
    case 'check':
      await locator.check({ timeout });
      break;
    case 'hover':
      await locator.hover({ timeout });
      break;
    case 'wait':
      await locator.waitFor({ state: 'visible', timeout });
      break;
    case 'navigate':
    case 'assert':
      // Handled by executeStep -- no-op here
      break;
  }
}

/**
 * Execute a single test step against a Playwright Page.
 *
 * Handles three step categories:
 * - navigate: page.goto() with networkidle
 * - assert: resolve locator for assertion checking only
 * - action: resolve locator + execute action
 *
 * Always captures a screenshot after execution (even on failure).
 * Returns a StepResult with pass/fail status, error details, screenshot, and timing.
 */
export async function executeStep(
  page: Page,
  step: TestStep,
  config: ExecutionConfig,
): Promise<StepResult> {
  const startTime = Date.now();
  let status: 'pass' | 'fail' = 'pass';
  let error: StepError | undefined;
  let locator: Locator | undefined;

  try {
    if (step.action === 'navigate') {
      // Navigation step: go to the URL
      await page.goto(step.value ?? step.target.elementDescription, {
        waitUntil: 'networkidle',
        timeout: config.navigationTimeoutMs ?? 30_000,
      });
    } else if (step.action !== 'assert') {
      // Action step: resolve locator and execute action
      locator = await resolveLocator(page, step);
      await executeAction(locator, step, config.stepTimeoutMs ?? 10_000);
    } else {
      // Pure assert step: resolve locator for assertion checking
      locator = await resolveLocator(page, step);
    }

    // Check assertion if present
    if (step.assertion) {
      await checkAssertion(page, step, locator);
    }
  } catch (err) {
    status = 'fail';
    const caughtError = err instanceof Error ? err : new Error(String(err));
    error = {
      message: caughtError.message,
    };
    if (caughtError instanceof AssertionError) {
      error.expected = caughtError.expected;
      error.actual = caughtError.actual;
    }
  }

  // Always capture screenshot
  let screenshotBase64 = '';
  try {
    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: config.screenshotFullPage ?? false,
    });
    screenshotBase64 = screenshot.toString('base64');
  } catch {
    // Screenshot failed (page crashed, etc.) -- use empty string
  }

  return {
    stepId: step.id,
    stepOrder: step.order,
    status,
    error,
    screenshotBase64,
    durationMs: Date.now() - startTime,
  };
}
