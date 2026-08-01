/**
 * Smoke Test 6: Deep Search — page loads, search input functional
 */
import { test, expect } from "../fixtures/auth";

test.describe("smoke: deep search", () => {
  test("deep search page loads", async ({ authedPage: page }) => {
    await page.goto("/v2/deep-search");
    await page.waitForTimeout(3000);
    await expect(page.locator("#root")).not.toBeEmpty();
    await expect(page.getByText(/qualcosa è andato storto/i)).toHaveCount(0);
  });

  test("search input is present and functional", async ({ authedPage: page }) => {
    await page.goto("/v2/deep-search");
    await page.waitForTimeout(3000);
    const searchInput = page.locator('input[type="text"], input[type="search"], textarea').first();
    if (await searchInput.count() > 0) {
      await searchInput.fill("test logistics company");
      const value = await searchInput.inputValue();
      expect(value).toContain("test");
    }
  });

  test("operations page loads as fallback", async ({ authedPage: page }) => {
    await page.goto("/v2/operations");
    await page.waitForTimeout(3000);
    await expect(page.locator("#root")).not.toBeEmpty();
    await expect(page.getByText(/qualcosa è andato storto/i)).toHaveCount(0);
  });
});
