import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createMockPage } from '@validater/core/__test-utils__';
import type { TestStep } from '../../types/index.js';
import type { StepResult } from '../types.js';

// Mock step-runner
vi.mock('../step-runner.js', () => ({
  executeStep: vi.fn(),
}));

import { executeStep } from '../step-runner.js';
import { executeSteps } from '../step-executor.js';

const mockExecuteStep = vi.mocked(executeStep);

function makeStep(id: string, order: number): TestStep {
  return {
    id,
    order,
    action: 'click',
    description: `Step ${order}`,
    target: {
      elementDescription: 'Element',
      locators: [
        { type: 'css', value: '.el', confidence: 0.9, reasoning: 'test' },
        { type: 'testId', value: 'el', confidence: 0.8, reasoning: 'test' },
      ],
      primaryLocatorIndex: 0,
    },
    reasoning: 'test',
  };
}

function makeResult(stepId: string, order: number, status: 'pass' | 'fail' = 'pass'): StepResult {
  return {
    stepId,
    stepOrder: order,
    action: 'click',
    description: `Step ${order}`,
    status,
    screenshotBase64: 'base64',
    durationMs: 100,
    ...(status === 'fail' ? { error: { message: 'fail' } } : {}),
  };
}

describe('executeSteps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls executeStep for each step in order', async () => {
    const page = createMockPage();
    const steps = [makeStep('s1', 1), makeStep('s2', 2), makeStep('s3', 3)];
    mockExecuteStep
      .mockResolvedValueOnce(makeResult('s1', 1))
      .mockResolvedValueOnce(makeResult('s2', 2))
      .mockResolvedValueOnce(makeResult('s3', 3));

    const results = await executeSteps(page, steps);
    expect(results).toHaveLength(3);
    expect(mockExecuteStep).toHaveBeenCalledTimes(3);
  });

  it('continues executing all steps even after a failure', async () => {
    const page = createMockPage();
    const steps = [makeStep('s1', 1), makeStep('s2', 2), makeStep('s3', 3)];
    mockExecuteStep
      .mockResolvedValueOnce(makeResult('s1', 1))
      .mockResolvedValueOnce(makeResult('s2', 2, 'fail'))
      .mockResolvedValueOnce(makeResult('s3', 3));

    const results = await executeSteps(page, steps);
    expect(results).toHaveLength(3);
    expect(results[1]!.status).toBe('fail');
    expect(results[2]!.status).toBe('pass');
  });

  it('merges default config values', async () => {
    const page = createMockPage();
    const steps = [makeStep('s1', 1)];
    mockExecuteStep.mockResolvedValueOnce(makeResult('s1', 1));

    await executeSteps(page, steps);
    expect(mockExecuteStep).toHaveBeenCalledWith(
      page,
      steps[0],
      expect.objectContaining({
        stepTimeoutMs: 10_000,
        navigationTimeoutMs: 30_000,
        screenshotFullPage: false,
      }),
    );
  });

  it('allows custom config override', async () => {
    const page = createMockPage();
    const steps = [makeStep('s1', 1)];
    mockExecuteStep.mockResolvedValueOnce(makeResult('s1', 1));

    await executeSteps(page, steps, { stepTimeoutMs: 5000, navigationTimeoutMs: 15000 });
    expect(mockExecuteStep).toHaveBeenCalledWith(
      page,
      steps[0],
      expect.objectContaining({
        stepTimeoutMs: 5000,
        navigationTimeoutMs: 15000,
      }),
    );
  });

  it('calls onStepComplete callback after each step', async () => {
    const page = createMockPage();
    const steps = [makeStep('s1', 1), makeStep('s2', 2)];
    const onStepComplete = vi.fn();

    mockExecuteStep
      .mockResolvedValueOnce(makeResult('s1', 1))
      .mockResolvedValueOnce(makeResult('s2', 2));

    await executeSteps(page, steps, { onStepComplete });
    expect(onStepComplete).toHaveBeenCalledTimes(2);
    expect(onStepComplete).toHaveBeenCalledWith(expect.objectContaining({ stepId: 's1' }));
    expect(onStepComplete).toHaveBeenCalledWith(expect.objectContaining({ stepId: 's2' }));
  });

  it('swallows onStepComplete errors without breaking execution', async () => {
    const page = createMockPage();
    const steps = [makeStep('s1', 1), makeStep('s2', 2)];
    const onStepComplete = vi.fn(() => {
      throw new Error('callback error');
    });

    mockExecuteStep
      .mockResolvedValueOnce(makeResult('s1', 1))
      .mockResolvedValueOnce(makeResult('s2', 2));

    const results = await executeSteps(page, steps, { onStepComplete });
    expect(results).toHaveLength(2);
    expect(onStepComplete).toHaveBeenCalledTimes(2);
  });

  it('returns empty results array for empty steps', async () => {
    const page = createMockPage();
    const results = await executeSteps(page, []);
    expect(results).toHaveLength(0);
    expect(mockExecuteStep).not.toHaveBeenCalled();
  });
});
