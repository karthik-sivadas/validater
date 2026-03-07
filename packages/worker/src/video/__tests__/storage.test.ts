import { vi, describe, it, expect, beforeEach } from 'vitest';

// Hoist mock functions
const { mockMkdir, mockReadFile, mockWriteFile } = vi.hoisted(() => ({
  mockMkdir: vi.fn(),
  mockReadFile: vi.fn(),
  mockWriteFile: vi.fn(),
}));

vi.mock('fs/promises', () => ({
  mkdir: mockMkdir,
  readFile: mockReadFile,
  writeFile: mockWriteFile,
}));

import { saveVideo, getVideoPath, VIDEOS_DIR } from '../storage.js';

describe('saveVideo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMkdir.mockResolvedValue(undefined);
    mockReadFile.mockResolvedValue(Buffer.from('video-data'));
    mockWriteFile.mockResolvedValue(undefined);
  });

  it('creates directory recursively', async () => {
    await saveVideo('run-123', 'desktop', '/tmp/video.webm');
    expect(mockMkdir).toHaveBeenCalledWith(
      expect.stringContaining('run-123'),
      { recursive: true },
    );
  });

  it('reads source file and writes to destination', async () => {
    await saveVideo('run-123', 'desktop', '/tmp/video.webm');
    expect(mockReadFile).toHaveBeenCalledWith('/tmp/video.webm');
    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.stringContaining('desktop.webm'),
      Buffer.from('video-data'),
    );
  });

  it('returns relative path testRunId/viewport.webm', async () => {
    const result = await saveVideo('run-123', 'desktop', '/tmp/video.webm');
    expect(result).toBe('run-123/desktop.webm');
  });

  it('handles different viewport names', async () => {
    const result = await saveVideo('run-456', 'mobile', '/tmp/m.webm');
    expect(result).toBe('run-456/mobile.webm');
    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.stringContaining('mobile.webm'),
      expect.any(Buffer),
    );
  });
});

describe('getVideoPath', () => {
  it('returns absolute path with VIDEOS_DIR prefix', () => {
    const result = getVideoPath('run-123/desktop.webm');
    expect(result).toBe(`${VIDEOS_DIR}/run-123/desktop.webm`);
  });

  it('joins VIDEOS_DIR with relative path correctly', () => {
    const result = getVideoPath('abc/mobile.webm');
    expect(result).toContain(VIDEOS_DIR);
    expect(result).toContain('abc/mobile.webm');
  });
});
