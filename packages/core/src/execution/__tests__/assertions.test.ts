import { vi, describe, it, expect } from 'vitest';
import { createMockPage, createMockLocator } from '@validater/core/__test-utils__';
import { checkAssertion, AssertionError } from '../assertions.js';
import type { TestStep } from '../../types/index.js';

function makeStep(assertion?: { type: string; expected: string }): TestStep {
  return {
    id: 'step-1',
    order: 1,
    action: 'click',
    description: 'Test step',
    target: {
      elementDescription: 'Button',
      locators: [
        { type: 'css', value: '.btn', confidence: 0.9, reasoning: 'test' },
        { type: 'testId', value: 'btn', confidence: 0.8, reasoning: 'test' },
      ],
      primaryLocatorIndex: 0,
    },
    reasoning: 'test',
    assertion: assertion as TestStep['assertion'],
  };
}

describe('AssertionError', () => {
  it('has assertionType, expected, and actual properties', () => {
    const err = new AssertionError('text', 'Hello', 'World');
    expect(err.assertionType).toBe('text');
    expect(err.expected).toBe('Hello');
    expect(err.actual).toBe('World');
    expect(err.name).toBe('AssertionError');
    expect(err.message).toContain('text');
    expect(err.message).toContain('Hello');
    expect(err.message).toContain('World');
  });

  it('is an instance of Error', () => {
    const err = new AssertionError('url', 'a', 'b');
    expect(err).toBeInstanceOf(Error);
  });
});

describe('checkAssertion', () => {
  it('does nothing when step has no assertion', async () => {
    const page = createMockPage();
    const step = makeStep();
    await expect(checkAssertion(page, step)).resolves.toBeUndefined();
  });

  describe('visible assertion', () => {
    it('passes when locator is visible', async () => {
      const page = createMockPage();
      const locator = createMockLocator({ isVisible: vi.fn(() => Promise.resolve(true)) });
      const step = makeStep({ type: 'visible', expected: 'true' });
      await expect(checkAssertion(page, step, locator)).resolves.toBeUndefined();
    });

    it('throws AssertionError when not visible', async () => {
      const page = createMockPage();
      const locator = createMockLocator({ isVisible: vi.fn(() => Promise.resolve(false)) });
      const step = makeStep({ type: 'visible', expected: 'true' });
      await expect(checkAssertion(page, step, locator)).rejects.toThrow(AssertionError);
    });
  });

  describe('hidden assertion', () => {
    it('passes when locator is hidden', async () => {
      const page = createMockPage();
      const locator = createMockLocator({ isHidden: vi.fn(() => Promise.resolve(true)) });
      const step = makeStep({ type: 'hidden', expected: 'true' });
      await expect(checkAssertion(page, step, locator)).resolves.toBeUndefined();
    });

    it('throws AssertionError when not hidden', async () => {
      const page = createMockPage();
      const locator = createMockLocator({ isHidden: vi.fn(() => Promise.resolve(false)) });
      const step = makeStep({ type: 'hidden', expected: 'true' });
      await expect(checkAssertion(page, step, locator)).rejects.toThrow(AssertionError);
    });
  });

  describe('text assertion', () => {
    it('passes when text content includes expected', async () => {
      const page = createMockPage();
      const locator = createMockLocator({ textContent: vi.fn(() => Promise.resolve('Hello World')) });
      const step = makeStep({ type: 'text', expected: 'Hello' });
      await expect(checkAssertion(page, step, locator)).resolves.toBeUndefined();
    });

    it('throws when text does not include expected', async () => {
      const page = createMockPage();
      const locator = createMockLocator({ textContent: vi.fn(() => Promise.resolve('Goodbye')) });
      const step = makeStep({ type: 'text', expected: 'Hello' });
      await expect(checkAssertion(page, step, locator)).rejects.toThrow(AssertionError);
    });
  });

  describe('value assertion', () => {
    it('passes when inputValue matches expected', async () => {
      const page = createMockPage();
      const locator = createMockLocator({ inputValue: vi.fn(() => Promise.resolve('test@email.com')) });
      const step = makeStep({ type: 'value', expected: 'test@email.com' });
      await expect(checkAssertion(page, step, locator)).resolves.toBeUndefined();
    });

    it('throws when inputValue does not match', async () => {
      const page = createMockPage();
      const locator = createMockLocator({ inputValue: vi.fn(() => Promise.resolve('wrong')) });
      const step = makeStep({ type: 'value', expected: 'expected' });
      await expect(checkAssertion(page, step, locator)).rejects.toThrow(AssertionError);
    });
  });

  describe('url assertion', () => {
    it('passes when page URL includes expected', async () => {
      const page = createMockPage({ url: vi.fn(() => 'https://example.com/dashboard') });
      const step = makeStep({ type: 'url', expected: '/dashboard' });
      await expect(checkAssertion(page, step)).resolves.toBeUndefined();
    });

    it('throws when page URL does not include expected', async () => {
      const page = createMockPage({ url: vi.fn(() => 'https://example.com/login') });
      const step = makeStep({ type: 'url', expected: '/dashboard' });
      await expect(checkAssertion(page, step)).rejects.toThrow(AssertionError);
    });

    it('does not require a locator for url assertion', async () => {
      const page = createMockPage({ url: vi.fn(() => 'https://example.com/home') });
      const step = makeStep({ type: 'url', expected: '/home' });
      // no locator passed
      await expect(checkAssertion(page, step)).resolves.toBeUndefined();
    });
  });

  describe('count assertion', () => {
    it('passes when count matches expected number', async () => {
      const page = createMockPage();
      const locator = createMockLocator({ count: vi.fn(() => Promise.resolve(3)) });
      const step = makeStep({ type: 'count', expected: '3' });
      await expect(checkAssertion(page, step, locator)).resolves.toBeUndefined();
    });

    it('throws when count does not match', async () => {
      const page = createMockPage();
      const locator = createMockLocator({ count: vi.fn(() => Promise.resolve(1)) });
      const step = makeStep({ type: 'count', expected: '5' });
      await expect(checkAssertion(page, step, locator)).rejects.toThrow(AssertionError);
    });
  });

  describe('attribute assertion', () => {
    it('passes when attribute matches expected', async () => {
      const page = createMockPage();
      const locator = createMockLocator({ getAttribute: vi.fn(() => Promise.resolve('true')) });
      const step = makeStep({ type: 'attribute', expected: 'disabled=true' });
      await expect(checkAssertion(page, step, locator)).resolves.toBeUndefined();
    });

    it('throws when attribute does not match', async () => {
      const page = createMockPage();
      const locator = createMockLocator({ getAttribute: vi.fn(() => Promise.resolve('false')) });
      const step = makeStep({ type: 'attribute', expected: 'disabled=true' });
      await expect(checkAssertion(page, step, locator)).rejects.toThrow(AssertionError);
    });

    it('throws on invalid attribute format (no equals sign)', async () => {
      const page = createMockPage();
      const locator = createMockLocator();
      const step = makeStep({ type: 'attribute', expected: 'invalid-format' });
      await expect(checkAssertion(page, step, locator)).rejects.toThrow('Invalid attribute assertion format');
    });
  });

  it('throws when locator-level assertion has no locator', async () => {
    const page = createMockPage();
    const step = makeStep({ type: 'visible', expected: 'true' });
    await expect(checkAssertion(page, step)).rejects.toThrow('requires a locator');
  });
});
