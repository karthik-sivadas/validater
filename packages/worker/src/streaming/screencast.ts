import type { Page } from 'playwright';
import type { ScreencastFrame } from './types.js';

/**
 * Start CDP screencast on a Playwright page.
 *
 * Attaches a CDPSession, listens for Page.screencastFrame events,
 * acknowledges each frame immediately (to prevent backpressure stalling),
 * then delivers the frame via the onFrame callback.
 *
 * @returns A cleanup function that stops the screencast and detaches the CDP session.
 */
export async function startScreencast(
  page: Page,
  onFrame: (frame: ScreencastFrame) => void,
): Promise<() => Promise<void>> {
  const cdp = await page.context().newCDPSession(page);

  cdp.on('Page.screencastFrame', (payload) => {
    // CRITICAL: Acknowledge the frame IMMEDIATELY to prevent backpressure stalling.
    // This allows CDP to continue sending frames while we process asynchronously.
    cdp.send('Page.screencastFrameAck', { sessionId: payload.sessionId }).catch(() => {});

    // Map CDP payload to our ScreencastFrame type
    const frame: ScreencastFrame = {
      data: payload.data,
      sessionId: payload.sessionId,
      metadata: payload.metadata,
    };
    onFrame(frame);
  });

  await cdp.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 80,
    maxWidth: 1280,
    maxHeight: 720,
    everyNthFrame: 1,
  });

  return async () => {
    try {
      await cdp.send('Page.stopScreencast');
      await cdp.detach();
    } catch {
      // Page may already be closed -- safe to ignore
    }
  };
}
