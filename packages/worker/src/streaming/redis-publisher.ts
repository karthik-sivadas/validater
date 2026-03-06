import { Redis } from 'ioredis';
import type { ScreencastFrame, StepEvent, StreamMessage } from './types.js';
import { channelName } from './types.js';

let _publisher: Redis | null = null;

/**
 * Get the singleton Redis publisher connection.
 * Lazily creates the connection on first call.
 */
export function getRedisPublisher(): Redis {
  if (!_publisher) {
    _publisher = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
    _publisher.on('error', (err: Error) => {
      console.error('Redis publisher error:', err);
    });
  }
  return _publisher;
}

/**
 * Publish a screencast frame to the Redis channel for a test run.
 * Only sends the base64 data (not metadata) to minimize message size.
 */
export async function publishFrame(testRunId: string, frame: ScreencastFrame): Promise<void> {
  const msg: StreamMessage = {
    type: 'frame',
    testRunId,
    timestamp: Date.now(),
    payload: { data: frame.data },
  };
  await getRedisPublisher().publish(channelName(testRunId), JSON.stringify(msg));
}

/**
 * Publish a step completion event to the Redis channel for a test run.
 */
export async function publishStepEvent(testRunId: string, event: StepEvent): Promise<void> {
  const msg: StreamMessage = {
    type: 'step-complete',
    testRunId,
    timestamp: Date.now(),
    payload: event,
  };
  await getRedisPublisher().publish(channelName(testRunId), JSON.stringify(msg));
}

/**
 * Publish a stream-end signal to notify clients the test run is complete.
 */
export async function publishStreamEnd(testRunId: string): Promise<void> {
  const msg: StreamMessage = {
    type: 'stream-end',
    testRunId,
    timestamp: Date.now(),
    payload: null,
  };
  await getRedisPublisher().publish(channelName(testRunId), JSON.stringify(msg));
}

/**
 * Disconnect the Redis publisher and release the connection.
 */
export async function shutdownRedis(): Promise<void> {
  if (_publisher) {
    _publisher.disconnect();
    _publisher = null;
  }
}
