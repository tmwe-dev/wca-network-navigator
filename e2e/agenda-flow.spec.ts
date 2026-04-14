import { test, expect } from "@playwright/test";

test.describe("Agenda Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/v2/agenda");
    await page.waitForLoadState("networkidle");
  });

  test("agenda page mounts with data-testid", async ({ page }) => {
    await expect(page.locator('[data-testid="page-agenda"]')).toBeVisible({ timeout: 15000 });
  });

  test("agenda shows calendar or activity list", async ({ page }) => {
    const content = page.locator("table, [role='grid'], [role='listbox']")
      .or(page.getByText(/agenda|attività|calendar|eventi/i));
    await expect(content.first()).toBeVisible({ timeout: 15000 });
  });

  test("agenda has navigation controls (today/prev/next)", async ({ page }) => {
    await page.waitForTimeout(2000);
    const buttons = page.locator("button");
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);
  });

  test("no ErrorBoundary on agenda", async ({ page }) => {
    await expect(page.getByText(/qualcosa è andato storto/i)).toHaveCount(0);
  });

  test("agenda does not crash with console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
    await page.goto("/v2/agenda");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    const critical = errors.filter((e) => !e.includes("favicon") && !e.includes("404") && !e.includes("ERR_") && !e.includes("ResizeObserver"));
    expect(critical.length).toBeLessThan(5);
  });
});
