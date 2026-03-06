import type { TestStep, ExecutionConfig, ExecutionResult, ViewportConfig } from '@validater/core';
import { VIEWPORT_PRESETS, DEFAULT_VIEWPORTS } from '@validater/core';
import { executeStepsActivity } from './execute-steps.activity.js';

export interface ExecuteViewportsParams {
  url: string;
  steps: TestStep[];
  /** Viewport names to test (defaults to DEFAULT_VIEWPORTS: desktop, tablet, mobile) */
  viewports?: string[];
  config?: ExecutionConfig;
}

/**
 * Temporal activity: execute test steps across multiple viewports.
 *
 * Resolves viewport names to ViewportConfig objects using VIEWPORT_PRESETS,
 * then runs executeStepsActivity sequentially for each viewport. Sequential
 * execution is intentional -- the browser pool has limited capacity and
 * sequential is safer for memory.
 *
 * Unknown viewport names are skipped with a console.warn.
 *
 * @returns Array of ExecutionResult, one per successfully resolved viewport
 */
export async function executeViewportsActivity(params: ExecuteViewportsParams): Promise<ExecutionResult[]> {
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
    const result = await executeStepsActivity({
      url: params.url,
      steps: params.steps,
      viewport,
      config: params.config,
    });
    results.push(result);
  }

  return results;
}
