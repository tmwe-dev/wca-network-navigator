/**
 * Smoke E2E — Prompt Lab (Catalog / Atlas / Suggestions)
 *
 * Verifica che le 3 pagine principali del Prompt Lab carichino senza
 * crash sotto auth. Le verifiche di logica (versioning, simulator,
 * personas) vivono nei test Deno e nelle migrations.
 */
import { test, expect } from "./fixtures/auth";

const ROUTES = [
  "/v2/settings/prompt-lab",
  "/v2/prompt-lab/atlas",
  "/v2/prompt-lab/catalog",
  "/v2/prompt-lab/suggestions",
];

test.describe("prompt-lab-flow", () => {
  for (const route of ROUTES) {
    test(`${route} loads`, async ({ authedPage: page }) => {
      const errors: string[] = [];
      page.on("pageerror", (err) => {
        if (!err.message.includes("ResizeObserver")) errors.push(err.message);
      });
      await page.goto(route);
      await page.waitForTimeout(1500);
      await expect(page.locator("#root")).not.toBeEmpty();
      const eb = await page.getByText(/qualcosa è andato storto/i).count();
      expect(eb, `ErrorBoundary on ${route}`).toBe(0);
      expect(errors, `pageerror on ${route}: ${errors.join("; ")}`).toHaveLength(0);
    });
  }
});