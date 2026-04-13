import { test, expect } from "@playwright/test";

test.describe("App Routing Access [A01]", () => {
  const protectedRoutes = ["/", "/partners", "/agents", "/email", "/campaigns", "/settings"];
  for (const route of protectedRoutes) {
    test("" + route + " redirects to /auth", async ({ page }) => {
      await page.goto(route);
      await page.waitForURL(/\/auth/, { timeout: 10000 });
      expect(page.url()).toContain("/auth");
    });
  }
  test("/auth is accessible", async ({ page }) => {
    const response = await page.goto("/auth");
    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator("body")).toBeVisible();
  });
  test("/auth has form inputs", async ({ page }) => {
    await page.goto("/auth");
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible({ timeout: 10000 });
  });
  test("/auth has no ErrorBoundary", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.getByText(/qualcosa è andato storto/i)).toHaveCount(0);
  });
});
