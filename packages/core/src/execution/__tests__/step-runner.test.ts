import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createMockPage, createMockLocator } from '@validater/core/__test-utils__';
import type { TestStep } from '../../types/index.js';
import type { ExecutionConfig } from '../types.js';

// Mock the mapper module
vi.mock('../../locators/mapper.js', () => ({
  mapLocatorToPlaywright: vi.fn(),
}));

import { mapLocatorToPlaywright } from '../../locators/mapper.js';
import { executeStep, resolveLocator } from '../step-runner.js';

const mockMapLocator = vi.mocked(mapLocatorToPlaywright);

function makeStep(overrides?: Partial<TestStep>): TestStep {
  return {
    id: 'step-1',
    order: 1,
    action: 'click',
    description: 'Click button',
    target: {
      elementDescription: 'Submit button',
      locators: [
        { type: 'css', value: '.btn', confidence: 0.9, reasoning: 'test' },
        { type: 'testId', value: 'submit', confidence: 0.8, reasoning: 'test' },
      ],
      primaryLocatorIndex: 0,
    },
    reasoning: 'test step',
    ...overrides,
  };
}

const defaultConfig: ExecutionConfig = {
  stepTimeoutMs: 10_000,
  navigationTimeoutMs: 30_000,
};

describe('resolveLocator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns primary locator when found', async () => {
    const page = createMockPage();
    const locator = createMockLocator({ count: vi.fn(() => Promise.resolve(1)) });
    mockMapLocator.mockReturnValue(locator);

    const result = await resolveLocator(page, makeStep());
    expect(result).toBe(locator);
    expect(mockMapLocator).toHaveBeenCalledTimes(1);
  });

  it('falls back to alternative locators when primary fails', async () => {
    const page = createMockPage();
    const failLocator = createMockLocator({ count: vi.fn(() => Promise.resolve(0)) });
    const goodLocator = createMockLocator({ count: vi.fn(() => Promise.resolve(1)) });

    mockMapLocator
      .mockReturnValueOnce(failLocator) // primary
      .mockReturnValueOnce(goodLocator); // alternative

    const result = await resolveLocator(page, makeStep());
    expect(result).toBe(goodLocator);
    expect(mockMapLocator).toHaveBeenCalledTimes(2);
  });

  it('throws when all locators fail', async () => {
    const page = createMockPage();
    const failLocator = createMockLocator({ count: vi.fn(() => Promise.resolve(0)) });
    mockMapLocator.mockReturnValue(failLocator);

    await expect(resolveLocator(page, makeStep())).rejects.toThrow('Could not resolve any locator');
  });

  it('handles primary locator throwing an error', async () => {
    const page = createMockPage();
    const throwLocator = createMockLocator({ count: vi.fn(() => Promise.reject(new Error('invalid'))) });
    const goodLocator = createMockLocator({ count: vi.fn(() => Promise.resolve(1)) });

    mockMapLocator
      .mockReturnValueOnce(throwLocator)
      .mockReturnValueOnce(goodLocator);

    const result = await resolveLocator(page, makeStep());
    expect(result).toBe(goodLocator);
  });
});

describe('executeStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles navigate action with page.goto', async () => {
    const page = createMockPage();
    const step = makeStep({ action: 'navigate', value: 'https://example.com' });

    const result = await executeStep(page, step, defaultConfig);
    expect(page.goto).toHaveBeenCalledWith('https://example.com', expect.objectContaining({ waitUntil: 'networkidle' }));
    expect(result.status).toBe('pass');
    expect(result.stepId).toBe('step-1');
  });

  it('handles click action', async () => {
    const page = createMockPage();
    const locator = createMockLocator();
    mockMapLocator.mockReturnValue(locator);

    const step = makeStep({ action: 'click' });
    const result = await executeStep(page, step, defaultConfig);
    expect(locator.click).toHaveBeenCalled();
    expect(result.status).toBe('pass');
  });

  it('handles fill action with value', async () => {
    const page = createMockPage();
    const locator = createMockLocator();
    mockMapLocator.mockReturnValue(locator);

    const step = makeStep({ action: 'fill', value: 'test@email.com' });
    const result = await executeStep(page, step, defaultConfig);
    expect(locator.fill).toHaveBeenCalledWith('test@email.com', expect.any(Object));
    expect(result.status).toBe('pass');
  });

  it('handles hover action', async () => {
    const page = createMockPage();
    const locator = createMockLocator();
    mockMapLocator.mockReturnValue(locator);

    const step = makeStep({ action: 'hover' });
    const result = await executeStep(page, step, defaultConfig);
    expect(locator.hover).toHaveBeenCalled();
    expect(result.status).toBe('pass');
  });

  it('returns fail status when action throws', async () => {
    const page = createMockPage();
    const locator = createMockLocator({
      click: vi.fn(() => Promise.reject(new Error('element detached'))),
    });
    mockMapLocator.mockReturnValue(locator);

    const step = makeStep({ action: 'click' });
    const result = await executeStep(page, step, defaultConfig);
    expect(result.status).toBe('fail');
    expect(result.error?.message).toContain('element detached');
  });

  it('always captures screenshot even on failure', async () => {
    const page = createMockPage();
    const locator = createMockLocator({
      click: vi.fn(() => Promise.reject(new Error('fail'))),
    });
    mockMapLocator.mockReturnValue(locator);

    const step = makeStep({ action: 'click' });
    const result = await executeStep(page, step, defaultConfig);
    expect(page.screenshot).toHaveBeenCalled();
    expect(result.screenshotBase64).toBeDefined();
  });

  it('returns empty screenshot when screenshot fails', async () => {
    const page = createMockPage({
      screenshot: vi.fn(() => Promise.reject(new Error('page crashed'))),
    });
    const locator = createMockLocator();
    mockMapLocator.mockReturnValue(locator);

    const step = makeStep({ action: 'click' });
    const result = await executeStep(page, step, defaultConfig);
    expect(result.screenshotBase64).toBe('');
  });

  it('returns durationMs in result', async () => {
    const page = createMockPage();
    const locator = createMockLocator();
    mockMapLocator.mockReturnValue(locator);

    const step = makeStep({ action: 'click' });
    const result = await executeStep(page, step, defaultConfig);
    expect(typeof result.durationMs).toBe('number');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('includes action and description in result', async () => {
    const page = createMockPage();
    const step = makeStep({ action: 'navigate', value: 'https://test.com' });
    const result = await executeStep(page, step, defaultConfig);
    expect(result.action).toBe('navigate');
    expect(result.description).toBe('Click button');
  });
});
