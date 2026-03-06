import type { Page } from 'playwright';
import type { GenerationRequest, GenerationResult } from '../types/generation.js';
import type { TestStep } from '../types/test-step.js';
import { nanoid } from 'nanoid';
import { crawlPage } from '../dom/crawler.js';
import { simplifyDom } from '../dom/simplifier.js';
import { generateTestSteps } from '../ai/client.js';
import { queuedRequest, defaultApiQueue } from '../ai/rate-limiter.js';
import { calculateCost } from '../ai/cost-tracker.js';
import { verifyStepLocators } from '../locators/validator.js';
import { healStepLocators } from '../locators/healer.js';

/**
 * End-to-end generation pipeline: URL + description in, validated test steps out.
 *
 * Orchestrates the full flow:
 * 1. Crawl: Navigate to URL and extract raw HTML + aria snapshot
 * 2. Simplify: Token-efficient DOM via Cheerio processing
 * 3. Generate: AI-powered test step generation via Claude
 * 4. Assign IDs: RawTestStep -> TestStep with nanoid
 * 5. Validate: Verify locators against the live page
 * 6. Heal: Self-heal any broken locators (cheapest-first strategy)
 * 7. Return: Validated steps with cost tracking and duration
 *
 * The caller manages the browser/page lifecycle -- this function accepts
 * a Playwright Page object (dependency injection).
 */
export async function generateAndValidateTestSteps(params: {
  page: Page;
  request: GenerationRequest;
}): Promise<GenerationResult> {
  const { page, request } = params;
  const startTime = Date.now();

  // 1. Crawl: Navigate and extract raw HTML + aria snapshot
  const crawlResult = await crawlPage(page, {
    url: request.url,
    viewport: request.viewport,
  });

  // 2. Simplify: Token-efficient DOM representation
  const simplified = simplifyDom(crawlResult.html, {
    maxTokenEstimate: request.maxTokenBudget ?? 15000,
    includeAriaSnapshot: crawlResult.ariaSnapshot,
  });

  // 3. Generate: AI-powered test step generation (rate-limited)
  const generationResult = await queuedRequest(defaultApiQueue, () =>
    generateTestSteps({
      simplifiedDomHtml: simplified.html,
      ariaSnapshot: crawlResult.ariaSnapshot,
      testDescription: request.testDescription,
      model: request.model,
    }),
  );

  // 4. Assign IDs: RawTestStep -> TestStep with nanoid
  const steps: TestStep[] = generationResult.steps.map((rawStep) => ({
    ...rawStep,
    id: nanoid(),
  }));

  // 5. Validate: Verify each step's locators against the live page
  const validationResults = await Promise.all(
    steps.map((step) => verifyStepLocators(page, step)),
  );

  // 6. Heal: Self-heal any steps with broken primary locators
  const healedSteps = await healStepLocators(page, steps, validationResults);

  // 7. Calculate cost and return result
  const model = request.model ?? process.env.AI_MODEL ?? 'claude-sonnet-4-5';
  const cost = calculateCost(generationResult.usage, model);
  const durationMs = Date.now() - startTime;

  return {
    steps: healedSteps,
    reasoning: generationResult.reasoning,
    usage: generationResult.usage,
    cost,
    model,
    durationMs,
  };
}
