import { describe, it, expect } from 'vitest';
import { createApiQueue, queuedRequest, defaultApiQueue } from '../rate-limiter.js';
import PQueue from 'p-queue';

describe('createApiQueue', () => {
  it('creates a PQueue instance with defaults', () => {
    const queue = createApiQueue();
    expect(queue).toBeInstanceOf(PQueue);
    expect(queue.concurrency).toBe(5);
  });

  it('respects custom options', () => {
    const queue = createApiQueue({ concurrency: 2, intervalMs: 30_000, intervalCap: 10 });
    expect(queue.concurrency).toBe(2);
  });
});

describe('queuedRequest', () => {
  it('wraps an async function through the queue and returns result', async () => {
    const queue = createApiQueue();
    const result = await queuedRequest(queue, async () => 42);
    expect(result).toBe(42);
  });

  it('propagates errors from the queued function', async () => {
    const queue = createApiQueue();
    await expect(
      queuedRequest(queue, async () => {
        throw new Error('test error');
      }),
    ).rejects.toThrow('test error');
  });

  it('returns complex objects correctly', async () => {
    const queue = createApiQueue();
    const obj = { steps: [1, 2, 3], reasoning: 'ok' };
    const result = await queuedRequest(queue, async () => obj);
    expect(result).toEqual(obj);
  });
});

describe('defaultApiQueue', () => {
  it('is a PQueue instance', () => {
    expect(defaultApiQueue).toBeInstanceOf(PQueue);
  });

  it('has default concurrency of 5', () => {
    expect(defaultApiQueue.concurrency).toBe(5);
  });
});
