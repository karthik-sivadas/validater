import { spawn } from 'child_process';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import ffmpegStatic from 'ffmpeg-static';

// ffmpeg-static exports `string | null` as default
const ffmpegPath: string | null = ffmpegStatic as unknown as string | null;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AnnotationOverlay {
  text: string;
  startTimeSec: number;
  endTimeSec: number;
}

export interface ProcessVideoOptions {
  inputPath: string;
  outputPath: string;
  annotations: AnnotationOverlay[];
  resolution: { width: number; height: number };
  trimSegments?: Array<{ start: number; end: number }>;
}

// ---------------------------------------------------------------------------
// FFmpeg runner
// ---------------------------------------------------------------------------

function runFFmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) {
      reject(new Error('FFmpeg binary not found. Ensure ffmpeg-static is installed correctly.'));
      return;
    }

    const binaryPath = ffmpegPath!;
    const proc = spawn(binaryPath, args);
    let stderr = '';
    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    proc.on('close', (code: number | null) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited with code ${code}: ${stderr.slice(-1000)}`));
    });
    proc.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Text escaping for FFmpeg drawtext filter
// ---------------------------------------------------------------------------

function escapeDrawtext(text: string): string {
  // FFmpeg drawtext requires escaping colons, single quotes, and backslashes
  return text
    .replace(/\\/g, '\\\\\\\\')
    .replace(/'/g, "\u2019") // Replace with right single quote (avoids FFmpeg escaping hell)
    .replace(/:/g, '\\:')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/;/g, '\\;');
}

// ---------------------------------------------------------------------------
// Polished video processor
// ---------------------------------------------------------------------------

/**
 * Process a debug video recording into a polished MP4 with annotations,
 * dead time trimming, and resolution scaling via FFmpeg.
 *
 * Annotations are displayed as timed text overlays at the bottom of the frame.
 * Dead time trimming uses FFmpeg's trim+setpts+concat filter chain.
 * Output is H.264 MP4 for universal playback.
 */
export async function processPolishedVideo(options: ProcessVideoOptions): Promise<void> {
  const { inputPath, outputPath, annotations, resolution, trimSegments } = options;

  if (!ffmpegPath) {
    throw new Error('FFmpeg binary not found. Ensure ffmpeg-static is installed correctly.');
  }

  // Build drawtext filters for annotations
  const drawtextFilters = annotations.map((ann) => {
    const escapedText = escapeDrawtext(ann.text);
    return `drawtext=text='${escapedText}':fontsize=20:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=8:x=(w-text_w)/2:y=h-40:enable='between(t,${ann.startTimeSec},${ann.endTimeSec})'`;
  });

  if (trimSegments && trimSegments.length > 0) {
    // Complex filter: trim segments + annotations + scale
    const filterParts: string[] = [];
    const concatInputs: string[] = [];

    trimSegments.forEach((seg, i) => {
      const label = `v${i}`;
      filterParts.push(
        `[0:v]trim=start=${seg.start}:end=${seg.end},setpts=PTS-STARTPTS[${label}]`,
      );
      concatInputs.push(`[${label}]`);
    });

    // Concat all trimmed segments
    const concatLabel = 'trimmed';
    filterParts.push(
      `${concatInputs.join('')}concat=n=${trimSegments.length}:v=1:a=0[${concatLabel}]`,
    );

    // Apply scale
    const scaleLabel = 'scaled';
    filterParts.push(
      `[${concatLabel}]scale=${resolution.width}:${resolution.height}[${scaleLabel}]`,
    );

    // Apply annotations if any
    if (drawtextFilters.length > 0) {
      let currentLabel = scaleLabel;
      drawtextFilters.forEach((dt, i) => {
        const nextLabel = i === drawtextFilters.length - 1 ? 'out' : `dt${i}`;
        filterParts.push(`[${currentLabel}]${dt}[${nextLabel}]`);
        currentLabel = nextLabel;
      });
    } else {
      // No annotations -- rename scaled to out
      filterParts.push(`[${scaleLabel}]null[out]`);
    }

    const filterComplex = filterParts.join(';');

    await runFFmpeg([
      '-i', inputPath,
      '-filter_complex', filterComplex,
      '-map', '[out]',
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '23',
      '-y',
      outputPath,
    ]);
  } else {
    // Simple filter chain: scale + annotations
    const vfParts: string[] = [];
    vfParts.push(`scale=${resolution.width}:${resolution.height}`);
    vfParts.push(...drawtextFilters);

    await runFFmpeg([
      '-i', inputPath,
      '-vf', vfParts.join(','),
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '23',
      '-y',
      outputPath,
    ]);
  }
}
