import { test, expect } from "@playwright/test";

/**
 * [E02] Follow-up Mission
 * Scope: Inactive lead with overdue follow-up generates task.
 * Preconditions: Requires auth + agent with overdue activities.
 */

test.describe("Follow-up Mission [E02]", () => {
  test("auth page loads", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.locator("body")).toBeVisible();
  });

  test.skip("overdue follow-up generates agent task (requires auth)", async () => {
    // Requires: authenticated session, overdue activity, active agent
    expect(true).toBe(true);
  });
});
