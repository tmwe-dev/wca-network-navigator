/**
 * Smoke E2E — Holding Pattern Pulse
 *
 * Contatti ✈️ holding pattern visibili con badge pulsante (governance bloccante outreach).
 */
import { test, expect } from "./fixtures/auth";

test.describe("holding-pattern-pulse", () => {
  test("page loads without crash", async ({ authedPage: page }) => {
    await page.goto("/v2/crm");
    await page.waitForTimeout(2000);
    await expect(page.locator("#root")).not.toBeEmpty();
  });

  test("no ErrorBoundary visible", async ({ authedPage: page }) => {
    await page.goto("/v2/crm");
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
    await page.goto("/v2/crm");
    await page.waitForTimeout(2500);
    expect(errors, errors.join("; ")).toHaveLength(0);
  });

  test("route is reachable (no redirect to /auth)", async ({ authedPage: page }) => {
    await page.goto("/v2/crm");
    await page.waitForTimeout(1500);
    expect(page.url()).not.toContain("/auth");
  });
});
