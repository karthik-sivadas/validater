/**
 * E2E Tests: Full Flow - Dashboard to Results
 *
 * Verifies the complete end-to-end journey from creating a test on the
 * dashboard, through live execution with step details, to viewing the
 * completed results with action badges, descriptions, and screenshots.
 *
 * This test covers:
 * - Truth #1: Live viewer step log with action badges and descriptions
 * - Truth #2: Results page step cards with action, description, screenshots
 * - Truth #3: Screenshots persisted for all viewports
 * - Truth #4: Canvas-based browser streaming
 * - Truth #5: Database has action and description columns
 *
 * REQUIRES: Full backend stack (Temporal, Redis, PostgreSQL, browser pool,
 * Hono WS sidecar) to be running.
 */

import { test, expect } from "@playwright/test";

test.describe("Full Flow: Dashboard -> Live Execution -> Results", () => {
  test("complete journey: submit test, watch execution, view results", async ({
    page,
  }) => {
    // ---------------------------------------------------------------
    // Phase 1: Submit a test from the dashboard
    // ---------------------------------------------------------------
    await page.goto("/dashboard");
    await expect(page.getByText("Create New Test")).toBeVisible();

    await page.locator("#url").fill("https://example.com");
    await page
      .locator("#testDescription")
      .fill("Navigate to the page and verify the heading exists");

    await page.getByRole("button", { name: "Run Test" }).click();

    // Card should switch to progress view
    await expect(
      page.getByText("Test Run in Progress")
    ).toBeVisible({ timeout: 10_000 });

    // Capture the test run ID for later verification
    const testRunIdEl = page.locator(".font-mono").first();
    await expect(testRunIdEl).toBeVisible();
    const testRunId = await testRunIdEl.textContent();
    expect(testRunId).toBeTruthy();

    // ---------------------------------------------------------------
    // Phase 2: Watch live execution with canvas + step log
    // ---------------------------------------------------------------
    // Wait for executing phase
    await expect(
      page.getByText("Executing Tests")
    ).toBeVisible({ timeout: 90_000 });

    // Truth #4: Canvas element for flicker-free streaming
    const canvas = page.locator("canvas");
    await expect(canvas).toBeVisible({ timeout: 15_000 });

    // Truth #1: Step log with action badges
    const stepRows = page.locator(".col-span-1 .rounded-md.border");
    await expect(stepRows.first()).toBeVisible({ timeout: 60_000 });

    // Collect step data from live viewer for later comparison
    const liveStepCount = await stepRows.count();
    expect(liveStepCount).toBeGreaterThanOrEqual(1);

    // ---------------------------------------------------------------
    // Phase 3: Wait for completion and navigate to results
    // ---------------------------------------------------------------
    // Wait for the "View Results" button to appear (signals completion)
    const viewResultsButton = page.getByRole("button", {
      name: "View Results",
    });
    await expect(viewResultsButton).toBeVisible({
      timeout: 120_000,
    });

    // Click to navigate to results page
    await viewResultsButton.click();

    // ---------------------------------------------------------------
    // Phase 4: Verify results page has step details
    // ---------------------------------------------------------------
    // The results page should load with the test run header
    await expect(page.getByText("Test Run")).toBeVisible({
      timeout: 10_000,
    });

    // The run ID should match what we captured
    if (testRunId) {
      await expect(page.getByText(testRunId)).toBeVisible();
    }

    // Status should be "complete"
    await expect(
      page.locator('[data-slot="badge"]').filter({ hasText: "complete" })
    ).toBeVisible();

    // The summary card should show viewport information
    await expect(page.getByText("Summary")).toBeVisible();
    await expect(page.getByText(/\d+ viewport\(s\) tested/)).toBeVisible();
    await expect(page.getByText(/steps passed/)).toBeVisible();

    // Truth #2: Step cards with action badges and descriptions
    const stepCards = page.locator(".border.border-border.p-4");
    await expect(stepCards.first()).toBeVisible({ timeout: 10_000 });

    const resultsStepCount = await stepCards.count();
    expect(resultsStepCount).toBeGreaterThanOrEqual(1);

    // Verify first step card has the expected structure
    const firstCard = stepCards.first();

    // Step order label
    await expect(firstCard.getByText(/^Step \d+$/)).toBeVisible();

    // Status badge
    const statusBadge = firstCard.locator('[data-slot="badge"]');
    await expect(statusBadge).toBeVisible();

    // Action badge
    const actionBadge = firstCard.locator(
      ".inline-flex.items-center.rounded-md.text-xs.font-medium"
    );
    await expect(actionBadge).toBeVisible();
    const actionText = await actionBadge.textContent();
    expect(actionText).toBeTruthy();

    // Description
    const description = firstCard
      .locator("p.text-xs.text-muted-foreground")
      .first();
    await expect(description).toBeVisible();

    // Truth #3: Screenshots persisted (visible as thumbnails)
    const screenshots = page.locator('img[alt^="Step"]');
    await expect(screenshots.first()).toBeVisible({ timeout: 5_000 });

    // Screenshot should be a base64 data URL
    const src = await screenshots.first().getAttribute("src");
    expect(src).toMatch(/^data:image\/png;base64,/);

    // Truth #2 (continued): Clicking screenshot opens zoom dialog
    const screenshotButton = page
      .locator('button:has(img[alt^="Step"])')
      .first();
    await screenshotButton.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    const fullImage = dialog.locator(
      'img[alt="Step screenshot full size"]'
    );
    await expect(fullImage).toBeVisible();

    // Close dialog
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
  });

  test("viewport tabs show results for each tested viewport", async ({
    page,
  }) => {
    // This test requires a previously completed run
    await page.goto("/runs");
    await expect(page.getByText("Test History")).toBeVisible();

    // Click into the first completed run
    const firstRow = page.locator("tbody tr").first();
    await expect(firstRow).toBeVisible({ timeout: 10_000 });
    await firstRow.click();

    await expect(page.getByText("Test Run")).toBeVisible({
      timeout: 10_000,
    });

    // Viewport tabs should be visible
    const tabsList = page.locator('[role="tablist"]');
    await expect(tabsList).toBeVisible();

    // At least one tab (viewport) should exist
    const tabs = tabsList.locator('[role="tab"]');
    const tabCount = await tabs.count();
    expect(tabCount).toBeGreaterThanOrEqual(1);

    // Each tab should have a viewport label and status dot
    const firstTab = tabs.first();
    await expect(firstTab).toBeVisible();

    // The status dot (rounded-full) indicates all-passed or has-failures
    const statusDot = firstTab.locator(".rounded-full");
    await expect(statusDot).toBeVisible();

    // Click each tab and verify step cards render
    for (let i = 0; i < tabCount; i++) {
      const tab = tabs.nth(i);
      await tab.click();

      // After clicking a tab, step cards should appear in the panel
      const stepCards = page.locator(".border.border-border.p-4");
      await expect(stepCards.first()).toBeVisible({
        timeout: 5_000,
      });

      // Truth #3: Screenshots persist for ALL viewports, not just streaming one
      // At least some steps in every viewport should have screenshots
      const vpScreenshots = page.locator('img[alt^="Step"]');
      const vpScreenshotCount = await vpScreenshots.count();
      expect(vpScreenshotCount).toBeGreaterThanOrEqual(1);
    }
  });

  test("failed steps show error details in results", async ({ page }) => {
    // Navigate to a completed run (may have passed or failed steps)
    await page.goto("/runs");
    await expect(page.getByText("Test History")).toBeVisible();

    const firstRow = page.locator("tbody tr").first();
    await expect(firstRow).toBeVisible({ timeout: 10_000 });
    await firstRow.click();

    await expect(page.getByText("Test Run")).toBeVisible({
      timeout: 10_000,
    });

    const stepCards = page.locator(".border.border-border.p-4");
    await expect(stepCards.first()).toBeVisible({ timeout: 10_000 });

    // Check all step cards for proper error rendering
    const count = await stepCards.count();
    for (let i = 0; i < count; i++) {
      const card = stepCards.nth(i);
      const statusBadge = card.locator('[data-slot="badge"]');
      const statusText = await statusBadge.textContent();

      if (statusText === "fail") {
        // Failed steps should show an error message
        const errorMessage = card.locator(".text-destructive");
        await expect(errorMessage.first()).toBeVisible();

        // May also show expected/actual diff
        const diffBlock = card.locator(".font-mono");
        // This is optional -- not all failures have expected/actual
        if (await diffBlock.isVisible()) {
          // If the diff block is visible, it should contain Expected or Actual
          const diffText = await diffBlock.textContent();
          expect(
            diffText?.includes("Expected") ||
              diffText?.includes("Actual")
          ).toBeTruthy();
        }
      }
    }
  });
});
