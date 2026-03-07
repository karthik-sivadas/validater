import { vi, describe, it, expect, afterEach } from 'vitest';
import { checkMemoryHealth } from '../memory-monitor.js';

describe('checkMemoryHealth', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns healthy=true when RSS and heap are within defaults', () => {
    vi.spyOn(process, 'memoryUsage').mockReturnValue({
      rss: 500 * 1024 * 1024, // 500 MB (under 1.5 GB)
      heapUsed: 200 * 1024 * 1024,
      heapTotal: 400 * 1024 * 1024, // 50% (under 90%)
      external: 0,
      arrayBuffers: 0,
    });

    const result = checkMemoryHealth();
    expect(result.healthy).toBe(true);
  });

  it('returns healthy=false when RSS exceeds maxRssBytes', () => {
    vi.spyOn(process, 'memoryUsage').mockReturnValue({
      rss: 2 * 1024 * 1024 * 1024, // 2 GB (over 1.5 GB default)
      heapUsed: 100 * 1024 * 1024,
      heapTotal: 400 * 1024 * 1024,
      external: 0,
      arrayBuffers: 0,
    });

    const result = checkMemoryHealth();
    expect(result.healthy).toBe(false);
  });

  it('returns healthy=false when heap percentage exceeds maxHeapPercentage', () => {
    vi.spyOn(process, 'memoryUsage').mockReturnValue({
      rss: 500 * 1024 * 1024, // 500 MB (within default)
      heapUsed: 380 * 1024 * 1024,
      heapTotal: 400 * 1024 * 1024, // 95% (over 90% default)
      external: 0,
      arrayBuffers: 0,
    });

    const result = checkMemoryHealth();
    expect(result.healthy).toBe(false);
  });

  it('respects custom maxRssBytes threshold', () => {
    vi.spyOn(process, 'memoryUsage').mockReturnValue({
      rss: 600 * 1024 * 1024, // 600 MB
      heapUsed: 100 * 1024 * 1024,
      heapTotal: 400 * 1024 * 1024,
      external: 0,
      arrayBuffers: 0,
    });

    // Custom 500 MB limit -> unhealthy
    const unhealthy = checkMemoryHealth({ maxRssBytes: 500 * 1024 * 1024 });
    expect(unhealthy.healthy).toBe(false);

    // Custom 700 MB limit -> healthy
    const healthy = checkMemoryHealth({ maxRssBytes: 700 * 1024 * 1024 });
    expect(healthy.healthy).toBe(true);
  });

  it('respects custom maxHeapPercentage threshold', () => {
    vi.spyOn(process, 'memoryUsage').mockReturnValue({
      rss: 500 * 1024 * 1024,
      heapUsed: 300 * 1024 * 1024,
      heapTotal: 400 * 1024 * 1024, // 75%
      external: 0,
      arrayBuffers: 0,
    });

    // Custom 70% limit -> unhealthy
    const unhealthy = checkMemoryHealth({ maxHeapPercentage: 0.7 });
    expect(unhealthy.healthy).toBe(false);

    // Custom 80% limit -> healthy
    const healthy = checkMemoryHealth({ maxHeapPercentage: 0.8 });
    expect(healthy.healthy).toBe(true);
  });

  it('returns correct rssBytes/heapUsedBytes/heapTotalBytes/heapPercentage', () => {
    vi.spyOn(process, 'memoryUsage').mockReturnValue({
      rss: 1024 * 1024 * 100,
      heapUsed: 1024 * 1024 * 50,
      heapTotal: 1024 * 1024 * 200,
      external: 0,
      arrayBuffers: 0,
    });

    const result = checkMemoryHealth();
    expect(result.rssBytes).toBe(1024 * 1024 * 100);
    expect(result.heapUsedBytes).toBe(1024 * 1024 * 50);
    expect(result.heapTotalBytes).toBe(1024 * 1024 * 200);
    expect(result.heapPercentage).toBeCloseTo(0.25);
  });
});
