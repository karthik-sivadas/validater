import { chromium } from 'playwright';
import { crawlPage, simplifyDom } from '@validater/core';
import type { CrawlOptions, SimplifiedDom, CrawlResult } from '@validater/core';

/**
 * Temporal activity: Crawl a page and produce a simplified DOM representation.
 *
 * Manages browser lifecycle (launch/close) with a finally block for cleanup.
 * Phase 3 will replace this with browser pool management.
 */
export async function crawlDom(
  options: CrawlOptions,
): Promise<{ crawlResult: CrawlResult; simplified: SimplifiedDom }> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const crawlResult = await crawlPage(page, options);
    const simplified = simplifyDom(crawlResult.html, {
      maxTokenEstimate: 15000,
      includeAriaSnapshot: crawlResult.ariaSnapshot,
    });
    return { crawlResult, simplified };
  } finally {
    await browser.close();
  }
}
