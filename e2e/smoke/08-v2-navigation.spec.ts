/**
 * Smoke Test 8: V2 sidebar navigation — all routes load without 404 or crash
 */
import { test, expect } from "../fixtures/auth";

const V2_ROUTES = [
  "/v2",
  "/v2/network",
  "/v2/crm",
  "/v2/outreach",
  "/v2/cockpit",
  "/v2/inreach",
  "/v2/agenda",
  "/v2/agent-chat",
  "/v2/campaigns",
  "/v2/settings",
  "/v2/operations",
  "/v2/contacts",
  "/v2/email-composer",
  "/v2/deep-search",
  "/v2/prospects",
  "/v2/ai-control",
  "/v2/knowledge-base",
  "/v2/diagnostics",
  "/v2/telemetry",
  "/v2/staff",
  "/v2/email-intelligence",
  "/v2/ai-lab",
  "/v2/sorting",
  "/v2/globe",
  "/v2/import",
  "/v2/email-download",
  "/v2/guida",
];

test.describe("smoke: v2 navigation", () => {
  for (const route of V2_ROUTES) {
    test(`${route} loads without crash`, async ({ authedPage: page }) => {
      const errors: string[] = [];
      page.on("pageerror", (err) => {
        if (!err.message.includes("ResizeObserver") && !err.message.includes("AbortError")) {
          errors.push(err.message);
        }
      });

      await page.goto(route);
      await page.waitForTimeout(2000);

      // No blank screen
      await expect(page.locator("#root")).not.toBeEmpty({ timeout: 10_000 });

      // No error boundary
      const errorBoundary = await page.getByText(/qualcosa è andato storto|something went wrong|errore imprevisto/i).count();
      expect(errorBoundary, `Error boundary visible on ${route}`).toBe(0);

      // No 404
      const notFound = await page.getByText(/404|page not found|pagina non trovata/i).count();
      expect(notFound, `404 on ${route}`).toBe(0);

      // No critical console errors
      expect(errors, `Console errors on ${route}: ${errors.join("; ")}`).toHaveLength(0);
    });
  }
});
