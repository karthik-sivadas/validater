import type { TestStep } from './test-step.js';
import type { LocatorStrategy } from './test-step.js';

export interface GenerationRequest {
  url: string;
  testDescription: string;
  viewport?: { width: number; height: number };
  model?: string; // default 'claude-sonnet-4-5'
  maxTokenBudget?: number; // default 15000 for DOM context
}

export interface GenerationResult {
  steps: TestStep[];
  reasoning: string;
  usage: TokenUsage;
  cost: CostEstimate;
  model: string;
  durationMs: number;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
}

export interface CostEstimate {
  inputCost: number;
  outputCost: number;
  cacheWriteCost: number;
  cacheReadCost: number;
  totalCost: number;
  currency: 'USD';
}

export interface ValidationResult {
  stepId: string;
  stepOrder: number;
  locatorResults: LocatorVerification[];
  primaryLocatorValid: boolean;
  healedLocator?: LocatorStrategy;
  isValid: boolean;
}

export interface LocatorVerification {
  locator: LocatorStrategy;
  found: boolean;
  count: number;
  isUnique: boolean;
}
