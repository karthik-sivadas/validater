import PQueue from 'p-queue';

/**
 * Create a rate-limited API request queue.
 *
 * Uses p-queue to enforce concurrency and interval-based rate limits,
 * preventing 429 errors from the Anthropic API.
 *
 * Default options are conservative for Tier 1 (50 RPM):
 * - concurrency: 5 parallel requests
 * - intervalCap: 40 requests per interval
 * - interval: 60 seconds
 *
 * Can be tuned up for higher API tiers.
 */
export function createApiQueue(options?: {
  concurrency?: number;
  intervalMs?: number;
  intervalCap?: number;
}): PQueue {
  return new PQueue({
    concurrency: options?.concurrency ?? 5,
    interval: options?.intervalMs ?? 60_000,
    intervalCap: options?.intervalCap ?? 40,
  });
}

/**
 * Execute a function through the rate-limited queue.
 *
 * Wraps an async function so it respects the queue's concurrency
 * and interval limits. Errors from the function propagate normally.
 */
export async function queuedRequest<T>(
  queue: PQueue,
  fn: () => Promise<T>,
): Promise<T> {
  const result = await queue.add(fn);
  return result as T;
}

/**
 * Default singleton API queue shared across the application.
 *
 * Ensures all API calls share the same rate limit regardless of
 * where they originate. Can be overridden by creating a custom
 * queue via createApiQueue().
 */
export const defaultApiQueue: PQueue = createApiQueue();
