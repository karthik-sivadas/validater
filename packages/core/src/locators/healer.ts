import type { Page } from 'playwright';
import { generateObject } from 'ai';
import { z } from 'zod';
import type { TestStep, LocatorStrategy } from '../types/index.js';
import type { ValidationResult } from '../types/generation.js';
import { LocatorStrategySchema } from '../schemas/locator.js';
import { createAIClient } from '../ai/client.js';
import { buildValidationPrompt } from '../ai/prompts/templates.js';
import { verifyLocator } from './validator.js';

/**
 * Schema for AI-generated healing locators.
 * Returns an array of alternative LocatorStrategy suggestions.
 */
const HealingResponseSchema = z.object({
  locators: z
    .array(LocatorStrategySchema)
    .min(1)
    .describe('Alternative locator strategies for the target element'),
});

/**
 * Heal a single test step's broken primary locator.
 *
 * Strategy (cheapest first):
 * 1. If primary failed but alternatives succeeded, return the highest-confidence
 *    working alternative. No AI call needed.
 * 2. If ALL locators failed, use Claude to suggest new locators based on the
 *    step description and current page DOM. Verify suggestions against the
 *    live page and return the first working one.
 * 3. Return null if nothing works.
 */
export async function healLocator(
  page: Page,
  step: TestStep,
  validationResult: ValidationResult,
): Promise<LocatorStrategy | null> {
  // Strategy 1: Pick best working alternative (free)
  const workingAlternatives = validationResult.locatorResults
    .filter((r) => r.found && r.isUnique)
    .map((r) => r.locator)
    .sort((a, b) => b.confidence - a.confidence);

  if (workingAlternatives.length > 0) {
    return workingAlternatives[0]!;
  }

  // Also try alternatives that found elements (even if not unique)
  const anyWorking = validationResult.locatorResults
    .filter((r) => r.found)
    .map((r) => r.locator)
    .sort((a, b) => b.confidence - a.confidence);

  if (anyWorking.length > 0) {
    return anyWorking[0]!;
  }

  // Strategy 2: AI-generated healing (expensive, last resort)
  return healWithAI(page, step, validationResult);
}

/**
 * Batch-process multiple steps, healing any with broken primary locators.
 *
 * For each step where primaryLocatorValid is false:
 * - Calls healLocator to find a working locator
 * - If healed: updates the step's primaryLocatorIndex (or adds healed locator)
 * - If not healed: leaves the step unchanged (downstream consumers decide)
 *
 * Returns the updated steps array (new array, original not mutated).
 */
export async function healStepLocators(
  page: Page,
  steps: TestStep[],
  validationResults: ValidationResult[],
): Promise<TestStep[]> {
  const resultMap = new Map(validationResults.map((r) => [r.stepId, r]));

  const healedSteps: TestStep[] = [];

  for (const step of steps) {
    const result = resultMap.get(step.id);

    // No validation result or primary is valid -- keep as-is
    if (!result || result.primaryLocatorValid) {
      healedSteps.push({ ...step });
      continue;
    }

    const healed = await healLocator(page, step, result);

    if (healed) {
      // Check if healed locator is already in the locators array
      const existingIndex = step.target.locators.findIndex(
        (l) => l.type === healed.type && l.value === healed.value,
      );

      if (existingIndex !== -1) {
        // Already exists -- just update primaryLocatorIndex
        healedSteps.push({
          ...step,
          target: {
            ...step.target,
            primaryLocatorIndex: existingIndex,
          },
        });
      } else {
        // New locator from AI -- add to array and point primary to it
        const newLocators = [...step.target.locators, healed];
        healedSteps.push({
          ...step,
          target: {
            ...step.target,
            locators: newLocators,
            primaryLocatorIndex: newLocators.length - 1,
          },
        });
      }
    } else {
      // Could not heal -- keep original step unchanged
      healedSteps.push({ ...step });
    }
  }

  return healedSteps;
}

/**
 * Use Claude to generate alternative locators when all existing ones fail.
 *
 * Gets current page DOM to provide fresh context, asks Claude for new
 * locator strategies, then verifies each suggestion against the live page.
 * Returns the first working suggestion, or null.
 */
async function healWithAI(
  page: Page,
  step: TestStep,
  validationResult: ValidationResult,
): Promise<LocatorStrategy | null> {
  try {
    // Get current page HTML and ARIA snapshot for context
    const [currentDomHtml, currentAriaSnapshot] = await Promise.all([
      page.evaluate(() => document.body.outerHTML),
      page.locator('body').ariaSnapshot(),
    ]);

    // Build list of failed locators with error info
    const failedLocators = validationResult.locatorResults
      .filter((r) => !r.found)
      .map((r) => ({
        type: r.locator.type,
        value: r.locator.value,
        error: `Not found on page (count: ${r.count})`,
      }));

    const prompt = buildValidationPrompt(step, {
      failedLocators,
      currentDomHtml,
      currentAriaSnapshot,
    });

    const model = createAIClient();

    const result = await generateObject({
      model,
      schema: HealingResponseSchema,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    // Verify each suggested locator against the live page
    for (const suggestedLocator of result.object.locators) {
      const verification = await verifyLocator(page, suggestedLocator);
      if (verification.found) {
        return suggestedLocator;
      }
    }

    // None of the AI suggestions worked
    return null;
  } catch {
    // AI healing failed (network, API key, etc.) -- not fatal
    return null;
  }
}
