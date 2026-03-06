# Phase 6: Live Streaming and Real-Time Updates - Research

**Researched:** 2026-03-07
**Domain:** CDP Screencast, WebSocket streaming, Redis pub/sub, real-time browser visualization
**Confidence:** MEDIUM

## Summary

Phase 6 adds live browser streaming during test execution so users can watch what the browser is doing in real-time, alongside a synchronized step log. This requires three interconnected systems: (1) capturing browser frames via Chrome DevTools Protocol (CDP) screencast in the worker process, (2) a pub/sub transport layer (Redis) to move frames from worker to frontend, and (3) a WebSocket sidecar server to push frames to the browser client.

The standard approach is to use Playwright's CDPSession API to call `Page.startScreencast`, which delivers JPEG frames as base64 strings at a controllable rate. These frames are published to Redis pub/sub channels keyed by test run ID. A lightweight Hono WebSocket sidecar (separate from the TanStack Start app) subscribes to Redis and relays frames to connected browser clients. TanStack Start does NOT natively support WebSockets -- the sidecar architecture is mandatory, not optional.

The key architectural decision is where to run the WebSocket sidecar. It should run as a standalone Hono server on a separate port (e.g., 3001), started alongside the worker process. This avoids fighting TanStack Start's Nitro/srvx runtime and keeps concerns cleanly separated. The frontend connects to the sidecar's WebSocket URL directly.

**Primary recommendation:** Use CDP `Page.startScreencast` (JPEG, quality 60, 1280x720, everyNthFrame 2) -> Redis pub/sub -> Hono WebSocket sidecar on port 3001 -> browser `<img>` tag with base64 src updates.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Playwright CDPSession | ^1.58.2 (already installed) | Capture browser frames via CDP | Built-in to Playwright, no extra deps needed |
| ioredis | ^5.10 | Redis client for pub/sub transport | Most popular Redis client for Node.js, full pub/sub support |
| hono | ^4.x | WebSocket sidecar server framework | Lightweight, modern, built for Node.js servers |
| @hono/node-server | ^1.19 | Node.js HTTP server for Hono | Official Node.js adapter for Hono |
| @hono/node-ws | ^1.3 | WebSocket support for Hono on Node.js | Official WebSocket adapter, integrates with ws under the hood |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Redis (container) | 7-alpine | Pub/sub message broker | Required infrastructure -- add to docker-compose.yml |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Redis pub/sub | In-process EventEmitter | Only works if worker and WS sidecar are in same process. Redis allows separation and horizontal scaling |
| Hono WebSocket sidecar | Nitro/TanStack Start native WS | TanStack Start does NOT support WebSockets natively. The architecture is transitioning from Nitro to srvx and WS support is broken/absent |
| Hono WebSocket sidecar | Raw `ws` library | Hono adds routing, middleware, and structured handlers. Worth the tiny overhead |
| CDP screencast | Periodic screenshot polling | Screencast gives smooth 5-15 FPS feed; polling at best gives 1-2 FPS with higher CPU cost |
| WebSocket binary frames | Base64 JSON messages | Binary is 30% more efficient but adds complexity. At 60-100KB/frame JPEG, base64 JSON is acceptable for single-viewer scenarios |

**Installation (worker package):**
```bash
cd packages/worker
pnpm add ioredis hono @hono/node-server @hono/node-ws
```

**Installation (web package):**
No additional dependencies needed -- browser native WebSocket API suffices.

**Infrastructure (docker-compose.yml):**
```yaml
redis:
  image: redis:7-alpine
  ports:
    - "6379:6379"
  volumes:
    - redis_data:/data
```

## Architecture Patterns

### Recommended Project Structure
```
packages/worker/src/
  streaming/
    screencast.ts          # CDP screencast start/stop/frame handler
    redis-publisher.ts     # Publish frames + step events to Redis
    ws-sidecar.ts          # Hono WebSocket server (port 3001)
    types.ts               # StreamMessage, ScreencastFrame types
  activities/
    execute-steps.activity.ts  # Modified: accepts optional onFrame/onStep callbacks
  browser/
    pool.ts                # No changes needed

packages/web/src/
  hooks/
    use-live-stream.ts     # WebSocket connection + reconnect logic
  components/
    live-viewer.tsx         # Browser frame display + step log
  routes/_authed/
    dashboard.tsx          # Modified: shows live viewer during execution
```

### Pattern 1: CDP Screencast Capture
**What:** Attach a CDPSession to the Playwright page during test execution and stream JPEG frames
**When to use:** During the `executing` phase of a test run
**Example:**
```typescript
// Source: Playwright CDPSession docs + CDP Page domain spec
import type { Page } from 'playwright';

interface ScreencastFrame {
  data: string;       // base64 JPEG
  sessionId: number;  // must be ack'd
  metadata: {
    offsetTop: number;
    pageScaleFactor: number;
    deviceWidth: number;
    deviceHeight: number;
    scrollOffsetX: number;
    scrollOffsetY: number;
    timestamp: number;
  };
}

async function startScreencast(
  page: Page,
  onFrame: (frame: ScreencastFrame) => void,
): Promise<() => Promise<void>> {
  const cdp = await page.context().newCDPSession(page);

  cdp.on('Page.screencastFrame', async (frame: ScreencastFrame) => {
    // Acknowledge frame immediately to allow next frame delivery
    await cdp.send('Page.screencastFrameAck', { sessionId: frame.sessionId });
    onFrame(frame);
  });

  await cdp.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 60,
    maxWidth: 1280,
    maxHeight: 720,
    everyNthFrame: 2,
  });

  return async () => {
    try {
      await cdp.send('Page.stopScreencast');
      await cdp.detach();
    } catch {
      // Page may already be closed
    }
  };
}
```

### Pattern 2: Redis Pub/Sub Channel per Test Run
**What:** Each test run gets a dedicated Redis channel for streaming events
**When to use:** Worker publishes frames and step events; WS sidecar subscribes and relays
**Example:**
```typescript
// Source: ioredis pub/sub documentation
import Redis from 'ioredis';

// IMPORTANT: ioredis requires SEPARATE connections for pub and sub
const publisher = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');

interface StreamMessage {
  type: 'frame' | 'step-start' | 'step-complete' | 'stream-end';
  testRunId: string;
  timestamp: number;
  payload: unknown; // ScreencastFrame | StepEvent | EndEvent
}

function channelName(testRunId: string): string {
  return `stream:${testRunId}`;
}

async function publishFrame(testRunId: string, frame: ScreencastFrame): Promise<void> {
  const msg: StreamMessage = {
    type: 'frame',
    testRunId,
    timestamp: Date.now(),
    payload: { data: frame.data }, // Only send base64 data, not metadata
  };
  await publisher.publish(channelName(testRunId), JSON.stringify(msg));
}
```

### Pattern 3: Hono WebSocket Sidecar
**What:** Standalone Hono server on port 3001 that upgrades HTTP to WebSocket
**When to use:** Run alongside the worker process
**Example:**
```typescript
// Source: Hono WebSocket Helper docs + @hono/node-ws
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { createNodeWebSocket } from '@hono/node-ws';
import Redis from 'ioredis';

const app = new Hono();
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

app.get('/stream/:testRunId', upgradeWebSocket((c) => {
  const testRunId = c.req.param('testRunId');
  let subscriber: Redis | null = null;

  return {
    onOpen(_event, ws) {
      subscriber = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
      const channel = `stream:${testRunId}`;

      subscriber.subscribe(channel);
      subscriber.on('message', (_ch, message) => {
        ws.send(message);
      });
    },
    onClose() {
      if (subscriber) {
        subscriber.unsubscribe();
        subscriber.disconnect();
        subscriber = null;
      }
    },
  };
}));

const server = serve({ fetch: app.fetch, port: 3001 });
injectWebSocket(server);
```

### Pattern 4: Client-Side WebSocket with Auto-Reconnect
**What:** React hook that connects to the WS sidecar and handles reconnection
**When to use:** In the live viewer component during test execution
**Example:**
```typescript
// Source: Browser WebSocket API + exponential backoff pattern
function useLiveStream(testRunId: string | null) {
  const [frame, setFrame] = useState<string | null>(null);
  const [steps, setSteps] = useState<StepEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);

  useEffect(() => {
    if (!testRunId) return;
    const maxRetries = 10;
    const baseDelay = 500; // ms

    function connect() {
      const ws = new WebSocket(`ws://localhost:3001/stream/${testRunId}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        retriesRef.current = 0;
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'frame') {
          setFrame(msg.payload.data); // base64 JPEG
        } else if (msg.type === 'step-complete') {
          setSteps(prev => [...prev, msg.payload]);
        } else if (msg.type === 'stream-end') {
          ws.close();
        }
      };

      ws.onclose = () => {
        setConnected(false);
        // Exponential backoff reconnect
        if (retriesRef.current < maxRetries) {
          const delay = Math.min(baseDelay * 2 ** retriesRef.current, 30000);
          const jitter = Math.random() * 500;
          retriesRef.current++;
          setTimeout(connect, delay + jitter);
        }
      };
    }

    connect();
    return () => { wsRef.current?.close(); };
  }, [testRunId]);

  return { frame, steps, connected };
}
```

### Anti-Patterns to Avoid
- **Polling for frames:** Do NOT use setInterval + fetch to poll for screenshots. CDP screencast is push-based and far more efficient.
- **WebSocket in TanStack Start:** Do NOT try to add WebSocket handlers to the TanStack Start server. The framework does not support it (srvx/h3 v2 transition broke WebSocket support). Use a separate sidecar.
- **Single Redis connection for pub+sub:** ioredis requires SEPARATE Redis connections for publishing and subscribing. A subscriber connection enters subscriber mode and can no longer send regular commands.
- **Sending full-resolution PNGs:** PNG screenshots are 10-50x larger than JPEG at quality 60. Always use JPEG format for screencast frames.
- **Unbounded step log growth:** If steps accumulate in React state without bounds, memory grows. Cap the step list or use windowed rendering.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Browser frame capture | Manual screenshot polling loop | CDP `Page.startScreencast` | Built-in flow control via ack, configurable quality/resolution/rate |
| WebSocket server | Raw `http.createServer` + `ws` | Hono + `@hono/node-ws` | Routing, middleware, structured handlers, connection management |
| Redis pub/sub | Custom TCP messaging between processes | ioredis pub/sub | Battle-tested, handles reconnect, buffering, binary messages |
| WebSocket reconnection | Custom retry logic from scratch | Exponential backoff with jitter pattern | Well-documented pattern, prevent thundering herd |
| Frame rate throttling | Custom timer-based throttling | CDP `everyNthFrame` parameter | Built into the protocol, no extra code needed |

**Key insight:** The entire streaming pipeline is composed of well-understood building blocks (CDP, Redis, WebSocket). The challenge is wiring them together correctly, not inventing new technology.

## Common Pitfalls

### Pitfall 1: CDP Session Invalidation on Page Navigation
**What goes wrong:** CDPSession becomes invalid when the page navigates, causing the screencast to silently stop
**Why it happens:** CDP sessions are bound to a specific page target. Navigation creates a new target.
**How to avoid:** Re-create the CDPSession after any `page.goto()` call. In the execute-steps flow, start screencast AFTER the initial navigation, and handle the case where a test step triggers a navigation (action: 'navigate').
**Warning signs:** Frames stop arriving mid-execution despite the test still running.

### Pitfall 2: Frame Acknowledgment Backpressure
**What goes wrong:** If the frame handler is slow (e.g., Redis publish takes time), CDP stops sending frames because the previous frame wasn't acknowledged
**Why it happens:** CDP requires explicit `Page.screencastFrameAck` before sending the next frame
**How to avoid:** Acknowledge the frame IMMEDIATELY before any async work (Redis publish). Process the frame asynchronously after ack.
**Warning signs:** Frame rate drops to near-zero or frames arrive in bursts.

### Pitfall 3: Redis Subscriber Connection Leak
**What goes wrong:** Each WebSocket connection creates a Redis subscriber. If the WebSocket closes without cleaning up, the Redis connection leaks.
**Why it happens:** The `onClose` handler isn't called in all edge cases (browser tab close, network drop)
**How to avoid:** Use a `try/finally` pattern. Track subscribers with a WeakMap or cleanup timer. Set a Redis connection timeout.
**Warning signs:** Redis connection count grows over time (`CLIENT LIST` shows many subscribers).

### Pitfall 4: Chromium-Only CDP Support
**What goes wrong:** CDP screencast only works with Chromium. Firefox and WebKit browsers don't support it.
**Why it happens:** CDP is a Chromium-specific protocol.
**How to avoid:** The browser pool already launches Chromium (`chromium.launch()`), so this is not an immediate problem. But document the limitation and ensure the UI shows a "live view not available" message if a non-Chromium browser is ever used.
**Warning signs:** CDPSession creation fails silently.

### Pitfall 5: TanStack Start Does Not Support WebSockets
**What goes wrong:** Attempting to add WebSocket routes to the TanStack Start server fails
**Why it happens:** TanStack Start is transitioning from Nitro/Vinxi to srvx + h3 v2. WebSocket support in h3 v2's `defineWebSocketHandler` exists but srvx doesn't handle the `.crossws` property on responses, so the upgrade never happens.
**How to avoid:** Use a completely separate Hono WebSocket server on a different port. Do NOT attempt to integrate WebSockets into TanStack Start.
**Warning signs:** WebSocket upgrade returns 404 or the connection immediately closes.

### Pitfall 6: CORS Between TanStack Start and WebSocket Sidecar
**What goes wrong:** Browser blocks WebSocket connection to port 3001 because the page is served from port 3000
**Why it happens:** Cross-origin WebSocket connections require proper CORS headers on the upgrade response
**How to avoid:** Add CORS middleware to the Hono sidecar allowing `http://localhost:3000` origin. Note: WebSocket itself doesn't have CORS restrictions, but the initial HTTP upgrade request does in some browsers.
**Warning signs:** WebSocket connection fails with CORS error in browser console.

## Code Examples

### CDP Screencast Integration in Execute Steps Activity
```typescript
// Modified execute-steps activity with optional streaming support
// Source: Playwright CDPSession API + existing executeStepsActivity pattern

export interface ExecuteStepsParams {
  url: string;
  steps: TestStep[];
  viewport: ViewportConfig;
  config?: ExecutionConfig;
  streamingConfig?: {
    testRunId: string;
    enabled: boolean;
  };
}

export async function executeStepsActivity(params: ExecuteStepsParams): Promise<ExecutionResult> {
  const startTime = new Date().toISOString();
  const pool = getDefaultPool();
  const pooled = await pool.acquire();

  try {
    const context = await pooled.browser.newContext({
      viewport: { width: params.viewport.width, height: params.viewport.height },
      deviceScaleFactor: params.viewport.deviceScaleFactor,
      isMobile: params.viewport.isMobile,
      hasTouch: params.viewport.hasTouch,
    });

    try {
      const page = await context.newPage();

      await page.goto(params.url, {
        waitUntil: 'networkidle',
        timeout: params.config?.navigationTimeoutMs ?? 30_000,
      });

      // Start screencast if streaming is enabled
      let stopScreencast: (() => Promise<void>) | null = null;
      if (params.streamingConfig?.enabled) {
        stopScreencast = await startScreencast(page, (frame) => {
          // Fire-and-forget publish to Redis
          publishFrame(params.streamingConfig!.testRunId, frame).catch(() => {});
        });
      }

      const stepResults = await executeSteps(page, params.steps, params.config, {
        onStepComplete: params.streamingConfig?.enabled
          ? (stepResult) => {
              publishStepEvent(params.streamingConfig!.testRunId, stepResult).catch(() => {});
            }
          : undefined,
      });

      // Stop screencast
      if (stopScreencast) {
        await stopScreencast();
      }

      return {
        viewport: params.viewport.name,
        url: params.url,
        stepResults,
        totalDurationMs: stepResults.reduce((sum, r) => sum + r.durationMs, 0),
        startedAt: startTime,
        completedAt: new Date().toISOString(),
      };
    } finally {
      await context.close();
    }
  } finally {
    pooled.pagesProcessed++;
    await pool.release(pooled);
  }
}
```

### Live Viewer Component Layout
```tsx
// Source: Application architecture pattern
function LiveViewer({ testRunId }: { testRunId: string }) {
  const { frame, steps, connected } = useLiveStream(testRunId);

  return (
    <div className="grid grid-cols-3 gap-4">
      {/* Browser feed - 2/3 width */}
      <div className="col-span-2 relative">
        {connected && (
          <span className="absolute top-2 right-2 flex items-center gap-1 text-xs">
            <span className="size-2 rounded-full bg-red-500 animate-pulse" />
            LIVE
          </span>
        )}
        {frame ? (
          <img
            src={`data:image/jpeg;base64,${frame}`}
            alt="Live browser view"
            className="w-full rounded-md border"
          />
        ) : (
          <div className="aspect-video bg-muted rounded-md flex items-center justify-center">
            <span className="text-muted-foreground">Waiting for stream...</span>
          </div>
        )}
      </div>

      {/* Step log - 1/3 width */}
      <div className="col-span-1">
        <ScrollArea className="h-[500px]">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-2 py-1 text-sm border-b">
              <Badge variant={step.status === 'pass' ? 'default' : 'destructive'}>
                {step.status}
              </Badge>
              <span>Step {step.stepOrder}</span>
              <span className="text-xs text-muted-foreground">{step.durationMs}ms</span>
            </div>
          ))}
        </ScrollArea>
      </div>
    </div>
  );
}
```

### Redis Publisher Singleton
```typescript
// Source: ioredis documentation
import Redis from 'ioredis';

let _publisher: Redis | null = null;

export function getRedisPublisher(): Redis {
  if (!_publisher) {
    _publisher = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
    _publisher.on('error', (err) => {
      console.error('Redis publisher error:', err);
    });
  }
  return _publisher;
}

export async function shutdownRedis(): Promise<void> {
  if (_publisher) {
    _publisher.disconnect();
    _publisher = null;
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Periodic screenshot polling | CDP Page.startScreencast | Available since Chrome 50+ | Smooth real-time feed with backpressure control |
| WebSocket in app server | Separate WebSocket sidecar | TanStack Start dropped Nitro runtime | Must run separate server for WS |
| SSE for binary data | WebSocket for binary data | Always | WebSocket supports binary natively; SSE requires base64 (33% overhead) |
| Vinxi/Nitro WS handlers | h3 v2 + crossws (broken in srvx) | TanStack Start architecture change | Cannot use framework WS, must use sidecar |

**Deprecated/outdated:**
- TanStack Start Vinxi/Nitro WebSocket routes: No longer work with current TanStack Start versions
- `page.screenshot()` polling for live feed: Replaced by CDP screencast which is purpose-built for this

## Open Questions

1. **Redis necessity vs in-process approach**
   - What we know: Redis pub/sub is the standard pattern for cross-process messaging. The worker and WS sidecar could potentially run in the same process, using EventEmitter instead of Redis.
   - What's unclear: Whether the added complexity of Redis (container, connections, cleanup) is justified for a single-user development scenario vs. production multi-worker scaling.
   - Recommendation: Use Redis. It's already cheap to add (one container), keeps the architecture clean and scalable, and avoids coupling the WS server lifecycle to the worker process. If Redis is not desired, fall back to in-process EventEmitter with the understanding that WS sidecar must be in-process with the worker.

2. **Frame rate and bandwidth under real usage**
   - What we know: JPEG quality 60 at 1280x720 produces ~50-100KB frames. With `everyNthFrame: 2`, expect ~5-10 FPS. At 10 FPS that's ~500KB-1MB/s per stream.
   - What's unclear: How this performs over slower networks or with multiple concurrent viewers.
   - Recommendation: Start with conservative settings (quality 60, everyNthFrame 2). Add client-side controls to pause/reduce quality if needed in a future iteration.

3. **Authentication on WebSocket sidecar**
   - What we know: The WS sidecar runs on a different port and doesn't share session state with TanStack Start's Better Auth.
   - What's unclear: How to authenticate WebSocket connections to prevent unauthorized access to live streams.
   - Recommendation: Pass a short-lived token as a query parameter on the WebSocket URL. The token can be generated by a TanStack Start server function and verified by the sidecar (e.g., JWT signed with a shared secret, or a simple opaque token stored in Redis with TTL).

4. **WS sidecar deployment topology**
   - What we know: In development, the sidecar runs on port 3001 alongside the worker. In production, it could be a separate service or colocated.
   - What's unclear: Exact production deployment topology.
   - Recommendation: For now, start the sidecar from the worker process entry point (`worker.ts`). This keeps development simple. Production deployment can be refactored later.

## Sources

### Primary (HIGH confidence)
- [Playwright CDPSession API](https://playwright.dev/docs/api/class-cdpsession) - How to create CDP sessions, send commands, listen to events
- [CDP Page Domain Specification](https://chromedevtools.github.io/devtools-protocol/tot/Page/) - Page.startScreencast, screencastFrame, screencastFrameAck parameters and events
- [Hono WebSocket Helper](https://hono.dev/docs/helpers/websocket) - upgradeWebSocket API, event handlers, usage patterns
- [Hono Node.js Getting Started](https://hono.dev/docs/getting-started/nodejs) - serve function, port configuration, Node.js setup

### Secondary (MEDIUM confidence)
- [Vercel agent-browser Screencasting Architecture](https://deepwiki.com/vercel-labs/agent-browser/6.2-screencasting-and-live-preview) - Production screencasting patterns, frame handling, backpressure, JPEG quality settings
- [TanStack Start WebSocket Discussion](https://github.com/TanStack/router/discussions/4576) - Confirmed: WebSocket not natively supported in current TanStack Start
- [ioredis GitHub/npm](https://github.com/redis/ioredis) - v5.10.0, pub/sub with binary message support
- [WebSocket Reconnection Strategies](https://dev.to/hexshift/robust-websocket-reconnection-strategies-in-javascript-with-exponential-backoff-40n1) - Exponential backoff with jitter pattern

### Tertiary (LOW confidence)
- [TanStack Start Websockets blog (nize.ph)](https://nize.ph/blog/tanstack-start-websockets/) - h3/crossws approach, but explicitly deprecated for current TanStack Start versions
- [@hono/node-ws npm](https://www.npmjs.com/package/@hono/node-ws) - Version 1.3.0, 18K+ weekly downloads

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM - CDP screencast and ioredis are well-documented. Hono WS sidecar pattern verified but less commonly documented as a pattern. TanStack Start WS limitation confirmed.
- Architecture: MEDIUM - Pattern is well-understood (CDP -> pub/sub -> WebSocket -> client) but specific integration with this project's Temporal workflow + browser pool requires careful implementation.
- Pitfalls: HIGH - CDP session invalidation, frame ack backpressure, Redis connection management, and TanStack Start WS limitation are all well-documented issues.

**Research date:** 2026-03-07
**Valid until:** 2026-04-06 (30 days - stable technologies, but TanStack Start WS support may change)
