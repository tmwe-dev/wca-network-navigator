import { test, expect } from "@playwright/test";

test.describe("followup-mission", () => {
  test("auth page loads", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.locator("body")).toBeVisible();
  });
  test("auth page has login form", async ({ page }) => {
    await page.goto("/auth");
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible({ timeout: 10000 });
  });
  test("auth page has no ErrorBoundary", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.getByText(/qualcosa è andato storto/i)).toHaveCount(0);
  });
  test("auth page no critical errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto("/auth");
    await page.waitForTimeout(2000);
    expect(errors.filter(e => !e.includes("net::ERR"))).toHaveLength(0);
  });
});
