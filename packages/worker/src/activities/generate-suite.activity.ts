import {
  generateSuiteSpecs,
  queuedRequest,
  defaultApiQueue,
  calculateCost,
} from '@validater/core';
import type { TestSuiteSpec, TokenUsage, CostEstimate } from '@validater/core';

/**
 * Temporal activity: Generate test case specifications from a feature description.
 *
 * Rate-limits AI calls through the shared defaultApiQueue.
 * Returns the AI-generated suite spec with usage and cost data.
 */
export async function generateSuiteSpecsActivity(params: {
  featureDescription: string;
  url: string;
  simplifiedDomHtml: string;
  ariaSnapshot: string;
  model?: string;
}): Promise<{
  suiteSpec: TestSuiteSpec;
  usage: TokenUsage;
  cost: CostEstimate;
}> {
  const result = await queuedRequest(defaultApiQueue, () =>
    generateSuiteSpecs(params),
  );

  const cost = calculateCost(result.usage, params.model);

  return {
    suiteSpec: result.suiteSpec,
    usage: result.usage,
    cost,
  };
}
