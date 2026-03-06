// @validater/worker - Temporal worker entry point
// Re-exports for consumer packages (web server functions need client + workflow types)

export { createTemporalClient } from "./client.js";
export type {
  TestRunParams,
  TestRunResult,
  TestRunStatus,
  TestRunPhase,
} from "./workflows/test-run.workflow.js";
export { getTestRunStatus } from "./workflows/test-run.workflow.js";
export { testRunWorkflow } from "./workflows/test-run.workflow.js";
