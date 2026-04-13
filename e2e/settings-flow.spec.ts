import { test, expect } from "@playwright/test";

test.describe("Settings", () => {
  test("caricare la pagina settings con tutte le sezioni", async ({ page }) => {
    await page.goto("/v2/settings");
    await page.waitForLoadState("networkidle");

    const content = page
      .locator("text=Profilo")
      .or(page.locator("text=Profile"))
      .or(page.locator("text=Generale"))
      .or(page.locator("text=General"));
    await expect(content).toBeVisible({ timeout: 15000 });
  });

  test("language switcher è visibile nelle impostazioni", async ({ page }) => {
    await page.goto("/v2/settings");
    await page.waitForLoadState("networkidle");

    const switcher = page
      .locator('[data-testid="language-switcher"]')
      .or(page.locator("text=Italiano"))
      .or(page.locator("text=English"));
    await expect(switcher.first()).toBeVisible({ timeout: 10000 });
  });
});
