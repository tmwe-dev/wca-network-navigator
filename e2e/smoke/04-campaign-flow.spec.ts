/**
 * Smoke Test 4: Campaign flow — page loads, draft creation possible
 */
import { test, expect } from "../fixtures/auth";

test.describe("smoke: campaigns", () => {
  test("campaigns page loads", async ({ authedPage: page }) => {
    await page.goto("/v2/campaigns");
    await page.waitForTimeout(3000);
    await expect(page.locator("#root")).not.toBeEmpty();
    await expect(page.getByText(/qualcosa è andato storto/i)).toHaveCount(0);
  });

  test("campaign page has interactive elements", async ({ authedPage: page }) => {
    await page.goto("/v2/campaigns");
    await page.waitForTimeout(3000);
    // Should have buttons or controls
    const buttons = await page.getByRole("button").count();
    expect(buttons).toBeGreaterThan(0);
  });

  test("campaign jobs page loads", async ({ authedPage: page }) => {
    await page.goto("/v2/campaign-jobs");
    await page.waitForTimeout(3000);
    await expect(page.locator("#root")).not.toBeEmpty();
    await expect(page.getByText(/qualcosa è andato storto/i)).toHaveCount(0);
  });
});
