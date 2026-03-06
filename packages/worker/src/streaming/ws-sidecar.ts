import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { createNodeWebSocket } from '@hono/node-ws';
import { Redis } from 'ioredis';

/**
 * Start the WebSocket sidecar server.
 *
 * Creates a Hono app with:
 *   - CORS headers for cross-origin WebSocket connections
 *   - GET /health health check endpoint
 *   - GET /stream/:testRunId WebSocket endpoint that subscribes to Redis
 *     and relays StreamMessage JSON to connected clients
 *
 * Each WebSocket connection gets its own Redis subscriber instance
 * (ioredis requires separate connections for pub/sub).
 */
export function startWsSidecar(port?: number): void {
  const app = new Hono();
  const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

  const corsOrigin = process.env.WS_CORS_ORIGIN ?? 'http://localhost:3000';

  // CORS middleware for all responses
  app.use('*', async (c, next) => {
    await next();
    c.header('Access-Control-Allow-Origin', corsOrigin);
  });

  // Health check
  app.get('/health', (c) => {
    return c.json({ status: 'ok' });
  });

  // WebSocket route: each connection subscribes to a Redis channel for the test run
  app.get(
    '/stream/:testRunId',
    upgradeWebSocket((c) => {
      const testRunId = c.req.param('testRunId');
      let subscriber: Redis | null = null;

      return {
        onOpen(_event, ws) {
          subscriber = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
          const channel = `stream:${testRunId}`;

          subscriber.subscribe(channel).catch((err: Error) => {
            console.error(`Redis subscribe error for ${channel}:`, err);
          });

          subscriber.on('message', (_ch: string, message: string) => {
            ws.send(message);
          });

          subscriber.on('error', (err: Error) => {
            console.error(`Redis subscriber error for ${channel}:`, err);
          });
        },

        onClose() {
          if (subscriber) {
            subscriber.unsubscribe().catch(() => {});
            subscriber.disconnect();
            subscriber = null;
          }
        },

        onError() {
          if (subscriber) {
            subscriber.unsubscribe().catch(() => {});
            subscriber.disconnect();
            subscriber = null;
          }
        },
      };
    }),
  );

  const actualPort = port ?? 3001;
  const server = serve({ fetch: app.fetch, port: actualPort });
  injectWebSocket(server);

  console.log(`WebSocket sidecar started on port ${actualPort}`);
}
