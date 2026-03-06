export interface ScreencastFrame {
  data: string; // base64 JPEG
  sessionId: number; // must be ack'd
  metadata: {
    offsetTop: number;
    pageScaleFactor: number;
    deviceWidth: number;
    deviceHeight: number;
    scrollOffsetX: number;
    scrollOffsetY: number;
    timestamp?: number;
  };
}

export interface StepEvent {
  stepId: string;
  stepOrder: number;
  status: 'pass' | 'fail';
  action: string;
  description: string;
  durationMs: number;
  error?: string;
}

export interface StreamMessage {
  type: 'frame' | 'step-start' | 'step-complete' | 'stream-end';
  testRunId: string;
  timestamp: number;
  payload: unknown;
}

export interface StreamingConfig {
  testRunId: string;
  enabled: boolean;
}

export function channelName(testRunId: string): string {
  return `stream:${testRunId}`;
}
