import { describe, it, expect } from 'vitest';
import { calculateCost, CostTracker } from '../cost-tracker.js';
import type { TokenUsage } from '../../types/generation.js';

function makeUsage(overrides?: Partial<TokenUsage>): TokenUsage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
    ...overrides,
  };
}

describe('calculateCost', () => {
  it('calculates cost for claude-sonnet-4-5 pricing', () => {
    const usage = makeUsage({ inputTokens: 1_000_000, outputTokens: 1_000_000 });
    const cost = calculateCost(usage, 'claude-sonnet-4-5');
    expect(cost.inputCost).toBeCloseTo(3.0);
    expect(cost.outputCost).toBeCloseTo(15.0);
    expect(cost.totalCost).toBeCloseTo(18.0);
    expect(cost.currency).toBe('USD');
  });

  it('calculates cost for claude-haiku-3-5 pricing', () => {
    const usage = makeUsage({ inputTokens: 1_000_000, outputTokens: 1_000_000 });
    const cost = calculateCost(usage, 'claude-haiku-3-5');
    expect(cost.inputCost).toBeCloseTo(1.0);
    expect(cost.outputCost).toBeCloseTo(5.0);
    expect(cost.totalCost).toBeCloseTo(6.0);
  });

  it('uses default pricing for unknown model', () => {
    const usage = makeUsage({ inputTokens: 1_000_000 });
    const cost = calculateCost(usage, 'unknown-model');
    // Default pricing is claude-sonnet-4-5: input = 3.0/M
    expect(cost.inputCost).toBeCloseTo(3.0);
  });

  it('uses default pricing when model is undefined', () => {
    const usage = makeUsage({ inputTokens: 500_000 });
    const cost = calculateCost(usage);
    expect(cost.inputCost).toBeCloseTo(1.5);
  });

  it('handles zero tokens', () => {
    const usage = makeUsage();
    const cost = calculateCost(usage, 'claude-sonnet-4-5');
    expect(cost.inputCost).toBe(0);
    expect(cost.outputCost).toBe(0);
    expect(cost.cacheWriteCost).toBe(0);
    expect(cost.cacheReadCost).toBe(0);
    expect(cost.totalCost).toBe(0);
  });

  it('calculates cache token pricing correctly', () => {
    const usage = makeUsage({
      cacheCreationInputTokens: 1_000_000,
      cacheReadInputTokens: 1_000_000,
    });
    const cost = calculateCost(usage, 'claude-sonnet-4-5');
    expect(cost.cacheWriteCost).toBeCloseTo(3.75);
    expect(cost.cacheReadCost).toBeCloseTo(0.3);
    expect(cost.totalCost).toBeCloseTo(4.05);
  });

  it('computes totalCost as sum of all components', () => {
    const usage = makeUsage({
      inputTokens: 100_000,
      outputTokens: 50_000,
      cacheCreationInputTokens: 200_000,
      cacheReadInputTokens: 300_000,
    });
    const cost = calculateCost(usage, 'claude-sonnet-4-5');
    const expectedTotal =
      cost.inputCost + cost.outputCost + cost.cacheWriteCost + cost.cacheReadCost;
    expect(cost.totalCost).toBeCloseTo(expectedTotal);
  });
});

describe('CostTracker', () => {
  it('tracks a single entry and returns cost', () => {
    const tracker = new CostTracker();
    const usage = makeUsage({ inputTokens: 1000, outputTokens: 500 });
    const cost = tracker.track(usage, 'claude-sonnet-4-5');
    expect(cost.totalCost).toBeGreaterThan(0);
    expect(cost.currency).toBe('USD');
  });

  it('aggregates multiple entries in getUsageSummary', () => {
    const tracker = new CostTracker();
    tracker.track(makeUsage({ inputTokens: 1000, outputTokens: 200 }), 'claude-sonnet-4-5');
    tracker.track(makeUsage({ inputTokens: 3000, outputTokens: 800 }), 'claude-sonnet-4-5');

    const summary = tracker.getUsageSummary();
    expect(summary.totalInputTokens).toBe(4000);
    expect(summary.totalOutputTokens).toBe(1000);
    expect(summary.requestCount).toBe(2);
  });

  it('getTotalCost returns sum of all entries', () => {
    const tracker = new CostTracker();
    const c1 = tracker.track(makeUsage({ inputTokens: 1_000_000 }), 'claude-sonnet-4-5');
    const c2 = tracker.track(makeUsage({ outputTokens: 1_000_000 }), 'claude-sonnet-4-5');
    expect(tracker.getTotalCost()).toBeCloseTo(c1.totalCost + c2.totalCost);
  });

  it('reset clears all entries', () => {
    const tracker = new CostTracker();
    tracker.track(makeUsage({ inputTokens: 5000 }), 'claude-sonnet-4-5');
    tracker.reset();
    const summary = tracker.getUsageSummary();
    expect(summary.requestCount).toBe(0);
    expect(summary.totalInputTokens).toBe(0);
    expect(summary.totalCost).toBe(0);
  });

  it('returns zeroes for empty tracker', () => {
    const tracker = new CostTracker();
    const summary = tracker.getUsageSummary();
    expect(summary.totalInputTokens).toBe(0);
    expect(summary.totalOutputTokens).toBe(0);
    expect(summary.totalCacheReads).toBe(0);
    expect(summary.totalCacheWrites).toBe(0);
    expect(summary.totalCost).toBe(0);
    expect(summary.requestCount).toBe(0);
  });

  it('tracks cache tokens in summary', () => {
    const tracker = new CostTracker();
    tracker.track(
      makeUsage({ cacheCreationInputTokens: 500, cacheReadInputTokens: 1000 }),
      'claude-haiku-3-5',
    );
    const summary = tracker.getUsageSummary();
    expect(summary.totalCacheWrites).toBe(500);
    expect(summary.totalCacheReads).toBe(1000);
  });
});
