export interface MemoryConfig {
  /** Maximum RSS in bytes before marking unhealthy (default 1.5 GB) */
  maxRssBytes?: number;
  /** Maximum heap usage percentage before marking unhealthy (default 0.9 = 90%) */
  maxHeapPercentage?: number;
}

export interface MemoryHealth {
  healthy: boolean;
  rssBytes: number;
  heapUsedBytes: number;
  heapTotalBytes: number;
  heapPercentage: number;
}

const DEFAULT_MAX_RSS_BYTES = 1.5 * 1024 * 1024 * 1024; // 1.5 GB
const DEFAULT_MAX_HEAP_PERCENTAGE = 0.9; // 90%

/**
 * Check current process memory health against configurable thresholds.
 *
 * Used by the browser pool's validate function to prevent acquiring
 * browsers when the worker process is under memory pressure.
 */
export function checkMemoryHealth(config?: MemoryConfig): MemoryHealth {
  const maxRssBytes = config?.maxRssBytes ?? DEFAULT_MAX_RSS_BYTES;
  const maxHeapPercentage = config?.maxHeapPercentage ?? DEFAULT_MAX_HEAP_PERCENTAGE;

  const usage = process.memoryUsage();
  const heapPercentage = usage.heapUsed / usage.heapTotal;

  return {
    healthy: usage.rss < maxRssBytes && heapPercentage < maxHeapPercentage,
    rssBytes: usage.rss,
    heapUsedBytes: usage.heapUsed,
    heapTotalBytes: usage.heapTotal,
    heapPercentage,
  };
}
