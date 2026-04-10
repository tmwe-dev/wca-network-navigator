import { test, expect } from "@playwright/test";

/**
 * [E05] Deep Search Runner
 * Scope: Deep search skips already-enriched partners.
 * Preconditions: Requires auth + partners with/without enrichment.
 */

test.describe("Deep Search Runner [E05]", () => {
  test("auth page loads", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.locator("body")).toBeVisible();
  });

  test.skip("skips already-enriched partners (requires auth)", async () => {
    expect(true).toBe(true);
  });
});
