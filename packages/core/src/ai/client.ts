import { generateObject, type LanguageModel } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { TestGenerationSchema } from '../schemas/test-step.js';
import type { RawTestStep } from '../types/test-step.js';
import type { TokenUsage } from '../types/generation.js';
import { SYSTEM_PROMPT } from './prompts/system.js';
import { buildUserPrompt } from './prompts/templates.js';

/**
 * Create an Anthropic AI client with the specified model.
 *
 * The ANTHROPIC_API_KEY is read from the environment automatically
 * by the @ai-sdk/anthropic provider. Never hardcode API keys.
 */
export function createAIClient(options?: { model?: string }): LanguageModel {
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
    providerOptions: {
      anthropic: {
        cacheControl: { type: 'ephemeral' },
      },
    },
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
