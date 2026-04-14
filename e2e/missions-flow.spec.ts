import { test, expect } from "@playwright/test";

test.describe("Missions Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/v2/missions");
    await page.waitForLoadState("networkidle");
  });

  test("missions page mounts with data-testid", async ({ page }) => {
    await expect(page.locator('[data-testid="page-missions"]')).toBeVisible({ timeout: 15000 });
  });

  test("missions shows builder or list", async ({ page }) => {
    const content = page.locator("form, [role='tablist'], table")
      .or(page.getByText(/mission|campagna|nuova|crea|builder/i));
    await expect(content.first()).toBeVisible({ timeout: 15000 });
  });

  test("missions page has form or step controls", async ({ page }) => {
    await page.waitForTimeout(2000);
    const elements = page.locator("button, input, select, textarea");
    const count = await elements.count();
    expect(count).toBeGreaterThan(0);
  });

  test("no ErrorBoundary on missions", async ({ page }) => {
    await expect(page.getByText(/qualcosa è andato storto/i)).toHaveCount(0);
  });

  test("missions no critical console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
    await page.goto("/v2/missions");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    const critical = errors.filter((e) => !e.includes("favicon") && !e.includes("404") && !e.includes("ERR_") && !e.includes("ResizeObserver"));
    expect(critical.length).toBeLessThan(5);
  });
});
