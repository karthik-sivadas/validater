import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createMockPage, createMockLocator } from '@validater/core/__test-utils__';
import type { TestStep, LocatorStrategy } from '../../types/index.js';

// Mock the mapper module
vi.mock('../mapper.js', () => ({
  mapLocatorToPlaywright: vi.fn(),
}));

import { mapLocatorToPlaywright } from '../mapper.js';
import { verifyLocator, verifyStepLocators } from '../validator.js';

const mockMapLocator = vi.mocked(mapLocatorToPlaywright);

function makeLocator(type: LocatorStrategy['type'], value: string, confidence = 0.9): LocatorStrategy {
  return { type, value, confidence, reasoning: 'test' };
}

function makeStep(): TestStep {
  return {
    id: 'step-1',
    order: 1,
    action: 'click',
    description: 'Click button',
    target: {
      elementDescription: 'Button',
      locators: [
        makeLocator('css', '.btn'),
        makeLocator('testId', 'submit'),
      ],
      primaryLocatorIndex: 0,
    },
    reasoning: 'test',
  };
}

describe('verifyLocator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns found: true when count > 0', async () => {
    const page = createMockPage();
    const locator = createMockLocator({ count: vi.fn(() => Promise.resolve(1)) });
    mockMapLocator.mockReturnValue(locator);

    const result = await verifyLocator(page, makeLocator('css', '.btn'));
    expect(result.found).toBe(true);
    expect(result.count).toBe(1);
    expect(result.isUnique).toBe(true);
  });

  it('returns found: false when count is 0', async () => {
    const page = createMockPage();
    const locator = createMockLocator({ count: vi.fn(() => Promise.resolve(0)) });
    mockMapLocator.mockReturnValue(locator);

    const result = await verifyLocator(page, makeLocator('css', '.missing'));
    expect(result.found).toBe(false);
    expect(result.count).toBe(0);
    expect(result.isUnique).toBe(false);
  });

  it('returns isUnique: false when count > 1', async () => {
    const page = createMockPage();
    const locator = createMockLocator({ count: vi.fn(() => Promise.resolve(3)) });
    mockMapLocator.mockReturnValue(locator);

    const result = await verifyLocator(page, makeLocator('css', 'div'));
    expect(result.found).toBe(true);
    expect(result.count).toBe(3);
    expect(result.isUnique).toBe(false);
  });

  it('returns found: false when mapper throws (invalid selector)', async () => {
    const page = createMockPage();
    mockMapLocator.mockImplementation(() => {
      throw new Error('Invalid selector');
    });

    const result = await verifyLocator(page, makeLocator('css', '[invalid'));
    expect(result.found).toBe(false);
    expect(result.count).toBe(0);
  });

  it('returns the original locator in the result', async () => {
    const page = createMockPage();
    const loc = makeLocator('testId', 'my-id');
    const locator = createMockLocator({ count: vi.fn(() => Promise.resolve(1)) });
    mockMapLocator.mockReturnValue(locator);

    const result = await verifyLocator(page, loc);
    expect(result.locator).toBe(loc);
  });
});

describe('verifyStepLocators', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('verifies all locators for a step', async () => {
    const page = createMockPage();
    const locator = createMockLocator({ count: vi.fn(() => Promise.resolve(1)) });
    mockMapLocator.mockReturnValue(locator);

    const step = makeStep();
    const result = await verifyStepLocators(page, step);
    expect(result.locatorResults).toHaveLength(2);
    expect(result.stepId).toBe('step-1');
    expect(result.stepOrder).toBe(1);
  });

  it('reports primaryLocatorValid when primary is found', async () => {
    const page = createMockPage();
    const locator = createMockLocator({ count: vi.fn(() => Promise.resolve(1)) });
    mockMapLocator.mockReturnValue(locator);

    const result = await verifyStepLocators(page, makeStep());
    expect(result.primaryLocatorValid).toBe(true);
  });

  it('reports primaryLocatorValid: false when primary not found', async () => {
    const page = createMockPage();
    const failLocator = createMockLocator({ count: vi.fn(() => Promise.resolve(0)) });
    const goodLocator = createMockLocator({ count: vi.fn(() => Promise.resolve(1)) });
    mockMapLocator
      .mockReturnValueOnce(failLocator) // primary (index 0)
      .mockReturnValueOnce(goodLocator); // alternative

    const result = await verifyStepLocators(page, makeStep());
    expect(result.primaryLocatorValid).toBe(false);
    expect(result.isValid).toBe(true); // because alternative works
  });

  it('reports isValid: false when no locator found', async () => {
    const page = createMockPage();
    const failLocator = createMockLocator({ count: vi.fn(() => Promise.resolve(0)) });
    mockMapLocator.mockReturnValue(failLocator);

    const result = await verifyStepLocators(page, makeStep());
    expect(result.isValid).toBe(false);
    expect(result.primaryLocatorValid).toBe(false);
  });

  it('reports isValid: true when at least one locator found', async () => {
    const page = createMockPage();
    const failLocator = createMockLocator({ count: vi.fn(() => Promise.resolve(0)) });
    const goodLocator = createMockLocator({ count: vi.fn(() => Promise.resolve(1)) });
    mockMapLocator
      .mockReturnValueOnce(failLocator)
      .mockReturnValueOnce(goodLocator);

    const result = await verifyStepLocators(page, makeStep());
    expect(result.isValid).toBe(true);
  });
});
