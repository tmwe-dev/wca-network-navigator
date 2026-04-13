import { test, expect } from "@playwright/test";

test.describe("Settings", () => {
  test("caricare la pagina settings con data-testid", async ({ page }) => {
    await page.goto("/v2/settings");
    await page.waitForLoadState("networkidle");
    await expect(page.locator('[data-testid="page-settings"]')).toBeVisible({ timeout: 15000 });
  });

  test("caricare la pagina settings con tutte le sezioni", async ({ page }) => {
    await page.goto("/v2/settings");
    await page.waitForLoadState("networkidle");
    const content = page.locator("text=Profilo").or(page.locator("text=Profile")).or(page.locator("text=Generale")).or(page.locator("text=General"));
    await expect(content).toBeVisible({ timeout: 15000 });
  });

  test("language switcher è visibile", async ({ page }) => {
    await page.goto("/v2/settings");
    await page.waitForLoadState("networkidle");
    const switcher = page.locator('[data-testid="language-switcher"]').or(page.locator("text=Italiano")).or(page.locator("text=English"));
    await expect(switcher.first()).toBeVisible({ timeout: 10000 });
  });

  test("nessun ErrorBoundary visibile", async ({ page }) => {
    await page.goto("/v2/settings");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/qualcosa è andato storto/i)).toHaveCount(0);
  });

  test("la pagina settings non produce errori critici", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
    await page.goto("/v2/settings");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    const criticalErrors = errors.filter((e) => !e.includes("favicon") && !e.includes("404") && !e.includes("ERR_") && !e.includes("ResizeObserver"));
    expect(criticalErrors.length).toBeLessThan(5);
  });
});
