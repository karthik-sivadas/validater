import { vi, describe, it, expect, beforeEach } from 'vitest';

// Hoist the mock readFile
const { mockReadFile } = vi.hoisted(() => ({
  mockReadFile: vi.fn(),
}));

vi.mock('fs/promises', () => ({
  readFile: mockReadFile,
}));

import { generateHtmlReport, type ReportData } from '../html-generator.js';

// Simple HTML template with placeholders for testing
const MOCK_TEMPLATE = `<!DOCTYPE html>
<html>
<head><title>Validater Test Report - {{testRunId}}</title></head>
<body>
<h1>{{testDescription}}</h1>
<span class="{{statusClass}}">{{status}}</span>
<span>{{url}}</span>
<span>{{createdAt}}</span>
{{completedAtBlock}}
<div>Total: {{totalSteps}}, Pass: {{passedSteps}}, Fail: {{failedSteps}}, Rate: {{passRate}}%</div>
{{VIEWPORT_SECTIONS}}
<footer>Generated: {{generatedAt}}</footer>
</body>
</html>`;

function makeReportData(overrides?: Partial<ReportData>): ReportData {
  return {
    testRunId: 'test-run-001',
    url: 'https://example.com',
    testDescription: 'Login flow test',
    createdAt: '2024-01-01T00:00:00Z',
    completedAt: '2024-01-01T00:05:00Z',
    status: 'complete',
    viewportResults: [],
    ...overrides,
  };
}

describe('generateHtmlReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReadFile.mockResolvedValue(MOCK_TEMPLATE);
  });

  it('produces HTML string containing testRunId', async () => {
    const html = await generateHtmlReport(makeReportData());
    expect(html).toContain('test-run-001');
  });

  it('includes test description', async () => {
    const html = await generateHtmlReport(makeReportData());
    expect(html).toContain('Login flow test');
  });

  it('includes URL', async () => {
    const html = await generateHtmlReport(makeReportData());
    expect(html).toContain('https://example.com');
  });

  it('includes status', async () => {
    const html = await generateHtmlReport(makeReportData());
    expect(html).toContain('complete');
    expect(html).toContain('status-complete');
  });

  it('includes completedAt block when present', async () => {
    const html = await generateHtmlReport(makeReportData());
    expect(html).toContain('2024-01-01T00:05:00Z');
  });

  it('omits completedAt block when null', async () => {
    const html = await generateHtmlReport(makeReportData({ completedAt: null }));
    expect(html).not.toContain('Completed:');
  });

  it('computes summary stats: totalSteps, passedSteps, failedSteps', async () => {
    const html = await generateHtmlReport(
      makeReportData({
        viewportResults: [
          {
            viewport: 'desktop',
            totalDurationMs: 1000,
            steps: [
              { stepOrder: 1, action: 'click', description: 'Click', status: 'pass', durationMs: 100, errorMessage: null, errorExpected: null, errorActual: null, screenshotBase64: null },
              { stepOrder: 2, action: 'fill', description: 'Fill', status: 'fail', durationMs: 200, errorMessage: 'Not found', errorExpected: 'exists', errorActual: 'missing', screenshotBase64: null },
            ],
          },
        ],
      }),
    );
    expect(html).toContain('Total: 2');
    expect(html).toContain('Pass: 1');
    expect(html).toContain('Fail: 1');
    expect(html).toContain('Rate: 50%');
  });

  it('renders pass/fail status badges for steps', async () => {
    const html = await generateHtmlReport(
      makeReportData({
        viewportResults: [
          {
            viewport: 'desktop',
            totalDurationMs: 100,
            steps: [
              { stepOrder: 1, action: 'click', description: 'Click', status: 'pass', durationMs: 100, errorMessage: null, errorExpected: null, errorActual: null, screenshotBase64: null },
              { stepOrder: 2, action: 'fill', description: 'Fill', status: 'fail', durationMs: 50, errorMessage: 'Error', errorExpected: null, errorActual: null, screenshotBase64: null },
            ],
          },
        ],
      }),
    );
    expect(html).toContain('status-pass');
    expect(html).toContain('status-fail');
  });

  it('includes screenshot image when provided', async () => {
    const html = await generateHtmlReport(
      makeReportData({
        viewportResults: [
          {
            viewport: 'desktop',
            totalDurationMs: 100,
            steps: [
              { stepOrder: 1, action: 'click', description: 'Click', status: 'pass', durationMs: 100, errorMessage: null, errorExpected: null, errorActual: null, screenshotBase64: 'c2NyZWVuc2hvdA==' },
            ],
          },
        ],
      }),
    );
    expect(html).toContain('data:image/png;base64,c2NyZWVuc2hvdA==');
  });

  it('handles empty viewportResults (no steps)', async () => {
    const html = await generateHtmlReport(makeReportData({ viewportResults: [] }));
    expect(html).toContain('Total: 0');
    expect(html).toContain('Pass: 0');
    expect(html).toContain('Rate: 0%');
  });

  it('handles all passing steps', async () => {
    const html = await generateHtmlReport(
      makeReportData({
        viewportResults: [
          {
            viewport: 'desktop',
            totalDurationMs: 300,
            steps: [
              { stepOrder: 1, action: 'click', description: 'A', status: 'pass', durationMs: 100, errorMessage: null, errorExpected: null, errorActual: null, screenshotBase64: null },
              { stepOrder: 2, action: 'fill', description: 'B', status: 'pass', durationMs: 100, errorMessage: null, errorExpected: null, errorActual: null, screenshotBase64: null },
            ],
          },
        ],
      }),
    );
    expect(html).toContain('Rate: 100%');
    expect(html).toContain('Fail: 0');
  });

  it('handles all failing steps', async () => {
    const html = await generateHtmlReport(
      makeReportData({
        viewportResults: [
          {
            viewport: 'desktop',
            totalDurationMs: 200,
            steps: [
              { stepOrder: 1, action: 'click', description: 'A', status: 'fail', durationMs: 100, errorMessage: 'err1', errorExpected: null, errorActual: null, screenshotBase64: null },
              { stepOrder: 2, action: 'fill', description: 'B', status: 'fail', durationMs: 100, errorMessage: 'err2', errorExpected: null, errorActual: null, screenshotBase64: null },
            ],
          },
        ],
      }),
    );
    expect(html).toContain('Rate: 0%');
    expect(html).toContain('Fail: 2');
  });

  it('includes error details for failed steps', async () => {
    const html = await generateHtmlReport(
      makeReportData({
        viewportResults: [
          {
            viewport: 'desktop',
            totalDurationMs: 100,
            steps: [
              { stepOrder: 1, action: 'assert', description: 'Check text', status: 'fail', durationMs: 50, errorMessage: 'Text mismatch', errorExpected: 'Hello', errorActual: 'Goodbye', screenshotBase64: null },
            ],
          },
        ],
      }),
    );
    expect(html).toContain('Text mismatch');
    expect(html).toContain('Hello');
    expect(html).toContain('Goodbye');
  });

  it('renders viewport name in section header', async () => {
    const html = await generateHtmlReport(
      makeReportData({
        viewportResults: [
          {
            viewport: 'mobile',
            totalDurationMs: 100,
            steps: [
              { stepOrder: 1, action: 'click', description: 'A', status: 'pass', durationMs: 100, errorMessage: null, errorExpected: null, errorActual: null, screenshotBase64: null },
            ],
          },
        ],
      }),
    );
    expect(html).toContain('mobile');
  });
});
