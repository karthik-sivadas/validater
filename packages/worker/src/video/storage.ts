import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, '..', '..');
const DATA_DIR = process.env.DATA_DIR ?? join(PACKAGE_ROOT, 'data');
export const VIDEOS_DIR = join(DATA_DIR, 'videos');

/**
 * Save a video file from a temporary location to persistent storage.
 *
 * Uses readFile + writeFile instead of rename to handle cross-device
 * moves (temp dir may be on a different filesystem than data dir).
 *
 * @returns The relative path stored in the database (e.g., "{testRunId}/{viewport}.webm").
 */
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
  return `${testRunId}/${filename}`;
}

/**
 * Resolve a relative video path to an absolute filesystem path.
 *
 * @param relativePath - The path stored in the database (e.g., "{testRunId}/{viewport}.webm").
 * @returns Absolute path for file serving or reading.
 */
export function getVideoPath(relativePath: string): string {
  return join(VIDEOS_DIR, relativePath);
}
