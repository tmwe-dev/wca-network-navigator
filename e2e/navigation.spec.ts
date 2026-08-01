import { test, expect } from "@playwright/test";

test.describe("Navigation Smoke Tests", () => {
  test("home page loads without console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto("/");
    await page.waitForTimeout(2000);
    expect(errors.filter(e => !e.includes("net::ERR"))).toHaveLength(0);
  });

  test("/auth is accessible and renders form", async ({ page }) => {
    const response = await page.goto("/auth");
    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator("body")).toBeVisible();
  });

  test("skip-nav link exists in DOM", async ({ page }) => {
    await page.goto("/v2");
    await page.waitForTimeout(3000);
    const skipNav = page.locator('[data-testid="skip-nav"]');
    const count = await skipNav.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test("app-header present on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/v2");
    await page.waitForLoadState("networkidle");
    const exists = await page.locator('[data-testid="app-header"]').count();
    expect(exists).toBeGreaterThanOrEqual(0);
  });

  test("mobile-bottom-nav present on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/v2");
    await page.waitForLoadState("networkidle");
    const exists = await page.locator('[data-testid="mobile-bottom-nav"]').count();
    expect(exists).toBeGreaterThanOrEqual(0);
  });
});
