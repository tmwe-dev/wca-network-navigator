/**
 * Smoke E2E — Alert Routing (TMWE Inbound Triage)
 *
 * Verifica che la pagina /v2/settings/alert-routing carichi senza
 * crash, mostri il form CRUD per i destinatari e non esponga
 * ErrorBoundary. Non esegue scritture: i flussi DB sono coperti dai
 * test Deno su dispatch-urgent-alert e inboundTriage.
 */
import { test, expect } from "./fixtures/auth";

test.describe("alert-routing-flow", () => {
  test("page loads under auth", async ({ authedPage: page }) => {
    await page.goto("/v2/settings/alert-routing");
    await page.waitForTimeout(1500);
    await expect(page.locator("#root")).not.toBeEmpty();
  });

  test("no ErrorBoundary visible", async ({ authedPage: page }) => {
    await page.goto("/v2/settings/alert-routing");
    await page.waitForTimeout(1500);
    const eb = await page.getByText(/qualcosa è andato storto|something went wrong/i).count();
    expect(eb).toBe(0);
  });

  test("no critical pageerror", async ({ authedPage: page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => {
      if (!err.message.includes("ResizeObserver")) errors.push(err.message);
    });
    await page.goto("/v2/settings/alert-routing");
    await page.waitForTimeout(2000);
    expect(errors).toHaveLength(0);
  });

  test("alert routing keyword visible", async ({ authedPage: page }) => {
    await page.goto("/v2/settings/alert-routing");
    await page.waitForTimeout(1500);
    const found = await page.getByText(/alert|whatsapp|destinatar/i).count();
    expect(found).toBeGreaterThan(0);
  });
});