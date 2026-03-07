import { describe, it, expect } from 'vitest';
import { LocatorStrategySchema } from '../locator.js';

describe('LocatorStrategySchema', () => {
  it('parses a valid locator', () => {
    const result = LocatorStrategySchema.parse({
      type: 'css',
      value: '#login-btn',
      confidence: 0.95,
      reasoning: 'Unique ID selector',
    });
    expect(result.type).toBe('css');
    expect(result.value).toBe('#login-btn');
    expect(result.confidence).toBe(0.95);
    expect(result.reasoning).toBe('Unique ID selector');
  });

  it.each(['role', 'text', 'label', 'placeholder', 'testId', 'css', 'xpath'] as const)(
    'accepts locator type "%s"',
    (type) => {
      expect(() =>
        LocatorStrategySchema.parse({
          type,
          value: 'test-value',
          confidence: 0.8,
          reasoning: 'test',
        }),
      ).not.toThrow();
    },
  );

  it('rejects invalid type', () => {
    expect(() =>
      LocatorStrategySchema.parse({
        type: 'invalid',
        value: 'x',
        confidence: 0.5,
        reasoning: 'test',
      }),
    ).toThrow();
  });

  it('rejects confidence below 0', () => {
    expect(() =>
      LocatorStrategySchema.parse({
        type: 'css',
        value: '.btn',
        confidence: -0.1,
        reasoning: 'test',
      }),
    ).toThrow();
  });

  it('rejects confidence above 1', () => {
    expect(() =>
      LocatorStrategySchema.parse({
        type: 'css',
        value: '.btn',
        confidence: 1.1,
        reasoning: 'test',
      }),
    ).toThrow();
  });

  it('accepts confidence at boundaries (0 and 1)', () => {
    expect(() =>
      LocatorStrategySchema.parse({ type: 'css', value: '.btn', confidence: 0, reasoning: 'test' }),
    ).not.toThrow();
    expect(() =>
      LocatorStrategySchema.parse({ type: 'css', value: '.btn', confidence: 1, reasoning: 'test' }),
    ).not.toThrow();
  });

  it('requires reasoning string', () => {
    expect(() =>
      LocatorStrategySchema.parse({ type: 'css', value: '.btn', confidence: 0.5 }),
    ).toThrow();
  });

  it('requires value string', () => {
    expect(() =>
      LocatorStrategySchema.parse({ type: 'css', confidence: 0.5, reasoning: 'test' }),
    ).toThrow();
  });
});
