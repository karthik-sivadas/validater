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

// Suite generation
export type {
  TestSuiteParams,
  TestSuiteResult,
  SuiteStatus,
  SuitePhase,
} from './workflows/test-suite.workflow.js';
export { getSuiteStatus } from './workflows/test-suite.workflow.js';
export { testSuiteWorkflow } from './workflows/test-suite.workflow.js';

// Report generation
export { generateHtmlReport } from "./reports/html-generator.js";
export type { ReportData, ReportViewport, ReportStep } from "./reports/html-generator.js";
export { generatePdfReport } from "./reports/pdf-generator.js";

// Video storage and processing
export { getVideoPath } from "./video/storage.js";
export { exportVideoWorkflow } from "./workflows/export-video.workflow.js";
export type { ExportVideoParams, ExportVideoResult } from "./activities/export-video.activity.js";
