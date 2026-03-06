import type { TokenUsage, CostEstimate } from '../types/generation.js';

/**
 * Model pricing in USD per million tokens.
 *
 * Includes separate pricing for cache write and cache read operations
 * to accurately track cost savings from prompt caching.
 */
const MODEL_PRICING: Record<
  string,
  { input: number; output: number; cacheWrite: number; cacheRead: number }
> = {
  'claude-sonnet-4-5': {
    input: 3.0,
    output: 15.0,
    cacheWrite: 3.75,
    cacheRead: 0.3,
  },
  'claude-haiku-3-5': {
    input: 1.0,
    output: 5.0,
    cacheWrite: 1.25,
    cacheRead: 0.1,
  },
};

/**
 * Default pricing used when the model is not found in MODEL_PRICING.
 * Falls back to Sonnet pricing as a conservative default.
 */
const DEFAULT_PRICING = MODEL_PRICING['claude-sonnet-4-5']!;

/**
 * Calculate the cost of a single API request based on token usage.
 *
 * Breaks down cost by token type: input, output, cache write, and cache read.
 * Returns a CostEstimate with individual cost components and total.
 */
export function calculateCost(
  usage: TokenUsage,
  model?: string,
): CostEstimate {
  const pricing = (model && MODEL_PRICING[model]) || DEFAULT_PRICING;
  const perMillion = 1_000_000;

  const inputCost = (usage.inputTokens / perMillion) * pricing.input;
  const outputCost = (usage.outputTokens / perMillion) * pricing.output;
  const cacheWriteCost =
    (usage.cacheCreationInputTokens / perMillion) * pricing.cacheWrite;
  const cacheReadCost =
    (usage.cacheReadInputTokens / perMillion) * pricing.cacheRead;

  return {
    inputCost,
    outputCost,
    cacheWriteCost,
    cacheReadCost,
    totalCost: inputCost + outputCost + cacheWriteCost + cacheReadCost,
    currency: 'USD',
  };
}

/**
 * Entry recorded by the CostTracker for each API request.
 */
interface CostEntry {
  timestamp: Date;
  usage: TokenUsage;
  cost: CostEstimate;
  model: string;
}

/**
 * In-memory tracker for API token usage and cost accumulation.
 *
 * Records each API request's token usage and calculates cost.
 * Provides summary statistics across all tracked requests.
 *
 * This is an in-memory tracker; persistent cost tracking
 * (database storage) is planned for Phase 4/5.
 */
export class CostTracker {
  private entries: CostEntry[] = [];

  /**
   * Record token usage for an API request and return the calculated cost.
   */
  track(usage: TokenUsage, model: string): CostEstimate {
    const cost = calculateCost(usage, model);
    this.entries.push({
      timestamp: new Date(),
      usage,
      cost,
      model,
    });
    return cost;
  }

  /**
   * Get the total cost across all tracked requests.
   */
  getTotalCost(): number {
    return this.entries.reduce((sum, entry) => sum + entry.cost.totalCost, 0);
  }

  /**
   * Get a summary of all tracked usage and costs.
   */
  getUsageSummary(): {
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCacheReads: number;
    totalCacheWrites: number;
    totalCost: number;
    requestCount: number;
  } {
    return {
      totalInputTokens: this.entries.reduce(
        (sum, e) => sum + e.usage.inputTokens,
        0,
      ),
      totalOutputTokens: this.entries.reduce(
        (sum, e) => sum + e.usage.outputTokens,
        0,
      ),
      totalCacheReads: this.entries.reduce(
        (sum, e) => sum + e.usage.cacheReadInputTokens,
        0,
      ),
      totalCacheWrites: this.entries.reduce(
        (sum, e) => sum + e.usage.cacheCreationInputTokens,
        0,
      ),
      totalCost: this.getTotalCost(),
      requestCount: this.entries.length,
    };
  }

  /**
   * Clear all tracked entries.
   */
  reset(): void {
    this.entries = [];
  }
}
