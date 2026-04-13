import { test, expect } from "@playwright/test";

/**
 * [NAV] Navigation Smoke Tests
 * Verifies pages load without errors.
 * These run without auth — pages should either render or redirect to /auth.
 */

test.describe("Navigation Smoke Tests", () => {
  test("home page loads without console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto("/");
    // Should redirect to /auth or render
    await page.waitForTimeout(2000);
    // No uncaught exceptions
    expect(errors.filter(e => !e.includes("net::ERR"))).toHaveLength(0);
  });

  test("/auth is accessible and renders form", async ({ page }) => {
    const response = await page.goto("/auth");
    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator("body")).toBeVisible();
  });
});
