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
  // TMWE-only auth: la login espone solo l'ingresso OAuth, nessun input credenziali.
  test("/auth espone l'ingresso TMWE", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.getByText(/Entra con TMWE|Preparazione login/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
  });
  test("/auth has no ErrorBoundary", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.getByText(/qualcosa è andato storto/i)).toHaveCount(0);
  });
});
