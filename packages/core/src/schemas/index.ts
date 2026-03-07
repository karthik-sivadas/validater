import { z } from "zod";

// Existing schema
export const appConfigSchema = z.object({
  appName: z.string(),
});

// Phase 2 schemas
export * from './locator.js';
export * from './dom-element.js';
export * from './test-step.js';
export * from './test-suite.js';
