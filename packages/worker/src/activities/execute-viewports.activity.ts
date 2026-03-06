import type { TestStep, ExecutionConfig, ExecutionResult, ViewportConfig } from '@validater/core';
import { VIEWPORT_PRESETS, DEFAULT_VIEWPORTS } from '@validater/core';
import type { ExecuteActivities } from './execute-steps.activity.js';

export interface ExecuteViewportsParams {
  url: string;
  steps: TestStep[];
  /** Viewport names to test (defaults to DEFAULT_VIEWPORTS: desktop, tablet, mobile) */
  viewports?: string[];
  config?: ExecutionConfig;
}

/**
 * DEPRECATED: Superseded by child workflows (viewport-execution.workflow.ts).
 *
 * Factory function for multi-viewport execution activity.
 * Uses dependency injection to receive the executeStepsActivity from the factory.
 *
 * @deprecated Use viewportExecutionWorkflow child workflow pattern instead.
 */
export function createExecuteViewportsActivities(executeActivities: ExecuteActivities) {
  async function executeViewportsActivity(params: ExecuteViewportsParams): Promise<ExecutionResult[]> {
    const viewportNames = params.viewports ?? [...DEFAULT_VIEWPORTS];

    // Resolve viewport names to configs, skipping unknown names
    const resolvedViewports: ViewportConfig[] = [];
    for (const name of viewportNames) {
      const preset = VIEWPORT_PRESETS[name];
      if (preset) {
        resolvedViewports.push(preset);
      } else {
        console.warn(`Unknown viewport name "${name}" -- skipping. Available: ${Object.keys(VIEWPORT_PRESETS).join(', ')}`);
      }
    }

    const results: ExecutionResult[] = [];
    for (const viewport of resolvedViewports) {
      const result = await executeActivities.executeStepsActivity({
        url: params.url,
        steps: params.steps,
        viewport,
        config: params.config,
      });
      results.push(result);
    }

    return results;
  }

  return { executeViewportsActivity };
}
