import { test, expect } from "@playwright/test";

test.describe("Outreach & Holding Pattern", () => {
  test("navigare a Outreach e vedere il Command Center", async ({ page }) => {
    await page.goto("/v2/outreach");
    await page.waitForLoadState("networkidle");

    const content = page
      .locator("text=Holding")
      .or(page.locator("text=Attesa"))
      .or(page.locator('[data-testid="holding-pattern"]'))
      .or(page.locator('[role="tablist"]'));
    await expect(content).toBeVisible({ timeout: 15000 });
  });

  test("switchare canali senza crash", async ({ page }) => {
    await page.goto("/v2/outreach");
    await page.waitForLoadState("networkidle");

    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    const channelTabs = page.locator('[role="tab"]');
    const count = await channelTabs.count();
    if (count >= 2) {
      await channelTabs.nth(1).click();
      await page.waitForTimeout(500);
    }

    const criticalErrors = errors.filter(
      (e) => !e.includes("favicon") && !e.includes("404") && !e.includes("ERR_")
    );
    expect(criticalErrors.length).toBeLessThan(3);
  });
});
