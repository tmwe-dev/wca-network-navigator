/**
 * Smoke E2E — Editorial Review (journalistReview) coverage
 *
 * L'editorial review è obbligatorio e intoccabile (mem://tech/editorial-review-layer-mandatory).
 * Il test di copertura statica vive in src/test/journalist-pipeline-coverage.test.ts.
 * Qui verifichiamo solo che la pagina /v2/email-composer carichi e che
 * la UI non offra alcun toggle visibile per disattivare la review.
 */
import { test, expect } from "./fixtures/auth";

test.describe("editorial-review-block", () => {
  test("composer loads", async ({ authedPage: page }) => {
    await page.goto("/v2/email-composer");
    await page.waitForTimeout(1500);
    await expect(page.locator("#root")).not.toBeEmpty();
  });

  test("no UI toggle to disable journalist review", async ({ authedPage: page }) => {
    await page.goto("/v2/email-composer");
    await page.waitForTimeout(1500);
    const offSwitch = await page
      .getByText(/disattiva.*editorial|disable.*journalist|skip.*review/i)
      .count();
    expect(offSwitch).toBe(0);
  });

  test("no critical pageerror", async ({ authedPage: page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => {
      if (!err.message.includes("ResizeObserver")) errors.push(err.message);
    });
    await page.goto("/v2/email-composer");
    await page.waitForTimeout(2000);
    expect(errors).toHaveLength(0);
  });
});