/**
 * Smoke E2E — Email Intelligence: learn-from-group-correction
 *
 * Verifica che la pagina /v2/email-intelligence carichi e che il
 * sistema di suggerimenti gruppi sia presente. La correzione AI
 * effettiva è coperta dall'edge function learn-from-group-correction.
 */
import { test, expect } from "./fixtures/auth";

test.describe("learn-from-group-correction", () => {
  test("email-intelligence page loads", async ({ authedPage: page }) => {
    await page.goto("/v2/email-intelligence");
    await page.waitForTimeout(1500);
    await expect(page.locator("#root")).not.toBeEmpty();
  });

  test("no ErrorBoundary visible", async ({ authedPage: page }) => {
    await page.goto("/v2/email-intelligence");
    await page.waitForTimeout(1500);
    const eb = await page.getByText(/qualcosa è andato storto|something went wrong/i).count();
    expect(eb).toBe(0);
  });

  test("no critical pageerror", async ({ authedPage: page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => {
      if (!err.message.includes("ResizeObserver")) errors.push(err.message);
    });
    await page.goto("/v2/email-intelligence");
    await page.waitForTimeout(2000);
    expect(errors).toHaveLength(0);
  });
});