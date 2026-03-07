import { generateObject, type LanguageModel } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { TestGenerationSchema } from '../schemas/test-step.js';
import { TestSuiteSpecSchema } from '../schemas/test-suite.js';
import type { RawTestStep } from '../types/test-step.js';
import type { TestSuiteSpec } from '../types/test-suite.js';
import type { TokenUsage } from '../types/generation.js';
import { SYSTEM_PROMPT } from './prompts/system.js';
import { buildUserPrompt } from './prompts/templates.js';
import {
  SUITE_GENERATION_SYSTEM_PROMPT,
  buildSuiteUserPrompt,
} from './prompts/suite-generation.js';

/**
 * Create an AI client using either OpenRouter or Anthropic provider.
 *
 * Provider selection:
 * - If OPENROUTER_API_KEY is set → uses OpenRouter (supports any model)
 * - Otherwise falls back to Anthropic (requires ANTHROPIC_API_KEY)
 *
 * Model selection: AI_MODEL env var or defaults per provider.
 */
export function createAIClient(options?: { model?: string }): LanguageModel {
  if (process.env.OPENROUTER_API_KEY) {
    const openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
    });
    const modelName = options?.model ?? process.env.AI_MODEL ?? 'moonshotai/kimi-k2.5';
    return openrouter.chat(modelName, { structuredOutputs: false } as Record<string, unknown>);
  }

  const anthropic = createAnthropic();
  const modelName = options?.model ?? process.env.AI_MODEL ?? 'claude-sonnet-4-5';
  return anthropic(modelName);
}

/**
 * Generate structured test steps from a page DOM and test description.
 *
 * Uses AI SDK's generateObject with a Zod schema to guarantee
 * structured output matching TestGenerationSchema. The system prompt
 * is cached via Anthropic's prompt caching (ephemeral cacheControl)
 * to reduce latency and cost on repeated requests.
 *
 * Returns RawTestStep[] (without id field) -- IDs are assigned
 * downstream by the pipeline using nanoid.
 */
export async function generateTestSteps(params: {
  simplifiedDomHtml: string;
  ariaSnapshot: string;
  testDescription: string;
  model?: string;
}): Promise<{
  steps: RawTestStep[];
  reasoning: string;
  usage: TokenUsage;
}> {
  const model = createAIClient({ model: params.model });

  const userMessage = buildUserPrompt(
    params.simplifiedDomHtml,
    params.ariaSnapshot,
    params.testDescription,
  );

  const isAnthropic = !process.env.OPENROUTER_API_KEY;

  const result = await generateObject({
    model,
    schema: TestGenerationSchema,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: userMessage,
      },
    ],
    ...(isAnthropic
      ? {
          providerOptions: {
            anthropic: {
              cacheControl: { type: 'ephemeral' },
            },
          },
        }
      : {}),
  });

  const usage: TokenUsage = {
    inputTokens: result.usage.inputTokens ?? 0,
    outputTokens: result.usage.outputTokens ?? 0,
    cacheCreationInputTokens:
      result.usage.inputTokenDetails?.cacheWriteTokens ?? 0,
    cacheReadInputTokens:
      result.usage.inputTokenDetails?.cacheReadTokens ?? 0,
  };

  return {
    steps: result.object.steps as RawTestStep[],
    reasoning: result.object.reasoning,
    usage,
  };
}

/**
 * Generate a test suite specification from a feature description and page DOM.
 *
 * Stage 1 of two-stage suite generation: produces 4-8 distinct test case
 * specifications covering happy path, edge cases, error states, and boundary
 * conditions. Each test case description is self-contained and designed to
 * feed directly into generateTestSteps (Stage 2).
 *
 * Uses AI SDK's generateObject with TestSuiteSpecSchema to enforce the
 * structured output constraint (min 4, max 8 test cases).
 */
export async function generateSuiteSpecs(params: {
  featureDescription: string;
  url: string;
  simplifiedDomHtml: string;
  ariaSnapshot: string;
  model?: string;
}): Promise<{
  suiteSpec: TestSuiteSpec;
  usage: TokenUsage;
}> {
  const model = createAIClient({ model: params.model });
  const userMessage = buildSuiteUserPrompt(params);
  const isAnthropic = !process.env.OPENROUTER_API_KEY;

  const result = await generateObject({
    model,
    schema: TestSuiteSpecSchema,
    system: SUITE_GENERATION_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
    ...(isAnthropic
      ? {
          providerOptions: {
            anthropic: {
              cacheControl: { type: 'ephemeral' },
            },
          },
        }
      : {}),
  });

  const usage: TokenUsage = {
    inputTokens: result.usage.inputTokens ?? 0,
    outputTokens: result.usage.outputTokens ?? 0,
    cacheCreationInputTokens:
      result.usage.inputTokenDetails?.cacheWriteTokens ?? 0,
    cacheReadInputTokens:
      result.usage.inputTokenDetails?.cacheReadTokens ?? 0,
  };

  return {
    suiteSpec: result.object as TestSuiteSpec,
    usage,
  };
}
