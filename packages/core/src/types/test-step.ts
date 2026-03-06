export type LocatorType = 'role' | 'text' | 'label' | 'placeholder' | 'testId' | 'css' | 'xpath';

export type TestStepAction = 'click' | 'fill' | 'select' | 'check' | 'navigate' | 'assert' | 'wait' | 'hover';

export type AssertionType = 'visible' | 'hidden' | 'text' | 'value' | 'url' | 'count' | 'attribute';

export interface LocatorStrategy {
  type: LocatorType;
  value: string;
  confidence: number; // 0.0 - 1.0
  reasoning: string;
}

export interface TestStepTarget {
  elementDescription: string;
  locators: LocatorStrategy[];
  primaryLocatorIndex: number;
}

export interface TestStepAssertion {
  type: AssertionType;
  expected: string;
}

export interface TestStep {
  id: string; // nanoid
  order: number;
  action: TestStepAction;
  description: string;
  target: TestStepTarget;
  value?: string; // for fill/select actions
  assertion?: TestStepAssertion;
  reasoning: string;
}

/**
 * RawTestStep is what the AI generates -- a TestStep without the `id` field.
 * IDs are assigned post-generation using nanoid.
 */
export type RawTestStep = Omit<TestStep, 'id'>;
