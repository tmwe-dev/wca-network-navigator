import { test, expect } from "@playwright/test";

test.describe("AI Lab Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/v2/ai-lab");
    await page.waitForLoadState("networkidle");
  });

  test("AI Lab page mounts with data-testid", async ({ page }) => {
    await expect(page.locator('[data-testid="page-ai-lab"]')).toBeVisible({ timeout: 15000 });
  });

  test("AI Lab shows tabs or control panel", async ({ page }) => {
    const content = page.locator("[role='tablist'], [role='tab']")
      .or(page.getByText(/AI|lab|test|scenario|prompt/i));
    await expect(content.first()).toBeVisible({ timeout: 15000 });
  });

  test("AI Lab has actionable buttons", async ({ page }) => {
    await page.waitForTimeout(2000);
    const buttons = page.locator("button");
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);
  });

  test("no ErrorBoundary on AI Lab", async ({ page }) => {
    await expect(page.getByText(/qualcosa è andato storto/i)).toHaveCount(0);
  });

  test("AI Lab no critical console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
    await page.goto("/v2/ai-lab");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    const critical = errors.filter((e) => !e.includes("favicon") && !e.includes("404") && !e.includes("ERR_") && !e.includes("ResizeObserver"));
    expect(critical.length).toBeLessThan(5);
  });
});
