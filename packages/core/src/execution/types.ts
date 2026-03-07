export interface StepError {
  message: string;
  expected?: string;
  actual?: string;
}

export interface StepResult {
  stepId: string;
  stepOrder: number;
  action: string;
  description: string;
  status: 'pass' | 'fail';
  error?: StepError;
  screenshotBase64: string; // PNG screenshot as base64 (always captured)
  durationMs: number;
}

export interface AccessibilityViolation {
  id: string;
  impact: string | null;
  description: string;
  help: string;
  helpUrl: string;
  tags: string[];
  nodes: Array<{
    target: string[];
    html: string;
    impact: string | null;
    failureSummary: string | undefined;
  }>;
  nodeCount: number;
}

export interface AccessibilityData {
  violationCount: number;
  passCount: number;
  incompleteCount: number;
  inapplicableCount: number;
  violations: AccessibilityViolation[];
}

export interface ExecutionResult {
  viewport: string;
  url: string;
  stepResults: StepResult[];
  totalDurationMs: number;
  startedAt: string; // ISO 8601
  completedAt: string; // ISO 8601
  videoPath?: string; // Relative path to debug video (e.g., "{testRunId}/{viewport}.webm")
  accessibilityData?: AccessibilityData; // axe-core scan results (best-effort, may be absent)
}

export interface ExecutionConfig {
  stepTimeoutMs?: number; // default 10_000
  navigationTimeoutMs?: number; // default 30_000
  screenshotFullPage?: boolean; // default false
  onStepComplete?: (result: StepResult) => void | Promise<void>;
}
