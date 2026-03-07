import { getVideoPath } from '../video/storage.js';
import { processPolishedVideo, type AnnotationOverlay } from '../video/processor.js';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExportVideoParams {
  testRunId: string;
  viewport: string;
  videoPath: string; // relative path from DB
  resolution: { width: number; height: number };
  includeAnnotations: boolean;
  trimDeadTime: boolean;
  steps: Array<{
    stepOrder: number;
    action: string;
    description: string;
    durationMs: number;
  }>;
}

export interface ExportVideoResult {
  outputPath: string; // relative path to processed MP4
}

// ---------------------------------------------------------------------------
// Activity
// ---------------------------------------------------------------------------

/**
 * Temporal activity: Process a debug video into a polished MP4.
 *
 * Applies optional annotation overlays, dead time trimming, and
 * resolution scaling via FFmpeg. Output is H.264 MP4 for universal
 * playback.
 */
export async function processVideoActivity(
  params: ExportVideoParams,
): Promise<ExportVideoResult> {
  const inputPath = getVideoPath(params.videoPath);

  // Build output path: same directory, -polished.mp4 suffix
  const relativeOutputPath = `${params.testRunId}/${params.viewport}-polished.mp4`;
  const outputPath = getVideoPath(relativeOutputPath);

  // Ensure output directory exists
  await mkdir(dirname(outputPath), { recursive: true });

  // Build annotations from step data
  const annotations: AnnotationOverlay[] = [];
  if (params.includeAnnotations && params.steps.length > 0) {
    let cumulativeTimeSec = 0;
    for (const step of params.steps) {
      const durationSec = step.durationMs / 1000;
      annotations.push({
        text: `Step ${step.stepOrder}: ${step.action} - ${step.description}`,
        startTimeSec: cumulativeTimeSec,
        endTimeSec: cumulativeTimeSec + durationSec,
      });
      cumulativeTimeSec += durationSec;
    }
  }

  // Build trim segments from step timing data
  let trimSegments: Array<{ start: number; end: number }> | undefined;
  if (params.trimDeadTime && params.steps.length > 0) {
    const PADDING_SEC = 0.5;
    const rawSegments: Array<{ start: number; end: number }> = [];
    let cumulativeTimeSec = 0;

    for (const step of params.steps) {
      const durationSec = step.durationMs / 1000;
      const segStart = Math.max(0, cumulativeTimeSec - PADDING_SEC);
      const segEnd = cumulativeTimeSec + durationSec + PADDING_SEC;
      rawSegments.push({ start: segStart, end: segEnd });
      cumulativeTimeSec += durationSec;
    }

    // Merge overlapping/adjacent segments
    const merged: Array<{ start: number; end: number }> = [];
    for (const seg of rawSegments) {
      if (merged.length === 0 || seg.start > merged[merged.length - 1].end) {
        merged.push({ ...seg });
      } else {
        merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, seg.end);
      }
    }

    trimSegments = merged;
  }

  await processPolishedVideo({
    inputPath,
    outputPath,
    annotations,
    resolution: params.resolution,
    trimSegments,
  });

  return { outputPath: relativeOutputPath };
}
