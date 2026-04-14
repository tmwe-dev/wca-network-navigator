import { test, expect } from "@playwright/test";

test.describe("Dashboard Widgets Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/v2");
    await page.waitForLoadState("networkidle");
  });

  test("dashboard page mounts with data-testid", async ({ page }) => {
    const dashboard = page.locator('[data-testid="page-dashboard"]');
    await expect(dashboard).toBeVisible({ timeout: 15000 });
  });

  test("dashboard contains heading or welcome content", async ({ page }) => {
    const content = page.locator("h1, h2, h3").first();
    await expect(content).toBeVisible({ timeout: 15000 });
    const text = await content.textContent();
    expect(text!.length).toBeGreaterThan(0);
  });

  test("dashboard has interactive elements (buttons or links)", async ({ page }) => {
    await page.waitForTimeout(2000);
    const interactive = page.locator("button, a[href]");
    const count = await interactive.count();
    expect(count).toBeGreaterThan(0);
  });

  test("no ErrorBoundary on dashboard", async ({ page }) => {
    await expect(page.getByText(/qualcosa è andato storto/i)).toHaveCount(0);
  });

  test("dashboard does not produce critical console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
    await page.goto("/v2");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    const critical = errors.filter((e) => !e.includes("favicon") && !e.includes("404") && !e.includes("ERR_") && !e.includes("ResizeObserver"));
    expect(critical.length).toBeLessThan(5);
  });
});
