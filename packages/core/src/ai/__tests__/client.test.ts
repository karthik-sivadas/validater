import { vi, describe, it, expect, afterEach } from 'vitest';

// Use vi.hoisted so mock variables are available to hoisted vi.mock calls
const {
  mockAnthropicModel,
  mockAnthropicFn,
  mockCreateAnthropic,
  mockOpenRouterModel,
  mockOpenRouterChat,
  mockCreateOpenRouter,
} = vi.hoisted(() => {
  const mockAnthropicModel = { modelId: 'anthropic-model' };
  const mockAnthropicFn = vi.fn(() => mockAnthropicModel);
  const mockCreateAnthropic = vi.fn(() => mockAnthropicFn);

  const mockOpenRouterModel = { modelId: 'openrouter-model' };
  const mockOpenRouterChat = vi.fn(() => mockOpenRouterModel);
  const mockCreateOpenRouter = vi.fn(() => ({ chat: mockOpenRouterChat }));

  return {
    mockAnthropicModel,
    mockAnthropicFn,
    mockCreateAnthropic,
    mockOpenRouterModel,
    mockOpenRouterChat,
    mockCreateOpenRouter,
  };
});

vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: mockCreateAnthropic,
}));

vi.mock('@openrouter/ai-sdk-provider', () => ({
  createOpenRouter: mockCreateOpenRouter,
}));

import { createAIClient } from '../client.js';

describe('createAIClient', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('uses Anthropic provider when no OPENROUTER_API_KEY', () => {
    vi.stubEnv('OPENROUTER_API_KEY', '');
    const model = createAIClient();
    expect(mockCreateAnthropic).toHaveBeenCalled();
    expect(mockAnthropicFn).toHaveBeenCalledWith('claude-sonnet-4-5');
    expect(model).toBe(mockAnthropicModel);
  });

  it('uses OpenRouter provider when OPENROUTER_API_KEY is set', () => {
    vi.stubEnv('OPENROUTER_API_KEY', 'sk-test-key');
    const model = createAIClient();
    expect(mockCreateOpenRouter).toHaveBeenCalledWith({ apiKey: 'sk-test-key' });
    expect(mockOpenRouterChat).toHaveBeenCalledWith(
      'moonshotai/kimi-k2.5',
      expect.objectContaining({ structuredOutputs: false }),
    );
    expect(model).toBe(mockOpenRouterModel);
  });

  it('uses custom model name when provided', () => {
    vi.stubEnv('OPENROUTER_API_KEY', '');
    createAIClient({ model: 'custom-model' });
    expect(mockAnthropicFn).toHaveBeenCalledWith('custom-model');
  });

  it('uses AI_MODEL env var override with Anthropic', () => {
    vi.stubEnv('OPENROUTER_API_KEY', '');
    vi.stubEnv('AI_MODEL', 'claude-haiku-3-5');
    createAIClient();
    expect(mockAnthropicFn).toHaveBeenCalledWith('claude-haiku-3-5');
  });

  it('uses AI_MODEL env var override with OpenRouter', () => {
    vi.stubEnv('OPENROUTER_API_KEY', 'sk-test');
    vi.stubEnv('AI_MODEL', 'some-other-model');
    createAIClient();
    expect(mockOpenRouterChat).toHaveBeenCalledWith(
      'some-other-model',
      expect.objectContaining({ structuredOutputs: false }),
    );
  });

  it('explicit model option takes precedence over AI_MODEL env var', () => {
    vi.stubEnv('OPENROUTER_API_KEY', '');
    vi.stubEnv('AI_MODEL', 'env-model');
    createAIClient({ model: 'explicit-model' });
    expect(mockAnthropicFn).toHaveBeenCalledWith('explicit-model');
  });
});
