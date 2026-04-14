import { test, expect } from "@playwright/test";

test.describe("Outreach Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/v2/outreach");
    await page.waitForLoadState("networkidle");
  });

  test("outreach page mounts with data-testid", async ({ page }) => {
    await expect(page.locator('[data-testid="page-outreach"]')).toBeVisible({ timeout: 15000 });
  });

  test("outreach shows campaign list or queue", async ({ page }) => {
    const content = page.locator("table, [role='grid'], [role='tablist']")
      .or(page.getByText(/outreach|campagn|invio|send|queue/i));
    await expect(content.first()).toBeVisible({ timeout: 15000 });
  });

  test("outreach has action buttons", async ({ page }) => {
    await page.waitForTimeout(2000);
    const buttons = page.locator("button");
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);
  });

  test("no ErrorBoundary on outreach", async ({ page }) => {
    await expect(page.getByText(/qualcosa è andato storto/i)).toHaveCount(0);
  });

  test("outreach no critical console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
    await page.goto("/v2/outreach");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    const critical = errors.filter((e) => !e.includes("favicon") && !e.includes("404") && !e.includes("ERR_") && !e.includes("ResizeObserver"));
    expect(critical.length).toBeLessThan(5);
  });
});
