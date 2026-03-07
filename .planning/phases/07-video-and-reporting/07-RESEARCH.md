# Phase 7: Video and Reporting - Research

**Researched:** 2026-03-07
**Domain:** Video recording/processing, PDF/HTML report generation
**Confidence:** HIGH (debug video), MEDIUM (polished video), HIGH (reports)

## Summary

Phase 7 has three distinct sub-domains: (1) debug video recording during test execution, (2) polished video export with annotations and dead time trimming, and (3) PDF/HTML test report export.

**Debug video recording** is straightforward -- Playwright natively supports recording via `browser.newContext({ recordVideo: { dir, size } })`. Videos are saved as `.webm` files (VP8 codec) upon context close. The key integration challenge is wiring `recordVideo` into the existing `executeStepsActivity` which already creates a `BrowserContext` per viewport. Videos must be stored on the filesystem (not in PostgreSQL) with path references in the database.

**Polished video export** requires server-side FFmpeg processing. The established `fluent-ffmpeg` wrapper was **archived in May 2025** and is no longer maintained. The recommended approach is to use `ffmpeg-static` (v6.1.1, actively maintained) for bundled FFmpeg binaries and call FFmpeg directly via `child_process.spawn()`. Annotations use FFmpeg's `drawtext` filter, dead time trimming uses the `trim`+`setpts`+`concat` filter chain, and resolution selection uses the `scale` filter. Step timing data already exists in the database (`test_run_steps.durationMs`) and can drive the annotation overlay timestamps.

**Report export** should use Playwright's `page.pdf()` for PDF generation (Chromium-only, already a project dependency) and server-rendered HTML templates for the HTML report. Since the project already has Playwright running in the worker, leveraging it for PDF generation avoids adding new dependencies. For the HTML report, use a standalone HTML template rendered server-side (no framework dependency) that can be opened in any browser.

**Primary recommendation:** Use Playwright's built-in `recordVideo` for debug videos, `ffmpeg-static` + `child_process.spawn()` for polished video processing, and Playwright `page.pdf()` for PDF export -- keeping new dependencies minimal by leveraging what's already in the stack.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| playwright | ^1.58.2 | Debug video recording (`recordVideo`) + PDF generation (`page.pdf()`) | Already in project, native video recording support, Chromium PDF engine |
| ffmpeg-static | 6.1.1 | Bundled FFmpeg binary for video processing | Actively maintained, no system FFmpeg install needed, all platforms |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| nanoid | ^5.1.6 | Generate unique filenames for videos/reports | Already in project |
| drizzle-orm | ^0.45.0 | DB schema for video/report metadata | Already in project |
| fs/promises | Node built-in | Filesystem operations for video/report files | Video storage, cleanup |
| child_process | Node built-in | Spawn FFmpeg for video processing | Polished video export |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ffmpeg-static + spawn | fluent-ffmpeg | fluent-ffmpeg was **archived May 2025**, no longer maintained, broken with recent FFmpeg versions |
| ffmpeg-static + spawn | ffmpeg.wasm (browser) | 3-10x slower than native, heavy WASM download, poor for server-side |
| Playwright page.pdf() | @react-pdf/renderer | Would add ~2MB dependency; React component API is nice but overkill for a single report template; known SSR issues with some frameworks |
| Playwright page.pdf() | Puppeteer | Would add duplicate headless browser dependency alongside Playwright |
| Filesystem video storage | PostgreSQL bytea/large object | Videos are multi-MB; DB storage increases RAM, slows queries, 1GB row limit |

**Installation:**
```bash
cd packages/worker && pnpm add ffmpeg-static
cd packages/worker && pnpm add -D @types/ffmpeg-static
```

## Architecture Patterns

### Recommended Project Structure
```
packages/
  worker/src/
    video/
      recorder.ts          # Playwright recordVideo wrapper
      processor.ts         # FFmpeg spawn wrapper for polished video
      storage.ts           # Filesystem storage helpers (save, read, cleanup)
    reports/
      pdf-generator.ts     # Playwright page.pdf() wrapper
      html-generator.ts    # HTML template renderer
      templates/
        report.html        # HTML report template (standalone, self-contained)
  db/src/schema/
    test-runs.ts           # Add videoPath, polishedVideoPath columns
  web/src/
    components/
      video-player.tsx     # WebM/MP4 video player component
      report-actions.tsx   # Export buttons (PDF, HTML, polished video)
    server/
      exports.ts           # Server functions for export triggers
```

### Pattern 1: Filesystem Video Storage with DB Path References
**What:** Store video files on the local filesystem under a `data/videos/` directory. Store only the relative path in the database. Serve via a server function that reads the file and returns it.
**When to use:** Always for video files. Never store video binary data in PostgreSQL.
**Example:**
```typescript
// Source: Best practice for video/binary storage
import { mkdir, writeFile, readFile, unlink } from 'fs/promises';
import { join } from 'path';

const DATA_DIR = process.env.DATA_DIR ?? join(process.cwd(), 'data');
const VIDEOS_DIR = join(DATA_DIR, 'videos');

export async function saveVideo(
  testRunId: string,
  viewport: string,
  sourcePath: string,
): Promise<string> {
  const dir = join(VIDEOS_DIR, testRunId);
  await mkdir(dir, { recursive: true });
  const filename = `${viewport}.webm`;
  const destPath = join(dir, filename);
  const data = await readFile(sourcePath);
  await writeFile(destPath, data);
  return `${testRunId}/${filename}`; // relative path stored in DB
}
```

### Pattern 2: Playwright recordVideo Integration
**What:** Add `recordVideo` option to the BrowserContext creation in `executeStepsActivity`. Save the video after context close.
**When to use:** Every test execution to produce debug video.
**Example:**
```typescript
// Source: https://playwright.dev/docs/videos
import { join } from 'path';
import { mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';

// Inside executeStepsActivity, modify context creation:
const tempDir = await mkdtemp(join(tmpdir(), 'validater-video-'));
const context = await pooled.browser.newContext({
  viewport: { width: params.viewport.width, height: params.viewport.height },
  deviceScaleFactor: params.viewport.deviceScaleFactor,
  isMobile: params.viewport.isMobile,
  hasTouch: params.viewport.hasTouch,
  recordVideo: {
    dir: tempDir,
    size: { width: params.viewport.width, height: params.viewport.height },
  },
});

// ... execute steps ...

// CRITICAL: Video is only saved after context.close()
const page = context.pages()[0];
const videoPath = page ? await page.video()?.path() : undefined;
await context.close(); // This triggers video file write

// Now videoPath exists on disk -- save it to persistent storage
if (videoPath) {
  const relativePath = await saveVideo(
    params.testRunId,
    params.viewport.name,
    videoPath,
  );
  // Return relativePath for DB persistence
}
```

### Pattern 3: FFmpeg Spawn for Video Processing
**What:** Use child_process.spawn with ffmpeg-static binary path for video processing. Wrap in a Promise for async/await.
**When to use:** Polished video export (annotations, trimming, resolution change).
**Example:**
```typescript
// Source: ffmpeg-static npm, Node.js child_process docs
import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';

function runFFmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath!, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited with code ${code}: ${stderr}`));
    });
    proc.on('error', reject);
  });
}

// Example: Add text overlay + trim + scale
await runFFmpeg([
  '-i', inputPath,
  '-vf', `drawtext=text='Step 1\\: Click Login':fontsize=24:fontcolor=white:box=1:boxcolor=black@0.5:x=10:y=10:enable='between(t,0,3)',scale=1280:720`,
  '-c:v', 'libx264',
  '-preset', 'fast',
  '-y', outputPath,
]);
```

### Pattern 4: PDF Generation via Playwright
**What:** Render an HTML template to a Playwright page, then call `page.pdf()` to generate a PDF buffer.
**When to use:** PDF report export.
**Example:**
```typescript
// Source: https://playwright.dev/docs/api/class-page#page-pdf
import { chromium } from 'playwright';

async function generatePdfReport(htmlContent: string): Promise<Buffer> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: 'networkidle' });
  await page.emulateMedia({ media: 'print' });
  const pdf = await page.pdf({
    format: 'A4',
    margin: { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' },
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<div style="font-size:8px;text-align:center;width:100%">Validater Test Report</div>',
    footerTemplate: '<div style="font-size:8px;text-align:center;width:100%"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
  });
  await browser.close();
  return pdf;
}
```

### Pattern 5: Temporal Activity for Export Operations
**What:** Video processing and PDF generation as Temporal activities, triggered on-demand (not during test execution).
**When to use:** User-initiated export actions. Separate from the test pipeline.
**Example:**
```typescript
// New Temporal workflow for export operations
// NOT part of test-run.workflow.ts -- separate workflow
export async function exportVideoWorkflow(params: {
  testRunId: string;
  viewport: string;
  resolution: { width: number; height: number };
  includeAnnotations: boolean;
  trimDeadTime: boolean;
}): Promise<{ videoPath: string }> {
  return await processVideoActivity(params);
}
```

### Anti-Patterns to Avoid
- **Storing video binary in PostgreSQL:** Multi-MB video files will bloat the database, increase backup size, and slow queries. Use filesystem + path reference.
- **Processing video during test execution:** Video processing (annotations, trimming) is CPU-intensive and should be triggered separately, not blocking the test pipeline.
- **Using fluent-ffmpeg:** Archived May 2025, broken with recent FFmpeg versions. Use ffmpeg-static + child_process.spawn instead.
- **Browser-side FFmpeg (ffmpeg.wasm):** Too slow for real video processing. Do it server-side.
- **Creating new browser instance for each PDF:** Use the existing browser pool or a lightweight single-use instance. For report export, a simple `chromium.launch()` + `browser.close()` is fine since it's infrequent.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Video recording | Custom CDP screencast-to-video assembler | Playwright `recordVideo` | Playwright handles codec encoding, frame timing, file finalization automatically |
| Video format conversion | Custom WebM parser/encoder | FFmpeg via `ffmpeg-static` | FFmpeg handles all codec/container edge cases; decades of battle-testing |
| PDF layout engine | Custom canvas-to-PDF or HTML string manipulation | Playwright `page.pdf()` | Chromium's print engine handles CSS, pagination, fonts, images correctly |
| Dead time detection | Custom frame-diff algorithm | FFmpeg `scene` filter or step timing data | Step timing data already available; FFmpeg has proven scene detection |
| Video text overlays | Custom video frame manipulation | FFmpeg `drawtext` filter | Handles font rendering, positioning, timing, transparency |
| File cleanup/lifecycle | Manual fs.unlink calls scattered across code | Centralized storage module with cleanup method | Prevents orphaned files, enables consistent path resolution |

**Key insight:** The project already captures all the raw data needed (screenshots per step, step timing, step metadata). The "polished video" is primarily an FFmpeg filter pipeline applied to the existing debug recording. The "report" is primarily an HTML template populated with existing DB data. Neither requires fundamentally new data capture -- just processing/formatting of what already exists.

## Common Pitfalls

### Pitfall 1: Video Not Saved Due to Missing context.close()
**What goes wrong:** Playwright only writes the video file to disk when `BrowserContext.close()` is called. If the context is not properly closed (e.g., exception path), the video file is incomplete or zero-length.
**Why it happens:** Playwright buffers video frames in memory and finalizes the file on context closure.
**How to avoid:** Use try/finally to ensure `context.close()` is always called. The existing code already has this pattern in `executeStepsActivity`.
**Warning signs:** Zero-byte `.webm` files in the temp directory.

### Pitfall 2: Video Path Access Before Context Close
**What goes wrong:** `page.video().path()` returns the path where the video *will* be written, but the file may not exist yet if the context is still open.
**Why it happens:** The path is known immediately but the file is finalized asynchronously during close.
**How to avoid:** Always call `page.video().path()` *before* `context.close()`, but don't read the file until *after* `context.close()` completes.
**Warning signs:** "File not found" errors when trying to read the video file.

### Pitfall 3: Temp Directory Cleanup
**What goes wrong:** Playwright writes videos to a temp directory. If not cleaned up, these accumulate over time and consume disk space.
**Why it happens:** `mkdtemp` creates directories that aren't automatically cleaned up.
**How to avoid:** After copying the video to permanent storage, delete the temp directory. Use a cleanup function in the storage module.
**Warning signs:** Growing disk usage in `/tmp/validater-video-*` directories.

### Pitfall 4: FFmpeg Binary Not Found
**What goes wrong:** `ffmpeg-static` provides a binary path, but if the package isn't installed correctly or the path resolution fails, spawn will fail.
**Why it happens:** Platform-specific binary download during `npm install` can fail silently.
**How to avoid:** Validate FFmpeg binary exists on worker startup. Log the path for debugging. Add a health check.
**Warning signs:** "ENOENT" errors from child_process.spawn.

### Pitfall 5: FFmpeg Memory/CPU Spike During Video Processing
**What goes wrong:** FFmpeg video processing (especially with complex filters) can consume significant CPU and memory, affecting concurrent test executions.
**Why it happens:** Video encoding is computationally expensive.
**How to avoid:** Process exports as separate Temporal activities with their own timeout and retry policy. Consider limiting concurrent exports. Use `-preset fast` for H.264 encoding to trade quality for speed.
**Warning signs:** Worker memory warnings, slow test executions during export.

### Pitfall 6: Large Video Files Exceeding Temporal Payload
**What goes wrong:** Attempting to pass video file contents through Temporal workflow results hits the 2MB gRPC payload limit.
**Why it happens:** Same issue as screenshots in Phase 6.1.
**How to avoid:** Use the established filesystem side-channel pattern. Video files are saved to filesystem, only the file path (a short string) is passed through Temporal.
**Warning signs:** Temporal "payload too large" errors.

### Pitfall 7: PDF Generation Only Works in Chromium
**What goes wrong:** Playwright's `page.pdf()` method only works with Chromium browser. If the pool launches Firefox or WebKit, PDF generation will fail.
**Why it happens:** Chromium-only limitation in Playwright.
**How to avoid:** For PDF generation, always use `chromium.launch()` explicitly. Don't use the browser pool (which is configured for Chromium but this should be explicit).
**Warning signs:** "PDF generation is only supported for Headless Chromium" error.

### Pitfall 8: WebM Playback in Safari
**What goes wrong:** Safari has limited WebM support. Debug videos may not play in Safari.
**Why it happens:** WebM/VP8 support in Safari was added in later versions and may have limitations.
**How to avoid:** For the results page video player, include format fallback messaging. The polished video export converts to MP4 (H.264) which has universal browser support.
**Warning signs:** "This video format is not supported" in Safari.

## Code Examples

### Debug Video Recording in executeStepsActivity
```typescript
// Source: https://playwright.dev/docs/videos + existing codebase pattern
// Modification to packages/worker/src/activities/execute-steps.activity.ts

import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { saveVideo } from '../video/storage.js';

// Inside executeStepsActivity, replace context creation:
const tempVideoDir = await mkdtemp(join(tmpdir(), 'validater-video-'));

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

try {
  const page = await context.newPage();
  // ... existing execution logic ...

  // Get video path BEFORE context.close()
  const videoPath = await page.video()?.path();

  // context.close() in finally block triggers video write
} finally {
  // Get reference to page video before closing
  const pages = context.pages();
  const videoRef = pages[0]?.video();

  await context.close(); // Video file is now finalized on disk

  // Save video to persistent storage (best-effort)
  if (videoRef) {
    try {
      const videoFilePath = await videoRef.path();
      const relativePath = await saveVideo(
        params.streamingConfig?.testRunId ?? '',
        params.viewport.name,
        videoFilePath,
      );
      // Store relativePath for return in ExecutionResult
    } catch {
      // Video save failure must not break execution
    }
  }

  // Cleanup temp directory
  await rm(tempVideoDir, { recursive: true, force: true }).catch(() => {});
}
```

### FFmpeg Polished Video Processing
```typescript
// Source: ffmpeg-static npm + FFmpeg documentation
import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';

interface AnnotationOverlay {
  text: string;
  startTimeSec: number;
  endTimeSec: number;
}

interface ProcessVideoOptions {
  inputPath: string;
  outputPath: string;
  annotations: AnnotationOverlay[];
  resolution: { width: number; height: number };
  trimSegments?: Array<{ start: number; end: number }>;
}

export async function processPolishedVideo(options: ProcessVideoOptions): Promise<void> {
  const { inputPath, outputPath, annotations, resolution, trimSegments } = options;

  // Build drawtext filter chain for annotations
  const drawtextFilters = annotations.map((ann, i) => {
    const escapedText = ann.text.replace(/'/g, "\\'").replace(/:/g, '\\:');
    return `drawtext=text='${escapedText}':fontsize=20:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=8:x=10:y=h-40:enable='between(t\\,${ann.startTimeSec}\\,${ann.endTimeSec})'`;
  });

  // Build trim+concat filter for dead time removal
  let filterComplex: string;
  if (trimSegments && trimSegments.length > 0) {
    const trimParts = trimSegments.map((seg, i) =>
      `[0:v]trim=${seg.start}:${seg.end},setpts=PTS-STARTPTS[v${i}]`
    );
    const concatInputs = trimSegments.map((_, i) => `[v${i}]`).join('');
    const concatFilter = `${concatInputs}concat=n=${trimSegments.length}:v=1[trimmed]`;
    const drawFilters = drawtextFilters.length > 0
      ? `;[trimmed]${drawtextFilters.join(',')}[annotated];[annotated]scale=${resolution.width}:${resolution.height}[out]`
      : `;[trimmed]scale=${resolution.width}:${resolution.height}[out]`;
    filterComplex = `${trimParts.join(';')};${concatFilter}${drawFilters}`;
  } else {
    const vf = [...drawtextFilters, `scale=${resolution.width}:${resolution.height}`].join(',');
    filterComplex = vf;
  }

  const args = [
    '-i', inputPath,
    ...(trimSegments ? ['-filter_complex', filterComplex, '-map', '[out]'] : ['-vf', filterComplex]),
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-y',
    outputPath,
  ];

  await runFFmpeg(args);
}
```

### HTML Report Template
```html
<!-- Source: Custom template for Validater test report -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Test Report - {{testRunId}}</title>
  <style>
    @media print {
      .page-break { page-break-before: always; }
    }
    body { font-family: Inter, system-ui, sans-serif; margin: 2rem; color: #1a1a1a; }
    .header { border-bottom: 2px solid #10b981; padding-bottom: 1rem; margin-bottom: 2rem; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem; }
    .stat-card { background: #f0fdf4; padding: 1rem; border-radius: 0.5rem; text-align: center; }
    .step { border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 1rem; margin-bottom: 1rem; }
    .step-pass { border-left: 4px solid #10b981; }
    .step-fail { border-left: 4px solid #ef4444; }
    .screenshot { max-width: 100%; max-height: 300px; border-radius: 0.25rem; }
    .badge { display: inline-block; padding: 0.125rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem; font-weight: 500; }
  </style>
</head>
<body>
  <!-- Template populated server-side with test run data -->
</body>
</html>
```

### Video Player Component (Frontend)
```typescript
// WebM video player for results page
function VideoPlayer({ videoUrl }: { videoUrl: string }) {
  return (
    <div className="rounded-md border border-border overflow-hidden">
      <video
        controls
        preload="metadata"
        className="w-full max-h-[480px]"
        src={videoUrl}
      >
        <p className="text-sm text-muted-foreground p-4">
          Your browser does not support WebM video playback.
        </p>
      </video>
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| fluent-ffmpeg for Node.js FFmpeg | ffmpeg-static + child_process.spawn | May 2025 (fluent-ffmpeg archived) | Must use direct FFmpeg CLI via spawn, no wrapper API |
| Puppeteer for PDF generation | Playwright page.pdf() | 2024+ (Playwright matured) | Can reuse existing Playwright dependency |
| Store videos in DB | Filesystem + path reference | Industry standard | Prevents DB bloat, better performance |
| ffmpeg.wasm for video processing | Server-side FFmpeg | Performance reality | ffmpeg.wasm is 3-10x slower, server-side is practical |

**Deprecated/outdated:**
- **fluent-ffmpeg (v2.x):** Archived May 2025, repository is read-only, broken with recent FFmpeg versions. Do not use.
- **ffmpeg-kit:** Also archived June 2025. The Node.js FFmpeg wrapper ecosystem has contracted significantly.

## Open Questions

1. **Video storage location in production**
   - What we know: Filesystem storage with path reference is best practice. `data/videos/` directory works for dev.
   - What's unclear: Production deployment may need S3-compatible object storage (e.g., MinIO, DigitalOcean Spaces) rather than local filesystem.
   - Recommendation: Build the storage abstraction layer now with a filesystem implementation. Keep the interface generic enough to swap for S3 later. For Phase 7, filesystem is sufficient.

2. **Dead time detection strategy**
   - What we know: Two approaches exist: (a) use step timing data to identify gaps between steps (easy, already have data), (b) use FFmpeg scene detection to find motionless segments (more accurate, more complex).
   - What's unclear: Which produces better results for typical web test recordings.
   - Recommendation: Use step timing data (approach a). We already have `stepOrder`, `durationMs`, and step start/end times. Gaps > N seconds between steps are "dead time." This avoids FFmpeg analysis complexity and uses data we already have.

3. **Video file serving mechanism**
   - What we know: TanStack Start server functions can return binary data. The Hono sidecar could serve video files too.
   - What's unclear: Whether TanStack Start's Nitro server efficiently handles large file streaming (videos can be several MB).
   - Recommendation: Use a TanStack Start server function that reads the file and returns it with proper Content-Type headers. If performance is an issue, consider serving directly from Hono sidecar (already has a server on port 3001).

4. **Concurrent export limits**
   - What we know: Video processing is CPU-intensive. Multiple simultaneous exports could degrade worker performance.
   - What's unclear: Practical concurrency limits for the target deployment.
   - Recommendation: Use Temporal's built-in activity concurrency limiting. Set `maxConcurrentActivityTaskExecutions` on the worker for export activities, or use a separate task queue for exports.

## Sources

### Primary (HIGH confidence)
- [Playwright Videos Documentation](https://playwright.dev/docs/videos) - recordVideo API, file format, dimensions, context.close() requirement
- [Playwright Video Class API](https://playwright.dev/docs/api/class-video) - path(), saveAs(), delete() methods
- [Playwright page.pdf() API](https://playwright.dev/docs/api/class-page#page-pdf) - Full PDF options, Chromium-only limitation
- [ffmpeg-static GitHub](https://github.com/eugeneware/ffmpeg-static) - v6.1.1, platform support, actively maintained

### Secondary (MEDIUM confidence)
- [fluent-ffmpeg GitHub](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg) - Confirmed archived May 2025, repository read-only
- [FFmpeg drawtext filter](https://ffmpeg.org/ffmpeg-filters.html) - Text overlay, positioning, timing parameters
- [FFmpeg trim/concat](https://markheath.net/post/cut-and-concatenate-with-ffmpeg) - Trim segments, setpts reset, concat filter
- [@react-pdf/renderer](https://react-pdf.org/) - v4.3.2, server-side API (considered but not recommended)
- [Video storage best practices](https://maximorlov.com/why-storing-files-database-bad-practice/) - Filesystem vs database for binary files

### Tertiary (LOW confidence)
- WebM file sizes for test recordings - No authoritative data found on typical sizes. Estimate 1-10MB for a 30-60 second test recording at 1280x720 based on VP8 bitrate characteristics.
- FFmpeg scene detection for dead time - Approach is proven for video editing but untested specifically for web test recordings. Step timing approach recommended instead.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Playwright recordVideo is well-documented, ffmpeg-static is actively maintained, page.pdf() is proven
- Architecture: HIGH - Filesystem storage pattern is industry standard, existing codebase patterns (DI factories, Temporal activities) are well-established
- Pitfalls: HIGH - Video save/context.close() timing is documented in Playwright docs, Temporal payload limits already solved in Phase 6.1
- Polished video processing: MEDIUM - FFmpeg filter chains are well-documented but the specific combination (drawtext + trim + concat + scale) needs validation during implementation
- Report template design: MEDIUM - Template approach is standard but specific layout/styling decisions will be made during planning

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (30 days - these technologies are stable)
