/**
 * Smoke E2E — Pwa Offline Fallback
 *
 * Service worker registrato + offline.html disponibile come fallback Workbox.
 */
import { test, expect } from "./fixtures/auth";

test.describe("pwa-offline-fallback", () => {
  test("page loads without crash", async ({ authedPage: page }) => {
    await page.goto("/");
    await page.waitForTimeout(2000);
    await expect(page.locator("#root")).not.toBeEmpty();
  });

  test("no ErrorBoundary visible", async ({ authedPage: page }) => {
    await page.goto("/");
    await page.waitForTimeout(2000);
    const eb = await page.getByText(/qualcosa è andato storto|something went wrong|errore imprevisto/i).count();
    expect(eb).toBe(0);
  });

  test("no critical pageerror", async ({ authedPage: page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => {
      if (!err.message.includes("ResizeObserver") && !err.message.includes("AbortError")) {
        errors.push(err.message);
      }
    });
    await page.goto("/");
    await page.waitForTimeout(2500);
    expect(errors, errors.join("; ")).toHaveLength(0);
  });

  test("route is reachable (no redirect to /auth)", async ({ authedPage: page }) => {
    await page.goto("/");
    await page.waitForTimeout(1500);
    expect(page.url()).not.toContain("/auth");
  });

  test("service worker is registered", async ({ authedPage: page }) => {
    await page.goto("/");
    await page.waitForTimeout(3000);
    const hasSW = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return false;
      const regs = await navigator.serviceWorker.getRegistrations();
      return regs.length > 0;
    });
    // In preview Vite il SW potrebbe non essere attivo; in build prod sì.
    if (process.env.CI) {
      expect(hasSW, "Service Worker not registered in CI build").toBe(true);
    }
  });

  test("offline fallback page is reachable", async ({ authedPage: page }) => {
    const response = await page.goto("/offline.html");
    expect(response?.status()).toBeLessThan(400);
    const body = await page.content();
    expect(body.toLowerCase()).toMatch(/offline|connessione|connection/);
  });
});
