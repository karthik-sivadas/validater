export interface StepError {
  message: string;
  expected?: string;
  actual?: string;
}

export interface StepResult {
  stepId: string;
  stepOrder: number;
  status: 'pass' | 'fail';
  error?: StepError;
  screenshotBase64: string; // PNG screenshot as base64 (always captured)
  durationMs: number;
}

export interface ExecutionResult {
  viewport: string;
  url: string;
  stepResults: StepResult[];
  totalDurationMs: number;
  startedAt: string; // ISO 8601
  completedAt: string; // ISO 8601
}

export interface ExecutionConfig {
  stepTimeoutMs?: number; // default 10_000
  navigationTimeoutMs?: number; // default 30_000
  screenshotFullPage?: boolean; // default false
}
