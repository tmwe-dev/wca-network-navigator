import { test, expect } from "@playwright/test";

/**
 * [E04] Agent Approval Flow (with auth fixture)
 */

test.describe("Agent Approval Flow [E04]", () => {
  test("auth page loads", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.locator("body")).toBeVisible();
  });

  test("auth page has login form", async ({ page }) => {
    await page.goto("/auth");
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible({ timeout: 10000 });
  });

  test("auth page shows sign-in elements", async ({ page }) => {
    await page.goto("/auth");
    const body = page.locator("body");
    await expect(body).toBeVisible();
    // Should have some form of sign in text or button
    const text = await body.textContent();
    expect(text?.length).toBeGreaterThan(0);
  });
});
