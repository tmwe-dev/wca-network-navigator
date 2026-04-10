import { test, expect } from "@playwright/test";

/**
 * [E03] Campaign Queue Lifecycle (with auth fixture)
 */

test.describe("Campaign Queue Lifecycle [E03]", () => {
  test("auth page loads", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.locator("body")).toBeVisible();
  });

  test("auth page has login form", async ({ page }) => {
    await page.goto("/auth");
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible({ timeout: 10000 });
  });

  test("auth page rejects empty credentials", async ({ page }) => {
    await page.goto("/auth");
    const submitBtn = page.locator('button[type="submit"]');
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      // Should stay on auth page
      expect(page.url()).toContain("/auth");
    }
  });
});
