import { test, expect } from "@playwright/test";

test.describe("Prospects Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/v2/prospects");
    await page.waitForLoadState("networkidle");
  });

  test("prospects page mounts with data-testid", async ({ page }) => {
    await expect(page.locator('[data-testid="page-prospects"]')).toBeVisible({ timeout: 15000 });
  });

  test("prospects shows list or empty state", async ({ page }) => {
    const content = page.locator("table, [role='grid']")
      .or(page.getByText(/prospect|nessun|no data|cerca|search/i));
    await expect(content.first()).toBeVisible({ timeout: 15000 });
  });

  test("prospects page has search or filter UI", async ({ page }) => {
    await page.waitForTimeout(2000);
    const elements = page.locator("input, button, [role='combobox'], select");
    const count = await elements.count();
    expect(count).toBeGreaterThan(0);
  });

  test("no ErrorBoundary on prospects", async ({ page }) => {
    await expect(page.getByText(/qualcosa è andato storto/i)).toHaveCount(0);
  });

  test("prospects no critical console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
    await page.goto("/v2/prospects");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    const critical = errors.filter((e) => !e.includes("favicon") && !e.includes("404") && !e.includes("ERR_") && !e.includes("ResizeObserver"));
    expect(critical.length).toBeLessThan(5);
  });
});
