import { describe, it, expect } from 'vitest';
import { TestCaseSpecSchema, TestSuiteSpecSchema } from '../test-suite.js';

function validTestCase(overrides?: Record<string, unknown>) {
  return {
    name: 'Login with valid credentials',
    description: 'Navigate to login page, enter valid email and password, click submit, verify dashboard appears',
    category: 'happy_path',
    priority: 'critical',
    reasoning: 'Core user flow must work',
    ...overrides,
  };
}

describe('TestCaseSpecSchema', () => {
  it('parses a valid test case', () => {
    const result = TestCaseSpecSchema.parse(validTestCase());
    expect(result.name).toBe('Login with valid credentials');
    expect(result.category).toBe('happy_path');
    expect(result.priority).toBe('critical');
  });

  it.each(['happy_path', 'edge_case', 'error_state', 'boundary'] as const)(
    'accepts category "%s"',
    (category) => {
      expect(() => TestCaseSpecSchema.parse(validTestCase({ category }))).not.toThrow();
    },
  );

  it.each(['critical', 'high', 'medium', 'low'] as const)(
    'accepts priority "%s"',
    (priority) => {
      expect(() => TestCaseSpecSchema.parse(validTestCase({ priority }))).not.toThrow();
    },
  );

  it('rejects invalid category', () => {
    expect(() => TestCaseSpecSchema.parse(validTestCase({ category: 'smoke' }))).toThrow();
  });

  it('rejects invalid priority', () => {
    expect(() => TestCaseSpecSchema.parse(validTestCase({ priority: 'urgent' }))).toThrow();
  });

  it('requires all fields', () => {
    expect(() => TestCaseSpecSchema.parse({ name: 'test' })).toThrow();
  });
});

describe('TestSuiteSpecSchema', () => {
  it('parses valid suite with 4 test cases (min)', () => {
    const result = TestSuiteSpecSchema.parse({
      testCases: [
        validTestCase({ category: 'happy_path' }),
        validTestCase({ category: 'edge_case', name: 'Edge 1' }),
        validTestCase({ category: 'error_state', name: 'Error 1' }),
        validTestCase({ category: 'boundary', name: 'Boundary 1' }),
      ],
      reasoning: 'Comprehensive coverage',
    });
    expect(result.testCases).toHaveLength(4);
    expect(result.reasoning).toBe('Comprehensive coverage');
  });

  it('accepts 8 test cases (max)', () => {
    const cases = Array.from({ length: 8 }, (_, i) =>
      validTestCase({ name: `Test ${i}` }),
    );
    expect(() =>
      TestSuiteSpecSchema.parse({ testCases: cases, reasoning: 'Full coverage' }),
    ).not.toThrow();
  });

  it('rejects fewer than 4 test cases', () => {
    expect(() =>
      TestSuiteSpecSchema.parse({
        testCases: [validTestCase(), validTestCase({ name: 'b' }), validTestCase({ name: 'c' })],
        reasoning: 'not enough',
      }),
    ).toThrow();
  });

  it('rejects more than 8 test cases', () => {
    const cases = Array.from({ length: 9 }, (_, i) =>
      validTestCase({ name: `Test ${i}` }),
    );
    expect(() =>
      TestSuiteSpecSchema.parse({ testCases: cases, reasoning: 'too many' }),
    ).toThrow();
  });

  it('requires reasoning field', () => {
    const cases = Array.from({ length: 4 }, (_, i) =>
      validTestCase({ name: `Test ${i}` }),
    );
    expect(() => TestSuiteSpecSchema.parse({ testCases: cases })).toThrow();
  });
});
