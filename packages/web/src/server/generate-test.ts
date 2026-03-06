import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

const GenerateTestInputSchema = z.object({
  url: z.string().url(),
  testDescription: z.string().min(1).max(2000),
  viewport: z
    .object({
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    })
    .optional(),
  model: z.string().optional(),
});

/**
 * User-facing server function: accepts URL + description and returns validated test steps.
 *
 * This is the primary entry point for Phase 2's test generation pipeline (TGEN-01).
 * Manages browser lifecycle (launch/close) and delegates to the core pipeline.
 *
 * Dynamic imports are used for playwright and @validater/core to avoid bundling
 * these server-side dependencies into the client bundle.
 *
 * Callable from any TanStack Start route via:
 *   generateTest({ data: { url: 'https://example.com', testDescription: 'Login test' } })
 */
export const generateTest = createServerFn({ method: 'POST' })
  .inputValidator(GenerateTestInputSchema)
  .handler(async ({ data }) => {
    // Dynamic import to avoid bundling playwright in the client bundle
    const { chromium } = await import('playwright');
    const { generateAndValidateTestSteps } = await import('@validater/core');

    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      const result = await generateAndValidateTestSteps({
        page,
        request: {
          url: data.url,
          testDescription: data.testDescription,
          viewport: data.viewport,
          model: data.model,
        },
      });
      return result;
    } finally {
      await browser.close();
    }
  });
