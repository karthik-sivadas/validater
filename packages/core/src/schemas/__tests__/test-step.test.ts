import { describe, it, expect } from 'vitest';
import { TestStepSchema, TestGenerationSchema, TestStepAssertionSchema } from '../test-step.js';

function validLocator(overrides?: Record<string, unknown>) {
  return {
    type: 'css',
    value: '.btn',
    confidence: 0.9,
    reasoning: 'High specificity CSS selector',
    ...overrides,
  };
}

function validStep(overrides?: Record<string, unknown>) {
  return {
    order: 1,
    action: 'click',
    description: 'Click the submit button',
    target: {
      elementDescription: 'Submit button',
      locators: [validLocator(), validLocator({ type: 'testId', value: 'submit-btn' })],
      primaryLocatorIndex: 0,
    },
    reasoning: 'Submit the form',
    ...overrides,
  };
}

describe('TestStepAssertionSchema', () => {
  it('parses valid assertion', () => {
    const result = TestStepAssertionSchema.parse({ type: 'visible', expected: 'true' });
    expect(result.type).toBe('visible');
    expect(result.expected).toBe('true');
  });

  it.each(['visible', 'hidden', 'text', 'value', 'url', 'count', 'attribute'] as const)(
    'accepts assertion type "%s"',
    (type) => {
      expect(() => TestStepAssertionSchema.parse({ type, expected: 'test' })).not.toThrow();
    },
  );

  it('rejects invalid assertion type', () => {
    expect(() => TestStepAssertionSchema.parse({ type: 'invalid', expected: 'x' })).toThrow();
  });
});

describe('TestStepSchema', () => {
  it('parses a valid step', () => {
    const result = TestStepSchema.parse(validStep());
    expect(result.order).toBe(1);
    expect(result.action).toBe('click');
    expect(result.target.locators).toHaveLength(2);
  });

  it('rejects missing required fields', () => {
    expect(() => TestStepSchema.parse({ order: 1 })).toThrow();
  });

  it('rejects less than 2 locators (min(2) constraint)', () => {
    expect(() =>
      TestStepSchema.parse(
        validStep({
          target: {
            elementDescription: 'btn',
            locators: [validLocator()],
            primaryLocatorIndex: 0,
          },
        }),
      ),
    ).toThrow();
  });

  it.each(['click', 'fill', 'select', 'check', 'navigate', 'assert', 'wait', 'hover'] as const)(
    'accepts action type "%s"',
    (action) => {
      expect(() => TestStepSchema.parse(validStep({ action }))).not.toThrow();
    },
  );

  it('rejects invalid action type', () => {
    expect(() => TestStepSchema.parse(validStep({ action: 'drag' }))).toThrow();
  });

  it('allows optional value field', () => {
    const result = TestStepSchema.parse(validStep({ value: 'hello@test.com' }));
    expect(result.value).toBe('hello@test.com');
  });

  it('allows optional assertion field', () => {
    const result = TestStepSchema.parse(
      validStep({ assertion: { type: 'text', expected: 'Success' } }),
    );
    expect(result.assertion?.type).toBe('text');
  });

  it('parses step without optional fields', () => {
    const step = validStep();
    const result = TestStepSchema.parse(step);
    expect(result.value).toBeUndefined();
    expect(result.assertion).toBeUndefined();
  });
});

describe('TestGenerationSchema', () => {
  it('parses valid generation output', () => {
    const result = TestGenerationSchema.parse({
      steps: [validStep()],
      reasoning: 'Test the login flow',
    });
    expect(result.steps).toHaveLength(1);
    expect(result.reasoning).toBe('Test the login flow');
  });

  it('requires steps array', () => {
    expect(() => TestGenerationSchema.parse({ reasoning: 'no steps' })).toThrow();
  });

  it('requires reasoning string', () => {
    expect(() => TestGenerationSchema.parse({ steps: [validStep()] })).toThrow();
  });
});
