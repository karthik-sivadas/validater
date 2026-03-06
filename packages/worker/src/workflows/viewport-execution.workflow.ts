import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '../activities/execute-steps.activity.js';
import type { TestStep, ViewportConfig } from '@validater/core';
import type { ExecutionResult } from '@validater/core';

const { executeStepsActivity } = proxyActivities<typeof activities>({
  startToCloseTimeout: '10 minutes',
  heartbeatTimeout: '30s',
  retry: {
    initialInterval: '2s',
    backoffCoefficient: 2,
    maximumInterval: '1m',
    maximumAttempts: 3,
  },
});

export interface ViewportExecutionParams {
  url: string;
  steps: TestStep[];
  viewport: ViewportConfig;
  streamingConfig?: { testRunId: string; enabled: boolean };
}

/**
 * Child workflow: Execute test steps in a single viewport.
 *
 * Each viewport runs in its own child workflow for independent retry
 * and event history isolation. The parent fans out one child per viewport
 * and aggregates the results.
 */
export async function viewportExecutionWorkflow(
  params: ViewportExecutionParams,
): Promise<ExecutionResult> {
  return await executeStepsActivity({
    url: params.url,
    steps: params.steps,
    viewport: params.viewport,
    streamingConfig: params.streamingConfig,
  });
}
