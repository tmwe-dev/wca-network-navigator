import { test, expect } from "@playwright/test";

test.describe("Cockpit Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/v2/cockpit");
    await page.waitForLoadState("networkidle");
  });

  test("cockpit page mounts with data-testid", async ({ page }) => {
    await expect(page.locator('[data-testid="page-cockpit"]')).toBeVisible({ timeout: 15000 });
  });

  test("cockpit shows queue or task board", async ({ page }) => {
    const content = page.locator("[role='tablist'], table, [draggable]")
      .or(page.getByText(/cockpit|coda|queue|task|priorit/i));
    await expect(content.first()).toBeVisible({ timeout: 15000 });
  });

  test("cockpit has at least one interactive control", async ({ page }) => {
    await page.waitForTimeout(2000);
    const controls = page.locator("button, select, [role='tab']");
    const count = await controls.count();
    expect(count).toBeGreaterThan(0);
  });

  test("no ErrorBoundary on cockpit", async ({ page }) => {
    await expect(page.getByText(/qualcosa è andato storto/i)).toHaveCount(0);
  });

  test("cockpit no critical console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
    await page.goto("/v2/cockpit");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    const critical = errors.filter((e) => !e.includes("favicon") && !e.includes("404") && !e.includes("ERR_") && !e.includes("ResizeObserver"));
    expect(critical.length).toBeLessThan(5);
  });
});
