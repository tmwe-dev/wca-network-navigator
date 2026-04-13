import { test, expect } from "@playwright/test";

/**
 * [AUTH] Auth Guard Tests
 * Verifies protected routes redirect to /auth when unauthenticated.
 */

const protectedRoutes = [
  "/v1/crm",
  "/v1/settings",
  "/v1/outreach",
];

test.describe("Auth Guard [AUTH]", () => {
  for (const route of protectedRoutes) {
    test(`${route} redirects to /auth when unauthenticated`, async ({ page }) => {
      await page.goto(route);
      await page.waitForURL(/\/auth/, { timeout: 10000 });
      expect(page.url()).toContain("/auth");
    });
  }
});
