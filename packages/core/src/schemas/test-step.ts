import { z } from 'zod';
import { LocatorStrategySchema } from './locator.js';

export const TestStepAssertionSchema = z.object({
  type: z.enum(['visible', 'hidden', 'text', 'value', 'url', 'count', 'attribute']),
  expected: z.string(),
});

export const TestStepTargetSchema = z.object({
  elementDescription: z.string().describe('Human-readable description of the target element'),
  locators: z.array(LocatorStrategySchema).min(2).describe('Multiple locator strategies ordered by confidence'),
  primaryLocatorIndex: z.number().describe('Index of the recommended primary locator in the locators array'),
});

export const TestStepSchema = z.object({
  order: z.number().describe('Step execution order starting from 1'),
  action: z.enum(['click', 'fill', 'select', 'check', 'navigate', 'assert', 'wait', 'hover']),
  description: z.string().describe('Human-readable description of what this step does'),
  target: TestStepTargetSchema,
  value: z.string().optional().describe('Input value for fill/select actions'),
  assertion: TestStepAssertionSchema.optional().describe('Expected outcome to verify after this step'),
  reasoning: z.string().describe('Why this step is needed and how it advances the test'),
});

export const TestGenerationSchema = z.object({
  steps: z.array(TestStepSchema).describe('Ordered list of test steps'),
  reasoning: z.string().describe('Overall reasoning about the test approach and strategy'),
});
