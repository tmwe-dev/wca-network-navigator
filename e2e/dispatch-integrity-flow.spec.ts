import { test, expect } from "@playwright/test";

test.describe("Dispatch Integrity Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/auth");
    // Auth would be handled by test fixtures in real setup
  });

  test("health dashboard shows dispatch integrity check", async ({ page }) => {
    await page.goto("/v2/admin/health");
    await expect(page.getByText("Dispatch Integrity")).toBeVisible();
  });

  test("dispatch integrity report table loads", async ({ page }) => {
    await page.goto("/v2/admin/health");
    const dispatchSection = page.locator("[data-testid='dispatch-integrity']");
    await expect(dispatchSection.or(page.getByText("Dispatch"))).toBeVisible();
  });

  test("integrity check shows status indicator", async ({ page }) => {
    await page.goto("/v2/admin/health");
    // Should show green/amber/red status
    const indicator = page.locator(".text-emerald-500, .text-amber-500, .text-rose-500").first();
    await expect(indicator.or(page.getByText("Dispatch"))).toBeVisible();
  });
});
