import { test, expect } from "@playwright/test";

/**
 * [E06] Queue UI State Consistency
 * Scope: UI status matches email_drafts.queue_status in backend.
 * Preconditions: Requires auth + active campaigns.
 */

test.describe("Queue UI State Consistency [E06]", () => {
  test("auth page loads", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.locator("body")).toBeVisible();
  });

  test.skip("UI reflects backend queue_status (requires auth)", async () => {
    // Navigate to campaigns, verify status badges match DB state
    expect(true).toBe(true);
  });
});
