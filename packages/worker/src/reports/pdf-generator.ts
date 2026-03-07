import type { Browser } from "playwright";

/**
 * Convert a fully rendered HTML report string into a PDF buffer
 * using a fresh Playwright Chromium instance.
 *
 * Uses a simple launch/close (not the browser pool) since PDF generation
 * is infrequent and the pool is configured for test execution.
 */
export async function generatePdfReport(htmlContent: string): Promise<Buffer> {
  let browser: Browser | null = null;

  try {
    const pw = await import("playwright");
    browser = await pw.chromium.launch({ headless: true });

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "networkidle" });
    await page.emulateMedia({ media: "print" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      margin: { top: "1cm", right: "1cm", bottom: "1cm", left: "1cm" },
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate:
        '<div style="font-size:8px;text-align:center;width:100%">Validater Test Report</div>',
      footerTemplate:
        '<div style="font-size:8px;text-align:center;width:100%"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
    });

    return Buffer.from(pdfBuffer);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
