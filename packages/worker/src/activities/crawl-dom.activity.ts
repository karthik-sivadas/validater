import { crawlPage, simplifyDom } from '@validater/core';
import type { CrawlOptions, SimplifiedDom, CrawlResult } from '@validater/core';
import { getDefaultPool } from '../browser/pool.js';
import { heartbeat } from '@temporalio/activity';

/**
 * Temporal activity: Crawl a page and produce a simplified DOM representation.
 *
 * Acquires a pooled browser, creates an isolated BrowserContext,
 * runs the crawl, and returns the simplified DOM.
 *
 * Browser acquire/release and context lifecycle are guaranteed via
 * nested try/finally -- no leaked resources even on crawl failure.
 */
export async function crawlDom(
  options: CrawlOptions,
): Promise<{ crawlResult: CrawlResult; simplified: SimplifiedDom }> {
  const pool = getDefaultPool();
  const pooled = await pool.acquire();

  try {
    const context = await pooled.browser.newContext();

    try {
      const page = await context.newPage();
      const crawlResult = await crawlPage(page, options);
      heartbeat('page crawled');
      const simplified = simplifyDom(crawlResult.html, {
        maxTokenEstimate: 15000,
        includeAriaSnapshot: crawlResult.ariaSnapshot,
      });
      return { crawlResult, simplified };
    } finally {
      await context.close();
    }
  } finally {
    pooled.pagesProcessed++;
    await pool.release(pooled);
  }
}
