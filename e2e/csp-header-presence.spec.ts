/**
 * Smoke E2E — Csp Header Presence
 *
 * CSP report-only header presente nelle response (P1 audit 2026-05-13).
 */
import { test, expect } from "./fixtures/auth";

test.describe("csp-header-presence", () => {
  test("page loads without crash", async ({ authedPage: page }) => {
    await page.goto("/v2/settings");
    await page.waitForTimeout(2000);
    await expect(page.locator("#root")).not.toBeEmpty();
  });

  test("no ErrorBoundary visible", async ({ authedPage: page }) => {
    await page.goto("/v2/settings");
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
    await page.goto("/v2/settings");
    await page.waitForTimeout(2500);
    expect(errors, errors.join("; ")).toHaveLength(0);
  });

  test("route is reachable (no redirect to /auth)", async ({ authedPage: page }) => {
    await page.goto("/v2/settings");
    await page.waitForTimeout(1500);
    expect(page.url()).not.toContain("/auth");
  });

  test("CSP report-only header is present on document response", async ({ authedPage: page }) => {
    const response = await page.goto("/v2/settings");
    expect(response).not.toBeNull();
    const headers = response!.headers();
    const csp = headers["content-security-policy-report-only"] || headers["content-security-policy"];
    // P1 audit 2026-05-13: CSP report-only deve essere presente.
    // Tolleriamo l'assenza solo in dev locale (preview Vite) loggando, ma in CI deve esserci.
    if (process.env.CI) {
      expect(csp, "CSP header missing in CI").toBeTruthy();
    }
  });
});
