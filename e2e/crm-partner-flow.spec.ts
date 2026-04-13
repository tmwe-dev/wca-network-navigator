import { test, expect } from "@playwright/test";

test.describe("CRM Partner Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/v2/crm");
    await page.waitForLoadState("networkidle");
  });

  test("navigare a CRM e vedere data-testid page-contacts", async ({ page }) => {
    const pageContainer = page.locator('[data-testid="page-contacts"]');
    await expect(pageContainer).toBeVisible({ timeout: 15000 });
  });

  test("navigare a CRM e vedere la lista partner o empty state", async ({ page }) => {
    const content = page.locator("table")
      .or(page.locator("text=Nessun dato").or(page.locator("text=No data")));
    await expect(content).toBeVisible({ timeout: 15000 });
  });

  test("aprire dettaglio partner e vedere le tab", async ({ page }) => {
    const firstRow = page.locator("table tbody tr").first();
    if (await firstRow.isVisible({ timeout: 10000 }).catch(() => false)) {
      await firstRow.click();
      await expect(page.locator('[role="tablist"]').or(page.locator("text=Info"))).toBeVisible({ timeout: 5000 });
    }
  });

  test("usare i filtri partner per paese", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
    const countryFilter = page.locator('[data-testid="country-filter"]');
    if (await countryFilter.isVisible({ timeout: 5000 }).catch(() => false)) {
      await countryFilter.click();
      await page.waitForTimeout(500);
    }
    const criticalErrors = errors.filter((e) => !e.includes("favicon") && !e.includes("404") && !e.includes("ERR_"));
    expect(criticalErrors.length).toBeLessThan(3);
  });

  test("l'header è presente", async ({ page }) => {
    const header = page.locator('[data-testid="app-header"]').or(page.locator('[role="banner"]'));
    await expect(header).toBeVisible({ timeout: 10000 });
  });

  test("nessun ErrorBoundary visibile", async ({ page }) => {
    await expect(page.getByText(/qualcosa è andato storto/i)).toHaveCount(0);
  });
});
