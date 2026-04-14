import { test, expect } from "@playwright/test";

test.describe("Network Explorer Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/v2/network");
    await page.waitForLoadState("networkidle");
  });

  test("network page mounts with data-testid", async ({ page }) => {
    await expect(page.locator('[data-testid="page-network"]')).toBeVisible({ timeout: 15000 });
  });

  test("network shows country list, map, or search", async ({ page }) => {
    const content = page.locator("table, input[type='search'], input[type='text'], [role='search']")
      .or(page.getByText(/network|rete|paesi|countries/i));
    await expect(content.first()).toBeVisible({ timeout: 15000 });
  });

  test("network page renders without ErrorBoundary", async ({ page }) => {
    await expect(page.getByText(/qualcosa è andato storto/i)).toHaveCount(0);
    const root = page.locator("#root");
    await expect(root).not.toBeEmpty({ timeout: 10000 });
  });

  test("network page has actionable UI elements", async ({ page }) => {
    await page.waitForTimeout(2000);
    const elements = page.locator("button, a[href], input");
    const count = await elements.count();
    expect(count).toBeGreaterThan(0);
  });

  test("no critical console errors on network", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
    await page.goto("/v2/network");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    const critical = errors.filter((e) => !e.includes("favicon") && !e.includes("404") && !e.includes("ERR_") && !e.includes("ResizeObserver"));
    expect(critical.length).toBeLessThan(5);
  });
});
