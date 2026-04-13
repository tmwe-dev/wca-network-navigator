import { test, expect } from "@playwright/test";

test.describe("Email Intelligence", () => {
  test("navigare a Email Intelligence e verificare data-testid", async ({ page }) => {
    await page.goto("/v2/email-intelligence");
    await page.waitForLoadState("networkidle");
    await expect(page.locator('[data-testid="page-email-intelligence"]')).toBeVisible({ timeout: 15000 });
  });

  test("navigare a Email Intelligence e vedere contenuto", async ({ page }) => {
    await page.goto("/v2/email-intelligence");
    await page.waitForLoadState("networkidle");
    const content = page.locator("text=Manual").or(page.locator("text=Manuale")).or(page.locator("text=Smart Inbox")).or(page.locator('[role="tab"]'));
    await expect(content).toBeVisible({ timeout: 15000 });
  });

  test("switchare tra le tab senza errori critici", async ({ page }) => {
    await page.goto("/v2/email-intelligence");
    await page.waitForLoadState("networkidle");
    const errors: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
    const tabs = page.locator('[role="tab"]');
    const count = await tabs.count();
    for (let i = 0; i < count; i++) { await tabs.nth(i).click(); await page.waitForTimeout(500); }
    const criticalErrors = errors.filter((e) => !e.includes("favicon") && !e.includes("404") && !e.includes("ERR_"));
    expect(criticalErrors.length).toBeLessThan(3);
  });

  test("nessun ErrorBoundary visibile", async ({ page }) => {
    await page.goto("/v2/email-intelligence");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/qualcosa è andato storto/i)).toHaveCount(0);
  });
});
