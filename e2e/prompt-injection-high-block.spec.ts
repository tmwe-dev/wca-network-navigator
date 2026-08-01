/**
 * Smoke E2E — Prompt Injection High Block
 *
 * Verifica che la UI Prompt Lab carichi e mostri il pannello injection reviews. Pattern HIGH bloccano l'AI con 409 (lato server).
 */
import { test, expect } from "./fixtures/auth";

test.describe("prompt-injection-high-block", () => {
  test("page loads without crash", async ({ authedPage: page }) => {
    await page.goto("/v2/prompt-lab");
    await page.waitForTimeout(2000);
    await expect(page.locator("#root")).not.toBeEmpty();
  });

  test("no ErrorBoundary visible", async ({ authedPage: page }) => {
    await page.goto("/v2/prompt-lab");
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
    await page.goto("/v2/prompt-lab");
    await page.waitForTimeout(2500);
    expect(errors, errors.join("; ")).toHaveLength(0);
  });

  test("route is reachable (no redirect to /auth)", async ({ authedPage: page }) => {
    await page.goto("/v2/prompt-lab");
    await page.waitForTimeout(1500);
    expect(page.url()).not.toContain("/auth");
  });
});
