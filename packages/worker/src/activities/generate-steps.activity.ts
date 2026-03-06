import {
  generateTestSteps,
  queuedRequest,
  defaultApiQueue,
  calculateCost,
} from '@validater/core';
import type { RawTestStep, TokenUsage, CostEstimate } from '@validater/core';
import { nanoid } from 'nanoid';

/**
 * Temporal activity: Generate structured test steps from simplified DOM context.
 *
 * Rate-limits AI calls through the shared defaultApiQueue. Assigns unique IDs
 * to each generated step (RawTestStep -> TestStep with id).
 */
export async function generateSteps(params: {
  simplifiedDomHtml: string;
  ariaSnapshot: string;
  testDescription: string;
  model?: string;
}): Promise<{
  steps: Array<{ id: string } & RawTestStep>;
  reasoning: string;
  usage: TokenUsage;
  cost: CostEstimate;
}> {
  const result = await queuedRequest(defaultApiQueue, () =>
    generateTestSteps(params),
  );

  // Assign unique IDs to each step (RawTestStep -> TestStep)
  const stepsWithIds = result.steps.map((step) => ({
    ...step,
    id: nanoid(),
  }));

  const cost = calculateCost(result.usage, params.model);

  return {
    steps: stepsWithIds,
    reasoning: result.reasoning,
    usage: result.usage,
    cost,
  };
}
