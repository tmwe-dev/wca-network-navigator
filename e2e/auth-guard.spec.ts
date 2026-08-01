import { test, expect } from "@playwright/test";

test.describe("Auth Guard [AUTH]", () => {
  const protectedRoutes = ["/v1/crm", "/v1/settings", "/v1/outreach"];
  for (const route of protectedRoutes) {
    test("" + route + " redirects to /auth", async ({ page }) => {
      await page.goto(route);
      await page.waitForURL(/\/auth/, { timeout: 10000 });
      expect(page.url()).toContain("/auth");
    });
  }
  // TMWE-only auth (mem://auth/tmwe-only-auth-2026-05-05): niente form credenziali.
  test("auth page mostra l'ingresso TMWE e nessun campo credenziali", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.getByText(/Entra con TMWE|Preparazione login/i).first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    await expect(page.locator('input[type="email"]')).toHaveCount(0);
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
