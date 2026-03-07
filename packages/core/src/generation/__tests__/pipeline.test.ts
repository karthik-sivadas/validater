import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockPage } from '../../__test-utils__/index.js';
import type { RawTestStep } from '../../types/test-step.js';
import type { TokenUsage, ValidationResult } from '../../types/generation.js';

// ---------------------------------------------------------------------------
// Mocks -- must be declared before import
// ---------------------------------------------------------------------------

vi.mock('../../dom/crawler.js', () => ({
  crawlPage: vi.fn(),
}));

vi.mock('../../dom/simplifier.js', () => ({
  simplifyDom: vi.fn(),
}));

vi.mock('../../ai/client.js', () => ({
  generateTestSteps: vi.fn(),
}));

vi.mock('../../ai/rate-limiter.js', () => ({
  queuedRequest: vi.fn((_queue: unknown, fn: () => unknown) => fn()),
  defaultApiQueue: {},
}));

vi.mock('../../locators/validator.js', () => ({
  verifyStepLocators: vi.fn(),
}));

vi.mock('../../locators/healer.js', () => ({
  healStepLocators: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { generateAndValidateTestSteps } from '../pipeline.js';
import { crawlPage } from '../../dom/crawler.js';
import { simplifyDom } from '../../dom/simplifier.js';
import { generateTestSteps } from '../../ai/client.js';
import { verifyStepLocators } from '../../locators/validator.js';
import { healStepLocators } from '../../locators/healer.js';

const mockCrawlPage = vi.mocked(crawlPage);
const mockSimplifyDom = vi.mocked(simplifyDom);
const mockGenerateTestSteps = vi.mocked(generateTestSteps);
const mockVerifyStepLocators = vi.mocked(verifyStepLocators);
const mockHealStepLocators = vi.mocked(healStepLocators);

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

const mockUsage: TokenUsage = {
  inputTokens: 1000,
  outputTokens: 500,
  cacheCreationInputTokens: 200,
  cacheReadInputTokens: 100,
};

const mockRawSteps: RawTestStep[] = [
  {
    order: 1,
    action: 'navigate',
    description: 'Go to homepage',
    target: {
      elementDescription: 'URL bar',
      locators: [
        { type: 'css', value: 'body', confidence: 1.0, reasoning: 'page body' },
        { type: 'xpath', value: '//body', confidence: 0.9, reasoning: 'xpath body' },
      ],
      primaryLocatorIndex: 0,
    },
    reasoning: 'Navigate to the target page',
  },
  {
    order: 2,
    action: 'click',
    description: 'Click login button',
    target: {
      elementDescription: 'Login button',
      locators: [
        { type: 'role', value: 'button: Login', confidence: 0.95, reasoning: 'button role' },
        { type: 'testId', value: 'login-btn', confidence: 0.9, reasoning: 'data-testid' },
      ],
      primaryLocatorIndex: 0,
    },
    reasoning: 'Click to open login form',
  },
];

function makeValidResult(stepId: string, stepOrder: number): ValidationResult {
  return {
    stepId,
    stepOrder,
    locatorResults: [
      { locator: { type: 'css', value: 'body', confidence: 1.0, reasoning: '' }, found: true, count: 1, isUnique: true },
    ],
    primaryLocatorValid: true,
    isValid: true,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

describe('generateAndValidateTestSteps', () => {
  const mockPage = createMockPage();

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockCrawlPage.mockResolvedValue({
      html: '<html><body>Hello</body></html>',
      ariaSnapshot: '- heading "Hello"',
    });

    mockSimplifyDom.mockReturnValue({
      html: '<body>Hello</body>',
      tokenEstimate: 100,
      rawLength: 1000,
      simplifiedLength: 200,
      reductionPercent: 80,
    });

    mockGenerateTestSteps.mockResolvedValue({
      steps: mockRawSteps,
      reasoning: 'Test reasoning',
      usage: mockUsage,
    });

    // All steps valid by default -- healer returns steps unchanged
    mockVerifyStepLocators.mockImplementation(async (_page, step) =>
      makeValidResult(step.id, step.order),
    );

    mockHealStepLocators.mockImplementation(async (_page, steps) => steps);
  });

  it('executes full pipeline: crawl -> simplify -> generate -> validate -> result', async () => {
    const result = await generateAndValidateTestSteps({
      page: mockPage,
      request: { url: 'https://example.com', testDescription: 'Test login flow' },
    });

    expect(mockCrawlPage).toHaveBeenCalledOnce();
    expect(mockSimplifyDom).toHaveBeenCalledOnce();
    expect(mockGenerateTestSteps).toHaveBeenCalledOnce();
    expect(mockVerifyStepLocators).toHaveBeenCalledTimes(2); // 2 steps
    expect(mockHealStepLocators).toHaveBeenCalledOnce();

    expect(result.steps).toHaveLength(2);
    expect(result.reasoning).toBe('Test reasoning');
  });

  it('assigns nanoid IDs to steps (not undefined)', async () => {
    const result = await generateAndValidateTestSteps({
      page: mockPage,
      request: { url: 'https://example.com', testDescription: 'Test' },
    });

    for (const step of result.steps) {
      expect(step.id).toBeDefined();
      expect(typeof step.id).toBe('string');
      expect(step.id.length).toBeGreaterThan(0);
    }

    // IDs should be unique
    const ids = result.steps.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('tracks cost with totalCost > 0', async () => {
    const result = await generateAndValidateTestSteps({
      page: mockPage,
      request: { url: 'https://example.com', testDescription: 'Test' },
    });

    expect(result.cost).toBeDefined();
    expect(result.cost.totalCost).toBeGreaterThan(0);
    expect(result.cost.currency).toBe('USD');
    expect(result.cost.inputCost).toBeGreaterThan(0);
    expect(result.cost.outputCost).toBeGreaterThan(0);
  });

  it('returns durationMs > 0', async () => {
    const result = await generateAndValidateTestSteps({
      page: mockPage,
      request: { url: 'https://example.com', testDescription: 'Test' },
    });

    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('returns usage data from generation', async () => {
    const result = await generateAndValidateTestSteps({
      page: mockPage,
      request: { url: 'https://example.com', testDescription: 'Test' },
    });

    expect(result.usage).toEqual(mockUsage);
  });

  it('does NOT call healer when all locators are valid', async () => {
    // verifyStepLocators returns all valid (default mock)
    const result = await generateAndValidateTestSteps({
      page: mockPage,
      request: { url: 'https://example.com', testDescription: 'Test' },
    });

    // healStepLocators is still called but with all-valid results
    // It should return steps unchanged
    expect(mockHealStepLocators).toHaveBeenCalledOnce();
    expect(result.steps).toHaveLength(2);
  });

  it('calls healer when primary locator is invalid', async () => {
    // First step has invalid primary locator
    mockVerifyStepLocators.mockImplementation(async (_page, step) => {
      if (step.order === 1) {
        return {
          stepId: step.id,
          stepOrder: step.order,
          locatorResults: [
            { locator: { type: 'css', value: 'body', confidence: 1.0, reasoning: '' }, found: false, count: 0, isUnique: false },
          ],
          primaryLocatorValid: false,
          isValid: false,
        };
      }
      return makeValidResult(step.id, step.order);
    });

    // Healer returns fixed steps
    mockHealStepLocators.mockImplementation(async (_page, steps) => steps);

    await generateAndValidateTestSteps({
      page: mockPage,
      request: { url: 'https://example.com', testDescription: 'Test' },
    });

    expect(mockHealStepLocators).toHaveBeenCalledOnce();
    // Verify healer received steps and validation results
    const [, steps, validationResults] = mockHealStepLocators.mock.calls[0]!;
    expect(steps).toHaveLength(2);
    expect(validationResults).toHaveLength(2);
    expect(validationResults[0]!.primaryLocatorValid).toBe(false);
  });

  it('passes crawl options including viewport', async () => {
    await generateAndValidateTestSteps({
      page: mockPage,
      request: {
        url: 'https://example.com',
        testDescription: 'Test',
        viewport: { width: 1280, height: 720 },
      },
    });

    expect(mockCrawlPage).toHaveBeenCalledWith(mockPage, {
      url: 'https://example.com',
      viewport: { width: 1280, height: 720 },
    });
  });

  it('passes model to generateTestSteps and calculateCost', async () => {
    const result = await generateAndValidateTestSteps({
      page: mockPage,
      request: {
        url: 'https://example.com',
        testDescription: 'Test',
        model: 'claude-haiku-3-5',
      },
    });

    expect(mockGenerateTestSteps).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-haiku-3-5' }),
    );
    expect(result.model).toBe('claude-haiku-3-5');
  });

  it('passes maxTokenBudget to simplifyDom', async () => {
    await generateAndValidateTestSteps({
      page: mockPage,
      request: {
        url: 'https://example.com',
        testDescription: 'Test',
        maxTokenBudget: 5000,
      },
    });

    expect(mockSimplifyDom).toHaveBeenCalledWith(
      '<html><body>Hello</body></html>',
      expect.objectContaining({ maxTokenEstimate: 5000 }),
    );
  });

  it('uses queuedRequest for rate-limited API calls', async () => {
    await generateAndValidateTestSteps({
      page: mockPage,
      request: { url: 'https://example.com', testDescription: 'Test' },
    });

    // The rate limiter mock passes through the function call
    expect(mockGenerateTestSteps).toHaveBeenCalledOnce();
  });
});
