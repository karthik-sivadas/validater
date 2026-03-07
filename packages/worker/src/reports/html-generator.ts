import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReportStep {
  stepOrder: number;
  action: string | null;
  description: string | null;
  status: string;
  durationMs: number;
  errorMessage: string | null;
  errorExpected: string | null;
  errorActual: string | null;
  screenshotBase64: string | null;
}

export interface ReportViewport {
  viewport: string;
  totalDurationMs: number;
  steps: ReportStep[];
}

export interface ReportData {
  testRunId: string;
  url: string;
  testDescription: string;
  createdAt: string;
  completedAt: string | null;
  status: string;
  viewportResults: ReportViewport[];
}

// ---------------------------------------------------------------------------
// Action color CSS class mapping
// ---------------------------------------------------------------------------

const ACTION_CSS_CLASS: Record<string, string> = {
  click: "action-click",
  fill: "action-fill",
  assert: "action-assert",
  navigate: "action-navigate",
  select: "action-select",
  check: "action-check",
  hover: "action-hover",
  wait: "action-wait",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function statusCssClass(status: string): string {
  if (status === "complete") return "status-complete";
  if (status === "failed") return "status-failed";
  return "status-other";
}

function formatDuration(ms: number): string {
  return (ms / 1000).toFixed(1) + "s";
}

// ---------------------------------------------------------------------------
// Build step card HTML
// ---------------------------------------------------------------------------

function buildStepCardHtml(step: ReportStep): string {
  const actionBadge = step.action
    ? `<span class="action-badge ${ACTION_CSS_CLASS[step.action] ?? "action-default"}">${escapeHtml(step.action)}</span>`
    : "";

  const statusBadge = `<span class="status-badge ${step.status === "pass" ? "status-pass" : "status-fail"}">${escapeHtml(step.status)}</span>`;

  const description = step.description
    ? `<div class="step-description">${escapeHtml(step.description)}</div>`
    : "";

  let errorBlock = "";
  if (step.status !== "pass" && step.errorMessage) {
    let diffHtml = "";
    if (step.errorExpected || step.errorActual) {
      const parts: string[] = [];
      if (step.errorExpected) {
        parts.push(`<span>Expected: </span>${escapeHtml(step.errorExpected)}`);
      }
      if (step.errorActual) {
        parts.push(`<span>Actual: </span>${escapeHtml(step.errorActual)}`);
      }
      diffHtml = `<div class="error-diff">${parts.join("<br/>")}</div>`;
    }
    errorBlock = `
      <div class="error-block">
        <div class="error-message">${escapeHtml(step.errorMessage)}</div>
        ${diffHtml}
      </div>`;
  }

  const screenshot = step.screenshotBase64
    ? `<img class="step-screenshot" src="data:image/png;base64,${step.screenshotBase64}" alt="Step ${step.stepOrder} screenshot" />`
    : "";

  return `
    <div class="step-card">
      <div class="step-header">
        <span class="step-order">Step ${step.stepOrder}</span>
        ${actionBadge}
        ${statusBadge}
        <span class="step-duration">${step.durationMs}ms</span>
      </div>
      ${description}
      ${errorBlock}
      ${screenshot}
    </div>`;
}

// ---------------------------------------------------------------------------
// Build viewport section HTML
// ---------------------------------------------------------------------------

function buildViewportSectionHtml(vp: ReportViewport): string {
  const stepsHtml = vp.steps
    .sort((a, b) => a.stepOrder - b.stepOrder)
    .map(buildStepCardHtml)
    .join("\n");

  return `
    <div class="viewport-section">
      <div class="viewport-header">
        <h2>${escapeHtml(vp.viewport)}</h2>
        <span class="viewport-meta">${vp.steps.length} steps &middot; ${formatDuration(vp.totalDurationMs)}</span>
      </div>
      ${stepsHtml}
    </div>`;
}

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

export async function generateHtmlReport(data: ReportData): Promise<string> {
  // Read template from disk
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const templatePath = join(currentDir, "templates", "report.html");
  let html = await readFile(templatePath, "utf-8");

  // Compute summary stats
  const allSteps = data.viewportResults.flatMap((vp) => vp.steps);
  const totalSteps = allSteps.length;
  const passedSteps = allSteps.filter((s) => s.status === "pass").length;
  const failedSteps = totalSteps - passedSteps;
  const passRate = totalSteps > 0 ? Math.round((passedSteps / totalSteps) * 100) : 0;

  // Replace basic placeholders
  html = html.replace(/\{\{testRunId\}\}/g, escapeHtml(data.testRunId));
  html = html.replace(/\{\{url\}\}/g, escapeHtml(data.url));
  html = html.replace(/\{\{testDescription\}\}/g, escapeHtml(data.testDescription));
  html = html.replace(/\{\{createdAt\}\}/g, escapeHtml(data.createdAt));
  html = html.replace(/\{\{status\}\}/g, escapeHtml(data.status));
  html = html.replace(/\{\{statusClass\}\}/g, statusCssClass(data.status));

  // Completed at block (optional)
  const completedAtBlock = data.completedAt
    ? `<span><strong>Completed:</strong> ${escapeHtml(data.completedAt)}</span>`
    : "";
  html = html.replace(/\{\{completedAtBlock\}\}/g, completedAtBlock);

  // Summary stats
  html = html.replace(/\{\{totalSteps\}\}/g, String(totalSteps));
  html = html.replace(/\{\{passedSteps\}\}/g, String(passedSteps));
  html = html.replace(/\{\{failedSteps\}\}/g, String(failedSteps));
  html = html.replace(/\{\{passRate\}\}/g, String(passRate));

  // Viewport sections
  const viewportSectionsHtml = data.viewportResults
    .map(buildViewportSectionHtml)
    .join("\n");
  html = html.replace(/\{\{VIEWPORT_SECTIONS\}\}/g, viewportSectionsHtml);

  // Generated timestamp
  html = html.replace(/\{\{generatedAt\}\}/g, new Date().toISOString());

  return html;
}
