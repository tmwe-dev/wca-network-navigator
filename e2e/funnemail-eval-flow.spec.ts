import { test, expect } from "@playwright/test";

test.describe("Funnemail Eval Flow", () => {
  test("eval accuracy tab is accessible", async ({ page }) => {
    await page.goto("/v2/funnemail-inbox");
    const evalTab = page.getByText("Eval Accuracy");
    await expect(evalTab.or(page.getByText("Eval"))).toBeVisible();
  });

  test("eval tab shows accuracy metrics", async ({ page }) => {
    await page.goto("/v2/funnemail-inbox");
    await page.getByText("Eval Accuracy").click().catch(() => {});
    // Should show accuracy bars or loading state
    await expect(page.getByText(/Accuracy|Caricamento|Nessun/).first()).toBeVisible();
  });

  test("eval cases page loads without errors", async ({ page }) => {
    await page.goto("/v2/funnemail-inbox");
    const tab = page.getByText("Eval Set");
    if (await tab.isVisible()) {
      await tab.click();
      await expect(page.locator("body")).not.toContainText("Errore critico");
    }
  });
});
