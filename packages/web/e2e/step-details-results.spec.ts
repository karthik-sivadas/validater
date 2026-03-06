/**
 * E2E Tests: Results Page Step Cards
 *
 * Verifies Truth #2: "Results page step cards show action type, description,
 * and clickable screenshot thumbnails"
 *
 * REQUIRES: Full backend stack running AND at least one completed test run
 * with action/description data in the database. Run the live viewer tests
 * first to generate test data.
 */

import { test, expect } from "@playwright/test";

test.describe("Results Page - Step Cards with Action, Description, Screenshots", () => {
  /**
   * Helper: navigate to the most recent completed test run.
   * Goes to /runs, finds a completed run, and clicks into it.
   */
  async function navigateToCompletedRun(page: import("@playwright/test").Page) {
    await page.goto("/runs");

    // Wait for the history table to load
    await expect(page.getByText("Test History")).toBeVisible();

    // Filter to show only completed runs
    const statusSelect = page.locator("button").filter({ hasText: /All Statuses|complete/ });
    if (await statusSelect.isVisible()) {
      await statusSelect.click();
      const completeOption = page.getByRole("option", {
        name: "Complete",
      });
      if (await completeOption.isVisible()) {
        await completeOption.click();
      }
    }

    // Click the first table row (which navigates to /runs/$runId)
    const firstRow = page.locator("tbody tr").first();
    await expect(firstRow).toBeVisible({ timeout: 10_000 });
    await firstRow.click();

    // Wait for the run detail page to load
    await expect(page.getByText("Test Run")).toBeVisible({
      timeout: 10_000,
    });
  }

  test("step cards display action badge, description, and status", async ({
    page,
  }) => {
    await navigateToCompletedRun(page);

    // The detail page has viewport tabs. The first tab is auto-selected.
    // Step cards are rendered inside the active tab content.
    const stepCards = page.locator(".border.border-border.p-4");
    await expect(stepCards.first()).toBeVisible({ timeout: 10_000 });

    // Verify the first step card structure
    const firstCard = stepCards.first();

    // 1. Step order label (e.g., "Step 1")
    await expect(
      firstCard.getByText(/^Step \d+$/)
    ).toBeVisible();

    // 2. Action badge -- inline-flex element with action text
    const actionBadge = firstCard.locator(
      ".inline-flex.items-center.rounded-md.text-xs.font-medium"
    );
    // Action badge may or may not be present (nullable field for backward compat)
    // If present, it should contain a known action type text
    if (await actionBadge.isVisible()) {
      const actionText = await actionBadge.textContent();
      expect(actionText).toBeTruthy();
    }

    // 3. Status badge (pass or fail)
    const statusBadge = firstCard.locator('[data-slot="badge"]');
    await expect(statusBadge).toBeVisible();
    const statusText = await statusBadge.textContent();
    expect(["pass", "fail"]).toContain(statusText);

    // 4. Duration display
    await expect(firstCard.getByText(/\d+ms/)).toBeVisible();

    // 5. Description text (falls back to stepId if description is null)
    const descriptionParagraph = firstCard.locator(
      "p.text-xs.text-muted-foreground"
    );
    await expect(descriptionParagraph.first()).toBeVisible();
    const descText = await descriptionParagraph.first().textContent();
    expect(descText).toBeTruthy();
    expect(descText!.length).toBeGreaterThan(0);
  });

  test("multiple step cards render with different action types", async ({
    page,
  }) => {
    await navigateToCompletedRun(page);

    const stepCards = page.locator(".border.border-border.p-4");
    await expect(stepCards.first()).toBeVisible({ timeout: 10_000 });

    const count = await stepCards.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // Collect action types from all visible step cards
    const actionTypes: string[] = [];
    for (let i = 0; i < count; i++) {
      const card = stepCards.nth(i);
      const actionBadge = card.locator(
        ".inline-flex.items-center.rounded-md.text-xs.font-medium"
      );
      if (await actionBadge.isVisible()) {
        const text = await actionBadge.textContent();
        if (text) actionTypes.push(text.trim());
      }
    }

    // At least some cards should have action badges
    expect(actionTypes.length).toBeGreaterThanOrEqual(1);

    // There should be a navigate action (since every test starts by navigating)
    expect(actionTypes).toContain("navigate");
  });

  test("screenshot thumbnails are visible in step cards", async ({
    page,
  }) => {
    await navigateToCompletedRun(page);

    const stepCards = page.locator(".border.border-border.p-4");
    await expect(stepCards.first()).toBeVisible({ timeout: 10_000 });

    // Look for screenshot images within step cards
    // Screenshots render as <img> inside a <button> with base64 src
    const screenshotImages = page.locator(
      '.border.border-border.p-4 img[alt^="Step"]'
    );

    // At least one step should have a screenshot
    // (Screenshots are captured for every step in the execution pipeline)
    await expect(screenshotImages.first()).toBeVisible({ timeout: 5_000 });

    // Verify the thumbnail has the max-h-48 constraint class
    const firstScreenshot = screenshotImages.first();
    await expect(firstScreenshot).toHaveClass(/max-h-48/);

    // Verify the image src is a base64 data URL (PNG format)
    const src = await firstScreenshot.getAttribute("src");
    expect(src).toMatch(/^data:image\/png;base64,/);
  });

  test("clicking a screenshot thumbnail opens zoom dialog", async ({
    page,
  }) => {
    await navigateToCompletedRun(page);

    const stepCards = page.locator(".border.border-border.p-4");
    await expect(stepCards.first()).toBeVisible({ timeout: 10_000 });

    // Find a step card with a screenshot
    const screenshotButton = page.locator(
      '.border.border-border.p-4 button:has(img[alt^="Step"])'
    );
    await expect(screenshotButton.first()).toBeVisible({
      timeout: 5_000,
    });

    // Click the screenshot thumbnail to open the dialog
    await screenshotButton.first().click();

    // The Dialog should open with a full-size screenshot
    // Dialog uses role="dialog" from base-ui
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // The dialog should contain a full-size image
    const fullSizeImage = dialog.locator(
      'img[alt="Step screenshot full size"]'
    );
    await expect(fullSizeImage).toBeVisible();

    // Full-size image should also be base64
    const fullSrc = await fullSizeImage.getAttribute("src");
    expect(fullSrc).toMatch(/^data:image\/png;base64,/);

    // The dialog should have the sr-only title "Screenshot preview"
    const dialogTitle = dialog.locator(".sr-only");
    await expect(dialogTitle).toHaveText("Screenshot preview");

    // Close the dialog by pressing Escape
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
  });

  test("step cards without screenshots show fallback text", async ({
    page,
  }) => {
    await navigateToCompletedRun(page);

    const stepCards = page.locator(".border.border-border.p-4");
    await expect(stepCards.first()).toBeVisible({ timeout: 10_000 });

    // Check if any step card shows the "No screenshot available" fallback
    // This may not always be present (depends on test data), so we verify
    // the rendering logic: either an <img> or the fallback text exists
    const count = await stepCards.count();

    for (let i = 0; i < count; i++) {
      const card = stepCards.nth(i);
      const hasScreenshot = await card
        .locator('img[alt^="Step"]')
        .isVisible();
      const hasFallback = await card
        .getByText("No screenshot available")
        .isVisible();

      // Every step card must have either a screenshot or the fallback text
      expect(hasScreenshot || hasFallback).toBeTruthy();
    }
  });
});
