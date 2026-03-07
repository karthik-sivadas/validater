import {
  proxyActivities,
  defineQuery,
  setHandler,
} from '@temporalio/workflow';
import type * as crawlActs from '../activities/crawl-dom.activity.js';
import type * as genActs from '../activities/generate-steps.activity.js';
import type * as suiteGenActs from '../activities/generate-suite.activity.js';
import type { PersistSuiteActivities } from '../activities/persist-suite.activity.js';
import type { TestStep } from '@validater/core';

// ---------------------------------------------------------------------------
// Status query (queryable at any point during workflow execution)
// ---------------------------------------------------------------------------

export type SuitePhase =
  | 'pending'
  | 'crawling'
  | 'generating_specs'
  | 'generating_steps'
  | 'persisting'
  | 'complete'
  | 'failed';

export interface SuiteStatus {
  phase: SuitePhase;
  testCasesTotal: number;
  testCasesGenerated: number;
  error?: string;
}

export const getSuiteStatus = defineQuery<SuiteStatus>('getSuiteStatus');

// ---------------------------------------------------------------------------
// Workflow params and result
// ---------------------------------------------------------------------------

export interface TestSuiteParams {
  suiteId: string;
  url: string;
  featureDescription: string;
}

export interface TestSuiteResult {
  suiteId: string;
  status: 'complete' | 'failed';
  testCaseCount: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// Activity proxies with differentiated retry policies
// ---------------------------------------------------------------------------

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

const { generateSuiteSpecsActivity } = proxyActivities<typeof suiteGenActs>({
  startToCloseTimeout: '5 minutes',
  retry: {
    initialInterval: '5s',
    backoffCoefficient: 2,
    maximumInterval: '1m',
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

const { persistSuite, updateSuiteStatus } = proxyActivities<PersistSuiteActivities>({
  startToCloseTimeout: '30s',
  retry: {
    initialInterval: '1s',
    backoffCoefficient: 2,
    maximumInterval: '10s',
    maximumAttempts: 5,
  },
});

// ---------------------------------------------------------------------------
// Test suite generation workflow
// ---------------------------------------------------------------------------

/**
 * Test suite generation workflow.
 *
 * Pipeline:
 *   1. crawlDom      -- Crawl target URL (reuse existing activity)
 *   2. generateSuite -- AI generates test case specifications
 *   3. generateSteps -- For each test case, generate executable steps (reuse existing)
 *   4. persistSuite  -- Save suite + test cases to database
 *
 * DOM is crawled once and shared across all test case step generations.
 * Step generation calls go through the rate limiter queue naturally.
 */
export async function testSuiteWorkflow(params: TestSuiteParams): Promise<TestSuiteResult> {
  let status: SuiteStatus = {
    phase: 'pending',
    testCasesTotal: 0,
    testCasesGenerated: 0,
  };
  setHandler(getSuiteStatus, () => status);

  try {
    // Stage 1: Crawl DOM
    status = { ...status, phase: 'crawling' };
    await updateSuiteStatus({ suiteId: params.suiteId, status: 'generating' });
    const { crawlResult, simplified } = await crawlDom({ url: params.url });

    // Stage 2: Generate test case specifications
    status = { ...status, phase: 'generating_specs' };
    const { suiteSpec } = await generateSuiteSpecsActivity({
      featureDescription: params.featureDescription,
      url: params.url,
      simplifiedDomHtml: simplified.html,
      ariaSnapshot: crawlResult.ariaSnapshot ?? '',
    });

    status = { ...status, testCasesTotal: suiteSpec.testCases.length };

    // Stage 3: Generate steps for each test case
    // Sequential to respect rate limiter (each call queued through defaultApiQueue)
    status = { ...status, phase: 'generating_steps' };
    const testCasesWithSteps = [];
    for (let i = 0; i < suiteSpec.testCases.length; i++) {
      const tc = suiteSpec.testCases[i];
      const genResult = await generateSteps({
        simplifiedDomHtml: simplified.html,
        ariaSnapshot: crawlResult.ariaSnapshot ?? '',
        testDescription: tc.description,
      });

      testCasesWithSteps.push({
        ...tc,
        steps: genResult.steps as TestStep[],
        index: i,
      });

      status = { ...status, testCasesGenerated: i + 1 };
    }

    // Stage 4: Persist suite and test cases
    status = { ...status, phase: 'persisting' };
    await persistSuite({
      suiteId: params.suiteId,
      testCases: testCasesWithSteps,
    });

    // Complete
    status = { ...status, phase: 'complete' };
    return {
      suiteId: params.suiteId,
      status: 'complete',
      testCaseCount: testCasesWithSteps.length,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    status = { ...status, phase: 'failed', error: errorMsg };
    await updateSuiteStatus({
      suiteId: params.suiteId,
      status: 'failed',
    });
    throw err;
  }
}
