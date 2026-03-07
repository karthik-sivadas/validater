import type { TestStep, ViewportConfig, ExecutionConfig, ExecutionResult, AccessibilityData } from '@validater/core';
import { executeSteps } from '@validater/core';
import { getDefaultPool } from '../browser/pool.js';
import type { StreamingConfig } from '../streaming/types.js';
import { startScreencast } from '../streaming/screencast.js';
import { publishFrame, publishStepEvent, publishStreamEnd } from '../streaming/redis-publisher.js';
import { heartbeat } from '@temporalio/activity';
import type { Database } from '@validater/db';
import { stepScreenshots } from '@validater/db';
import { nanoid } from 'nanoid';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { saveVideo } from '../video/storage.js';
import { AxeBuilder } from '@axe-core/playwright';

export interface ExecuteStepsParams {
  url: string;
  steps: TestStep[];
  viewport: ViewportConfig;
  config?: ExecutionConfig;
  streamingConfig?: StreamingConfig;
}

/**
 * Factory function for execute activities.
 *
 * Uses dependency injection -- the db client is injected at worker setup
 * to persist screenshots to a staging table (bypassing Temporal's 2MB
 * payload limit). This keeps activities testable and allows the worker
 * registration to control the database connection lifecycle.
 *
 * Same pattern as createPersistActivities in persist-results.activity.ts.
 */
export function createExecuteActivities(db: Database) {
  /**
   * Temporal activity: execute test steps in a single viewport.
   *
   * Acquires a pooled browser, creates an isolated BrowserContext with
   * the specified viewport settings and video recording, runs all steps
   * via the core execution engine, captures screenshots, saves the debug
   * video to persistent storage, and returns a fully serializable
   * ExecutionResult.
   *
   * Screenshots are persisted to the step_screenshots staging table
   * during execution (side-channel, bypasses Temporal payload limit).
   * The persist-results activity reads from this staging table when
   * creating final test_run_steps rows.
   *
   * Debug video is recorded via Playwright's built-in recordVideo and
   * saved to data/videos/{testRunId}/{viewport}.webm after context close.
   * The relative path is returned in the ExecutionResult for DB persistence.
   *
   * When streamingConfig.enabled is true, starts CDP screencast to capture
   * browser frames and publishes them to Redis. Step events include
   * action and description for enriched live streaming.
   *
   * All streaming, screenshot-staging, and video operations are best-effort
   * -- failures are caught and do not affect test execution.
   *
   * Browser acquire/release and context lifecycle are guaranteed via
   * try/finally -- no leaked resources even on step failure.
   */
  async function executeStepsActivity(params: ExecuteStepsParams): Promise<ExecutionResult> {
    const startTime = new Date().toISOString();
    const pool = getDefaultPool();
    const pooled = await pool.acquire();
    heartbeat('browser acquired');

    // Create temp directory for Playwright video recording
    const tempVideoDir = await mkdtemp(join(tmpdir(), 'validater-video-'));

    // Outer scope for video path -- set after context.close()
    let videoRelativePath: string | undefined;

    try {
      const context = await pooled.browser.newContext({
        viewport: { width: params.viewport.width, height: params.viewport.height },
        deviceScaleFactor: params.viewport.deviceScaleFactor,
        isMobile: params.viewport.isMobile,
        hasTouch: params.viewport.hasTouch,
        recordVideo: {
          dir: tempVideoDir,
          size: { width: params.viewport.width, height: params.viewport.height },
        },
      });

      // Track step results, accessibility data, and video reference at
      // this scope so they survive the try block and are accessible after
      // context.close()
      let lightResults: ExecutionResult['stepResults'] = [];
      let totalDurationMs = 0;
      let accessibilityData: AccessibilityData | null = null;

      // Capture video reference before context.close() -- the path is
      // known before close, but the file is only finalized AFTER close.
      let videoRef: Awaited<ReturnType<NonNullable<Awaited<ReturnType<typeof context.newPage>>['video']>>> | null = null;

      try {
        const page = await context.newPage();

        // Navigate to the target URL before executing steps
        await page.goto(params.url, {
          waitUntil: 'domcontentloaded',
          timeout: params.config?.navigationTimeoutMs ?? 30_000,
        });
        heartbeat('page loaded');

        // Start screencast if streaming is enabled (best-effort)
        let stopScreencast: (() => Promise<void>) | null = null;
        if (params.streamingConfig?.enabled) {
          try {
            stopScreencast = await startScreencast(page, (frame) => {
              publishFrame(params.streamingConfig!.testRunId, frame).catch(() => {});
            });
          } catch {
            // Screencast start failed -- continue without streaming
          }
        }

        const stepResults = await executeSteps(page, params.steps, {
          ...params.config,
          // Publish step events in real-time as each step completes (best-effort)
          onStepComplete: async (result) => {
            heartbeat(`step ${result.stepOrder} complete`);

            // Persist screenshot to staging table (side-channel, bypasses Temporal payload)
            if (result.screenshotBase64) {
              try {
                await db.insert(stepScreenshots).values({
                  id: nanoid(),
                  testRunId: params.streamingConfig?.testRunId ?? '',
                  viewport: params.viewport.name,
                  stepOrder: result.stepOrder,
                  screenshotBase64: result.screenshotBase64,
                }).onConflictDoNothing();
              } catch {
                // Screenshot persist failure must not break execution
              }
            }

            if (params.streamingConfig?.enabled) {
              publishStepEvent(params.streamingConfig!.testRunId, {
                stepId: result.stepId,
                stepOrder: result.stepOrder,
                status: result.status,
                action: result.action,
                description: result.description,
                durationMs: result.durationMs,
                error: result.error?.message,
              }).catch(() => {});
            }
          },
        });

        // Stop screencast (best-effort)
        if (stopScreencast) {
          try {
            await stopScreencast();
          } catch {
            // Screencast stop failed -- non-critical
          }
        }

        // Run accessibility scan on final page state (best-effort)
        try {
          const axeResults = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
            .analyze();

          accessibilityData = {
            violationCount: axeResults.violations.length,
            passCount: axeResults.passes.length,
            incompleteCount: axeResults.incomplete.length,
            inapplicableCount: axeResults.inapplicable.length,
            violations: axeResults.violations.map(v => ({
              id: v.id,
              impact: v.impact ?? null,
              description: v.description,
              help: v.help,
              helpUrl: v.helpUrl,
              tags: v.tags,
              nodes: v.nodes.slice(0, 10).map(n => ({
                target: n.target as string[],
                html: n.html.substring(0, 500),
                impact: n.impact ?? null,
                failureSummary: n.failureSummary,
              })),
              nodeCount: v.nodes.length,
            })),
          };
        } catch {
          // Accessibility scanning is best-effort -- never break test execution
        }

        // Signal stream end (best-effort)
        if (params.streamingConfig?.enabled) {
          try {
            await publishStreamEnd(params.streamingConfig.testRunId);
          } catch {
            // Stream end signal failed -- non-critical
          }
        }

        // Capture video reference BEFORE context.close()
        // path() returns where the video WILL be written; the file is
        // finalized only after context.close() completes.
        const pages = context.pages();
        videoRef = pages[0]?.video() ?? null;

        // Strip screenshotBase64 from results to stay within Temporal's
        // gRPC payload size limit (~2MB). Screenshots are already persisted
        // to the staging table above.
        lightResults = stepResults.map(({ screenshotBase64, ...rest }) => ({
          ...rest,
          screenshotBase64: '',
        }));
        totalDurationMs = stepResults.reduce((sum, r) => sum + r.durationMs, 0);
      } finally {
        // context.close() triggers video file finalization on disk
        await context.close();

        // Save video to persistent storage (best-effort)
        if (videoRef) {
          try {
            const videoFilePath = await videoRef.path();
            videoRelativePath = await saveVideo(
              params.streamingConfig?.testRunId ?? '',
              params.viewport.name,
              videoFilePath,
            );
          } catch {
            // Video save failure must not break execution
          }
        }

        // Cleanup temp directory (best-effort)
        await rm(tempVideoDir, { recursive: true, force: true }).catch(() => {});
      }

      return {
        viewport: params.viewport.name,
        url: params.url,
        stepResults: lightResults,
        totalDurationMs,
        startedAt: startTime,
        completedAt: new Date().toISOString(),
        videoPath: videoRelativePath,
        accessibilityData: accessibilityData ?? undefined,
      };
    } finally {
      pooled.pagesProcessed++;
      await pool.release(pooled);
    }
  }

  return { executeStepsActivity };
}

export type ExecuteActivities = ReturnType<typeof createExecuteActivities>;
