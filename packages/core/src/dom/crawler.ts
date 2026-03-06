import type { Page } from 'playwright';
import type { CrawlOptions, CrawlResult } from '../types/dom.js';

/**
 * Crawl a page using a Playwright Page object.
 *
 * The caller manages browser/context lifecycle -- this function only handles
 * navigation and extraction. This keeps @validater/core free of browser
 * instantiation concerns (Phase 3 handles browser pools).
 */
export async function crawlPage(
  page: Page,
  options: CrawlOptions,
): Promise<CrawlResult> {
  const viewport = options.viewport ?? { width: 1280, height: 720 };
  const waitUntil = options.waitUntil ?? 'networkidle';
  const timeout = options.timeout ?? 30000;

  await page.setViewportSize(viewport);

  try {
    await page.goto(options.url, { waitUntil, timeout });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to crawl ${options.url}: ${message}`);
  }

  const [html, ariaSnapshot, title] = await Promise.all([
    page.evaluate(() => document.body.outerHTML),
    page.locator('body').ariaSnapshot(),
    page.title(),
  ]);

  return {
    html,
    ariaSnapshot,
    title,
    url: options.url,
    viewport,
  };
}
