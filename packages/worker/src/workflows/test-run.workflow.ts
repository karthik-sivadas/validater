import {
  proxyActivities,
  defineQuery,
  setHandler,
  executeChild,
} from '@temporalio/workflow';
import type * as crawlActs from '../activities/crawl-dom.activity.js';
import type * as genActs from '../activities/generate-steps.activity.js';
import type * as valActs from '../activities/validate-steps.activity.js';
import type { PersistActivities } from '../activities/persist-results.activity.js';
import type { TestStep, ViewportConfig } from '@validater/core';
import { viewportExecutionWorkflow } from './viewport-execution.workflow.js';
// Re-export so Temporal registers the child workflow in the bundle
export { viewportExecutionWorkflow };

// ---------------------------------------------------------------------------
// Status query (queryable at any point during workflow execution)
// ---------------------------------------------------------------------------

export type TestRunPhase =
  | 'pending'
  | 'crawling'
  | 'generating'
  | 'validating'
  | 'executing'
  | 'persisting'
  | 'complete'
  | 'failed';

export interface TestRunStatus {
  phase: TestRunPhase;
  viewportsComplete: number;
  viewportsTotal: number;
  error?: string;
}

export const getTestRunStatus = defineQuery<TestRunStatus>('getTestRunStatus');

// ---------------------------------------------------------------------------
// Workflow params and result
// ---------------------------------------------------------------------------

export interface TestRunParams {
  testRunId: string;
  url: string;
  testDescription: string;
  viewports: ViewportConfig[];
}

export interface TestRunResult {
  testRunId: string;
  status: 'complete' | 'failed';
  viewportResults: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// Activity proxies with differentiated retry policies
// ---------------------------------------------------------------------------

// Future: Add taskQueue per worker type for queue separation (INFR-03)
// e.g., proxyActivities<typeof crawlActs>({ taskQueue: 'browser-pool', ... })
// e.g., proxyActivities<typeof genActs>({ taskQueue: 'ai-agent', ... })
// Currently all activities use the default 'test-pipeline' queue.

const { crawlDom } = proxyActivities<typeof crawlActs>({
  startToCloseTimeout: '2 minutes',
  heartbeatTimeout: '30s',
  retry: {
    initialInterval: '2s',
    backoffCoefficient: 2,
    maximumInterval: '30s',
    maximumAttempts: 3,
  },
});

const { generateSteps } = proxyActivities<typeof genActs>({
  startToCloseTimeout: '5 minutes',
  retry: {
    initialInterval: '5s',
    backoffCoefficient: 2,
    maximumInterval: '1m',
    maximumAttempts: 3,
  },
});

const { validateSteps } = proxyActivities<typeof valActs>({
  startToCloseTimeout: '3 minutes',
  heartbeatTimeout: '30s',
  retry: {
    initialInterval: '2s',
    backoffCoefficient: 2,
    maximumInterval: '30s',
    maximumAttempts: 3,
  },
});

// Uses PersistActivities type alias (NOT typeof persistActs -- the module
// exports a factory, not the activities directly)
const { persistResults, updateTestRunStatus } = proxyActivities<PersistActivities>({
  startToCloseTimeout: '30s',
  retry: {
    initialInterval: '1s',
    backoffCoefficient: 2,
    maximumInterval: '10s',
    maximumAttempts: 5,
  },
});

// ---------------------------------------------------------------------------
// Parent workflow: orchestrates the full test pipeline
// ---------------------------------------------------------------------------

/**
 * Parent workflow: Orchestrates the full test pipeline.
 *
 * Pipeline stages:
 *   1. crawlDom      -- Crawl the target URL and simplify DOM
 *   2. generateSteps -- AI generates test steps from simplified DOM
 *   3. validateSteps -- Validate and heal locators against live page
 *   4. fan-out       -- Execute steps per viewport in child workflows
 *   5. persist       -- Save all results to the database
 *
 * Status is queryable at any point via the getTestRunStatus query.
 * Each stage updates both the in-memory query state and the database.
 */
export async function testRunWorkflow(params: TestRunParams): Promise<TestRunResult> {
  let status: TestRunStatus = {
    phase: 'pending',
    viewportsComplete: 0,
    viewportsTotal: params.viewports.length,
  };
  setHandler(getTestRunStatus, () => status);

  try {
    // Stage 1: Crawl DOM
    status = { ...status, phase: 'crawling' };
    await updateTestRunStatus({ testRunId: params.testRunId, status: 'crawling' });
    const { crawlResult, simplified } = await crawlDom({ url: params.url });

    // Stage 2: Generate test steps
    status = { ...status, phase: 'generating' };
    await updateTestRunStatus({ testRunId: params.testRunId, status: 'generating' });
    const genResult = await generateSteps({
      simplifiedDomHtml: simplified.html,
      ariaSnapshot: crawlResult.ariaSnapshot ?? '',
      testDescription: params.testDescription,
    });
    // genResult.steps is Array<{ id: string } & RawTestStep> which satisfies TestStep[]
    // (RawTestStep = Omit<TestStep, 'id'>, so { id: string } & Omit<TestStep, 'id'> === TestStep)

    // Stage 3: Validate and heal locators
    status = { ...status, phase: 'validating' };
    await updateTestRunStatus({ testRunId: params.testRunId, status: 'validating' });
    const { validatedSteps } = await validateSteps({
      url: params.url,
      steps: genResult.steps as TestStep[],
    });

    // Stage 4: Fan out to child workflows per viewport
    // Enable streaming only for the first viewport to avoid multiple
    // simultaneous streams overwhelming the client.
    status = { ...status, phase: 'executing' };
    await updateTestRunStatus({ testRunId: params.testRunId, status: 'executing' });
    const viewportResults = await Promise.all(
      params.viewports.map((viewport, index) =>
        executeChild(viewportExecutionWorkflow, {
          args: [{
            url: params.url,
            steps: validatedSteps,
            viewport,
            streamingConfig: {
              testRunId: params.testRunId,
              enabled: index === 0,
            },
          }],
          workflowId: `${params.testRunId}-viewport-${viewport.name}`,
        }),
      ),
    );

    // Stage 5: Persist results
    status = { ...status, phase: 'persisting', viewportsComplete: params.viewports.length };
    await updateTestRunStatus({ testRunId: params.testRunId, status: 'persisting' });
    await persistResults({ testRunId: params.testRunId, results: viewportResults });

    // Complete
    status = { ...status, phase: 'complete' };
    return {
      testRunId: params.testRunId,
      status: 'complete',
      viewportResults: viewportResults.length,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    status = { ...status, phase: 'failed', error: errorMsg };
    await updateTestRunStatus({
      testRunId: params.testRunId,
      status: 'failed',
      error: errorMsg,
    });
    throw err; // Re-throw so Temporal records the failure
  }
}
