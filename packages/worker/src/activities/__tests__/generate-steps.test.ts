import { vi, describe, it, expect, beforeEach } from 'vitest';

// Hoist mock functions for vi.mock
const { mockGenerateTestSteps, mockQueuedRequest, mockDefaultApiQueue, mockCalculateCost } = vi.hoisted(() => ({
  mockGenerateTestSteps: vi.fn(),
  mockQueuedRequest: vi.fn(),
  mockDefaultApiQueue: { add: vi.fn() },
  mockCalculateCost: vi.fn(),
}));

vi.mock('@validater/core', () => ({
  generateTestSteps: mockGenerateTestSteps,
  queuedRequest: mockQueuedRequest,
  defaultApiQueue: mockDefaultApiQueue,
  calculateCost: mockCalculateCost,
}));

let nanoidCounter = 0;
vi.mock('nanoid', () => ({
  nanoid: vi.fn(() => `test-id-${++nanoidCounter}`),
}));

import { generateSteps } from '../generate-steps.activity.js';

describe('generateSteps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nanoidCounter = 0;

    // Default: queuedRequest calls the fn argument and returns its result
    mockQueuedRequest.mockImplementation(
      async (_queue: unknown, fn: () => Promise<unknown>) => fn(),
    );

    mockGenerateTestSteps.mockResolvedValue({
      steps: [
        { order: 1, action: 'navigate', description: 'Go to page', target: { elementDescription: 'URL', locators: [], primaryLocatorIndex: 0 }, reasoning: 'navigate' },
        { order: 2, action: 'click', description: 'Click button', target: { elementDescription: 'Btn', locators: [], primaryLocatorIndex: 0 }, reasoning: 'click' },
      ],
      reasoning: 'Test plan',
      usage: { inputTokens: 1000, outputTokens: 500, cacheCreationInputTokens: 0, cacheReadInputTokens: 0 },
    });

    mockCalculateCost.mockReturnValue({
      inputCost: 0.003,
      outputCost: 0.0075,
      cacheWriteCost: 0,
      cacheReadCost: 0,
      totalCost: 0.0105,
      currency: 'USD',
    });
  });

  it('calls queuedRequest with defaultApiQueue', async () => {
    await generateSteps({
      simplifiedDomHtml: '<div>DOM</div>',
      ariaSnapshot: 'snapshot',
      testDescription: 'Test login',
    });

    expect(mockQueuedRequest).toHaveBeenCalledWith(mockDefaultApiQueue, expect.any(Function));
  });

  it('calls generateTestSteps with correct params', async () => {
    const params = {
      simplifiedDomHtml: '<div>DOM</div>',
      ariaSnapshot: 'snapshot',
      testDescription: 'Test login',
      model: 'custom-model',
    };

    await generateSteps(params);
    expect(mockGenerateTestSteps).toHaveBeenCalledWith(params);
  });

  it('assigns unique nanoid IDs to each step', async () => {
    const result = await generateSteps({
      simplifiedDomHtml: '<div>DOM</div>',
      ariaSnapshot: 'snapshot',
      testDescription: 'Test login',
    });

    expect(result.steps).toHaveLength(2);
    expect(result.steps[0]!.id).toBe('test-id-1');
    expect(result.steps[1]!.id).toBe('test-id-2');
  });

  it('calls calculateCost with usage and model', async () => {
    await generateSteps({
      simplifiedDomHtml: '<div>DOM</div>',
      ariaSnapshot: 'snapshot',
      testDescription: 'Test login',
      model: 'claude-sonnet-4-5',
    });

    expect(mockCalculateCost).toHaveBeenCalledWith(
      expect.objectContaining({ inputTokens: 1000, outputTokens: 500 }),
      'claude-sonnet-4-5',
    );
  });

  it('returns correct shape with steps, reasoning, usage, cost', async () => {
    const result = await generateSteps({
      simplifiedDomHtml: '<div>DOM</div>',
      ariaSnapshot: 'snapshot',
      testDescription: 'Test login',
    });

    expect(result.steps).toHaveLength(2);
    expect(result.reasoning).toBe('Test plan');
    expect(result.usage).toEqual({
      inputTokens: 1000,
      outputTokens: 500,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
    });
    expect(result.cost).toEqual(expect.objectContaining({ totalCost: 0.0105, currency: 'USD' }));
  });

  it('steps have both id and original properties', async () => {
    const result = await generateSteps({
      simplifiedDomHtml: '<div>DOM</div>',
      ariaSnapshot: 'snapshot',
      testDescription: 'Test login',
    });

    const step = result.steps[0]!;
    expect(step.id).toBeDefined();
    expect(step.order).toBe(1);
    expect(step.action).toBe('navigate');
    expect(step.description).toBe('Go to page');
  });
});
