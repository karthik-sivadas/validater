import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createMockPage, createMockLocator } from '@validater/core/__test-utils__';
import type { TestStep, LocatorStrategy } from '../../types/index.js';
import type { ValidationResult, LocatorVerification } from '../../types/generation.js';

// Mock dependencies using vi.hoisted
const { mockVerifyLocator, mockGenerateObject, mockCreateAIClient, mockBuildValidationPrompt } = vi.hoisted(() => ({
  mockVerifyLocator: vi.fn(),
  mockGenerateObject: vi.fn(),
  mockCreateAIClient: vi.fn(() => ({ modelId: 'mock' })),
  mockBuildValidationPrompt: vi.fn(() => 'mock prompt'),
}));

vi.mock('../validator.js', () => ({
  verifyLocator: mockVerifyLocator,
}));

vi.mock('../../ai/client.js', () => ({
  createAIClient: mockCreateAIClient,
}));

vi.mock('../../ai/prompts/templates.js', () => ({
  buildValidationPrompt: mockBuildValidationPrompt,
}));

vi.mock('ai', () => ({
  generateObject: mockGenerateObject,
}));

import { healLocator, healStepLocators } from '../healer.js';

function makeLocator(type: LocatorStrategy['type'], value: string, confidence = 0.9): LocatorStrategy {
  return { type, value, confidence, reasoning: 'test' };
}

function makeStep(id = 'step-1', locators?: LocatorStrategy[]): TestStep {
  return {
    id,
    order: 1,
    action: 'click',
    description: 'Click button',
    target: {
      elementDescription: 'Submit button',
      locators: locators || [
        makeLocator('css', '.btn', 0.9),
        makeLocator('testId', 'submit', 0.8),
        makeLocator('text', 'Submit', 0.7),
      ],
      primaryLocatorIndex: 0,
    },
    reasoning: 'test',
  };
}

function makeVerification(locator: LocatorStrategy, found: boolean, isUnique = true, count?: number): LocatorVerification {
  return {
    locator,
    found,
    count: count ?? (found ? 1 : 0),
    isUnique,
  };
}

function makeValidationResult(
  stepId: string,
  locatorResults: LocatorVerification[],
  primaryValid = false,
): ValidationResult {
  return {
    stepId,
    stepOrder: 1,
    locatorResults,
    primaryLocatorValid: primaryValid,
    isValid: locatorResults.some((r) => r.found),
  };
}

describe('healLocator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns highest-confidence working alternative when found and unique (Strategy 1)', async () => {
    const page = createMockPage();
    const step = makeStep();
    const vResult = makeValidationResult('step-1', [
      makeVerification(step.target.locators[0]!, false),
      makeVerification(step.target.locators[1]!, true, true), // found + unique, confidence 0.8
      makeVerification(step.target.locators[2]!, true, true), // found + unique, confidence 0.7
    ]);

    const healed = await healLocator(page, step, vResult);
    expect(healed).toBe(step.target.locators[1]); // highest confidence working
  });

  it('returns found but not-unique locator when no unique alternatives (Strategy 1b)', async () => {
    const page = createMockPage();
    const step = makeStep();
    const vResult = makeValidationResult('step-1', [
      makeVerification(step.target.locators[0]!, false),
      makeVerification(step.target.locators[1]!, true, false, 3), // found, not unique
      makeVerification(step.target.locators[2]!, false),
    ]);

    const healed = await healLocator(page, step, vResult);
    expect(healed).toBe(step.target.locators[1]);
  });

  it('calls AI when all locators failed (Strategy 2)', async () => {
    const page = createMockPage({
      evaluate: vi.fn(() => Promise.resolve('<div>DOM</div>')),
      locator: vi.fn(() => createMockLocator({ ariaSnapshot: vi.fn(() => Promise.resolve('snapshot')) })),
    });
    const step = makeStep();
    const vResult = makeValidationResult('step-1', [
      makeVerification(step.target.locators[0]!, false),
      makeVerification(step.target.locators[1]!, false),
      makeVerification(step.target.locators[2]!, false),
    ]);

    const suggestedLocator = makeLocator('css', '.new-btn', 0.95);
    mockGenerateObject.mockResolvedValue({ object: { locators: [suggestedLocator] } });
    mockVerifyLocator.mockResolvedValue({ locator: suggestedLocator, found: true, count: 1, isUnique: true });

    const healed = await healLocator(page, step, vResult);
    expect(healed).toEqual(suggestedLocator);
    expect(mockGenerateObject).toHaveBeenCalled();
  });

  it('returns null when AI suggestions also fail', async () => {
    const page = createMockPage({
      evaluate: vi.fn(() => Promise.resolve('<div>DOM</div>')),
      locator: vi.fn(() => createMockLocator({ ariaSnapshot: vi.fn(() => Promise.resolve('')) })),
    });
    const step = makeStep();
    const vResult = makeValidationResult('step-1', [
      makeVerification(step.target.locators[0]!, false),
      makeVerification(step.target.locators[1]!, false),
      makeVerification(step.target.locators[2]!, false),
    ]);

    const suggestedLocator = makeLocator('css', '.fail-btn', 0.95);
    mockGenerateObject.mockResolvedValue({ object: { locators: [suggestedLocator] } });
    mockVerifyLocator.mockResolvedValue({ locator: suggestedLocator, found: false, count: 0, isUnique: false });

    const healed = await healLocator(page, step, vResult);
    expect(healed).toBeNull();
  });

  it('returns null when AI call throws (error swallowing)', async () => {
    const page = createMockPage({
      evaluate: vi.fn(() => Promise.resolve('<div>DOM</div>')),
      locator: vi.fn(() => createMockLocator({ ariaSnapshot: vi.fn(() => Promise.resolve('')) })),
    });
    const step = makeStep();
    const vResult = makeValidationResult('step-1', [
      makeVerification(step.target.locators[0]!, false),
      makeVerification(step.target.locators[1]!, false),
      makeVerification(step.target.locators[2]!, false),
    ]);

    mockGenerateObject.mockRejectedValue(new Error('API error'));

    const healed = await healLocator(page, step, vResult);
    expect(healed).toBeNull();
  });
});

describe('healStepLocators', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes through steps with valid primary locators unchanged', async () => {
    const page = createMockPage();
    const step = makeStep('s1');
    const vResult = makeValidationResult('s1', [
      makeVerification(step.target.locators[0]!, true, true),
    ], true);

    const results = await healStepLocators(page, [step], [vResult]);
    expect(results).toHaveLength(1);
    expect(results[0]!.target.primaryLocatorIndex).toBe(0);
  });

  it('passes through steps with no validation result unchanged', async () => {
    const page = createMockPage();
    const step = makeStep('s1');
    // no validation results for this step
    const results = await healStepLocators(page, [step], []);
    expect(results).toHaveLength(1);
    expect(results[0]!.target).toEqual(step.target);
  });

  it('updates primaryLocatorIndex when healed locator already exists', async () => {
    const page = createMockPage();
    const locators = [
      makeLocator('css', '.btn', 0.9),
      makeLocator('testId', 'submit', 0.8),
    ];
    const step = makeStep('s1', locators);
    const vResult = makeValidationResult('s1', [
      makeVerification(locators[0]!, false),
      makeVerification(locators[1]!, true, true),
    ], false);

    const results = await healStepLocators(page, [step], [vResult]);
    expect(results[0]!.target.primaryLocatorIndex).toBe(1);
    expect(results[0]!.target.locators).toHaveLength(2); // no new locator added
  });

  it('appends new locator when healed locator is new from AI', async () => {
    const page = createMockPage({
      evaluate: vi.fn(() => Promise.resolve('<div>DOM</div>')),
      locator: vi.fn(() => createMockLocator({ ariaSnapshot: vi.fn(() => Promise.resolve('')) })),
    });
    const locators = [
      makeLocator('css', '.btn', 0.9),
      makeLocator('testId', 'submit', 0.8),
    ];
    const step = makeStep('s1', locators);
    const vResult = makeValidationResult('s1', [
      makeVerification(locators[0]!, false),
      makeVerification(locators[1]!, false),
    ], false);

    const newLocator = makeLocator('css', '.new-btn', 0.95);
    mockGenerateObject.mockResolvedValue({ object: { locators: [newLocator] } });
    mockVerifyLocator.mockResolvedValue({ locator: newLocator, found: true, count: 1, isUnique: true });

    const results = await healStepLocators(page, [step], [vResult]);
    expect(results[0]!.target.locators).toHaveLength(3);
    expect(results[0]!.target.primaryLocatorIndex).toBe(2);
  });

  it('keeps original step unchanged when healing fails', async () => {
    const page = createMockPage({
      evaluate: vi.fn(() => Promise.resolve('<div>DOM</div>')),
      locator: vi.fn(() => createMockLocator({ ariaSnapshot: vi.fn(() => Promise.resolve('')) })),
    });
    const step = makeStep('s1');
    const vResult = makeValidationResult('s1', [
      makeVerification(step.target.locators[0]!, false),
      makeVerification(step.target.locators[1]!, false),
      makeVerification(step.target.locators[2]!, false),
    ], false);

    mockGenerateObject.mockRejectedValue(new Error('API fail'));

    const results = await healStepLocators(page, [step], [vResult]);
    expect(results[0]!.target.primaryLocatorIndex).toBe(step.target.primaryLocatorIndex);
    expect(results[0]!.target.locators).toHaveLength(step.target.locators.length);
  });

  it('returns new array (does not mutate original)', async () => {
    const page = createMockPage();
    const step = makeStep('s1');
    const vResult = makeValidationResult('s1', [
      makeVerification(step.target.locators[0]!, true, true),
    ], true);

    const original = [step];
    const results = await healStepLocators(page, original, [vResult]);
    expect(results).not.toBe(original);
    expect(results[0]).not.toBe(step);
  });
});
