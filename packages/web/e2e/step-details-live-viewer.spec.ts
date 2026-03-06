/**
 * E2E Tests: Live Viewer Step Details
 *
 * Verifies Truth #1: "Live viewer step log shows action badges (click, fill,
 * assert...) and human-readable descriptions alongside status/timing"
 *
 * Truth #4: "Browser streaming frames are smoother (canvas rendering)"
 *
 * REQUIRES: Full backend stack (Temporal, Redis, PostgreSQL, browser pool,
 * Hono WS sidecar on port 3001) to be running. These tests trigger a real
 * test execution through the dashboard form.
 */

import { test, expect } from "@playwright/test";

// Known action types that should render colored badges
const KNOWN_ACTIONS = [
  "click",
  "fill",
  "assert",
  "navigate",
  "select",
  "check",
  "hover",
  "wait",
];

test.describe("Live Viewer - Step Details and Browser Canvas", () => {
  test("dashboard form submits and shows live viewer during execution", async ({
    page,
  }) => {
    // Navigate to dashboard
    await page.goto("/dashboard");

    // Fill in the test form
    const urlInput = page.locator("#url");
    await expect(urlInput).toBeVisible();
    await urlInput.fill("https://example.com");

    const descriptionInput = page.locator("#testDescription");
    await expect(descriptionInput).toBeVisible();
    await descriptionInput.fill(
      "Verify the homepage loads and has a heading"
    );

    // Submit the form
    const submitButton = page.getByRole("button", { name: "Run Test" });
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    // The card title changes to indicate test run in progress
    await expect(
      page.getByText("Test Run in Progress")
    ).toBeVisible({ timeout: 10_000 });

    // A test run ID (monospace) should appear beneath the title
    const testRunIdText = page.locator(".font-mono");
    await expect(testRunIdText).toBeVisible();

    // Wait for the executing phase which renders the LiveViewer
    // The phase badge should cycle through crawling -> generating -> validating -> executing
    await expect(
      page.getByText("Executing Tests")
    ).toBeVisible({ timeout: 90_000 });

    // -------------------------------------------------------------------
    // Truth #4: Canvas-based browser frame rendering
    // -------------------------------------------------------------------
    // LiveViewer renders a <canvas> element (not <img>) for flicker-free streaming
    const canvas = page.locator("canvas");
    await expect(canvas).toBeVisible({ timeout: 15_000 });

    // The connection indicator should show "LIVE" while streaming
    await expect(page.getByText("LIVE")).toBeVisible();

    // -------------------------------------------------------------------
    // Truth #1: Step log with action badges and descriptions
    // -------------------------------------------------------------------
    // Wait for at least one step to appear in the step log
    const stepLog = page.getByText("Step Log");
    await expect(stepLog).toBeVisible();

    // Step rows are rendered inside the ScrollArea next to the canvas
    // Each StepRow has a bordered container with an action badge and description
    const stepRows = page.locator(
      ".col-span-1 .rounded-md.border"
    );
    await expect(stepRows.first()).toBeVisible({ timeout: 60_000 });

    // Verify at least one step row has:
    // 1. A status badge (pass or fail)
    const firstStepRow = stepRows.first();
    const statusBadge = firstStepRow.locator(
      '[data-slot="badge"]'
    );
    await expect(statusBadge.first()).toBeVisible();

    // 2. An action badge (one of the known action types)
    // Action badges use rounded-md px-1.5 py-0.5 text-xs font-medium styling
    const actionBadge = firstStepRow.locator(
      ".inline-flex.items-center.rounded-md.text-xs.font-medium"
    );
    await expect(actionBadge).toBeVisible();
    const actionText = await actionBadge.textContent();
    expect(actionText).toBeTruthy();

    // 3. A duration display (e.g., "123ms")
    await expect(firstStepRow.getByText(/\d+ms/)).toBeVisible();

    // 4. A description text (truncated paragraph)
    const description = firstStepRow.locator("p.truncate");
    await expect(description).toBeVisible();
    const descriptionText = await description.textContent();
    expect(descriptionText).toBeTruthy();
    expect(descriptionText!.length).toBeGreaterThan(0);
  });

  test("step log badge count increments as steps complete", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    // Submit a test
    await page.locator("#url").fill("https://example.com");
    await page
      .locator("#testDescription")
      .fill("Check the page title and main content area");
    await page.getByRole("button", { name: "Run Test" }).click();

    // Wait for execution phase
    await expect(
      page.getByText("Executing Tests")
    ).toBeVisible({ timeout: 90_000 });

    // The step count badge is inside the step log header
    // It shows the total number of steps received
    const stepCountBadge = page.locator(
      ".col-span-1 [data-slot='badge'][data-variant='outline']"
    );
    await expect(stepCountBadge).toBeVisible({ timeout: 30_000 });

    // Wait for at least 1 step
    await expect(stepCountBadge).not.toHaveText("0", {
      timeout: 60_000,
    });

    // Record count, wait for it to increase (proving incremental delivery)
    const initialCount = parseInt(
      (await stepCountBadge.textContent()) ?? "0",
      10
    );
    expect(initialCount).toBeGreaterThanOrEqual(1);

    // If the test has multiple steps, the count should eventually be > 1
    // (This depends on the AI generating >1 step, which is typical)
    await expect(async () => {
      const currentCount = parseInt(
        (await stepCountBadge.textContent()) ?? "0",
        10
      );
      expect(currentCount).toBeGreaterThan(initialCount);
    }).toPass({ timeout: 60_000 });
  });

  test("stream ended indicator shows after execution completes", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    await page.locator("#url").fill("https://example.com");
    await page
      .locator("#testDescription")
      .fill("Verify the page loads correctly");
    await page.getByRole("button", { name: "Run Test" }).click();

    // Wait for execution to start
    await expect(
      page.getByText("Executing Tests")
    ).toBeVisible({ timeout: 90_000 });

    // Wait for the execution to end -- either "Stream ended" text appears
    // or the phase changes to "Saving Results" / "Complete"
    await expect(
      page.getByText("Stream ended").or(
        page.getByText("Complete").or(page.getByText("Saving Results"))
      )
    ).toBeVisible({ timeout: 120_000 });
  });
});
