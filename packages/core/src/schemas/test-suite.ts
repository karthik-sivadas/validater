import { z } from 'zod';

export const TestCaseSpecSchema = z.object({
  name: z
    .string()
    .describe('Short name for this test case (e.g., "Login with valid credentials")'),
  description: z
    .string()
    .describe(
      'Complete natural language test description. Must be self-contained -- usable as a standalone test description without additional context.',
    ),
  category: z
    .enum(['happy_path', 'edge_case', 'error_state', 'boundary'])
    .describe('Test case category for coverage tracking'),
  priority: z
    .enum(['critical', 'high', 'medium', 'low'])
    .describe('Priority based on user impact'),
  reasoning: z
    .string()
    .describe('Why this test case is needed for comprehensive coverage'),
});

export const TestSuiteSpecSchema = z.object({
  testCases: z
    .array(TestCaseSpecSchema)
    .min(4)
    .max(8)
    .describe('4-8 distinct test cases covering different scenarios'),
  reasoning: z
    .string()
    .describe(
      'Overall strategy explaining how these test cases provide comprehensive coverage',
    ),
});
