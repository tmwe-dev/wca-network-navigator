import { test, expect } from "@playwright/test";

/**
 * [A01] App Routing & Access Control
 * Scope: Protected routes redirect to /auth; /auth is publicly accessible.
 * Preconditions: No active session.
 */

const protectedRoutes = [
  "/",
  "/partners",
  "/agents",
  "/email",
  "/campaigns",
  "/settings",
];

test.describe("App Routing Access [A01]", () => {
  for (const route of protectedRoutes) {
    test(`${route} redirects to /auth when unauthenticated`, async ({ page }) => {
      await page.goto(route);
      // Should end up on /auth
      await page.waitForURL(/\/auth/, { timeout: 10000 });
      expect(page.url()).toContain("/auth");
    });
  }

  test("/auth is accessible without authentication", async ({ page }) => {
    const response = await page.goto("/auth");
    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator("body")).toBeVisible();
  });
});
