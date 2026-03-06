import { z } from 'zod';

export const LocatorStrategySchema = z.object({
  type: z.enum(['role', 'text', 'label', 'placeholder', 'testId', 'css', 'xpath']),
  value: z.string().describe('The locator value (e.g., role name, text content, CSS selector)'),
  confidence: z.number().min(0).max(1).describe('Confidence 0.0-1.0 that this locator will find the correct element'),
  reasoning: z.string().describe('Why this locator was chosen and its reliability assessment'),
});
