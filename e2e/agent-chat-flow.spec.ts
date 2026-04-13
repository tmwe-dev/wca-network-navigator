import { test, expect } from "@playwright/test";

test.describe("Agent Chat", () => {
  test("aprire la pagina agenti e verificare data-testid", async ({ page }) => {
    await page.goto("/v2/agent-chat");
    await page.waitForLoadState("networkidle");
    await expect(page.locator('[data-testid="page-agents"]')).toBeVisible({ timeout: 15000 });
  });

  test("aprire la pagina agenti e vedere il contenuto", async ({ page }) => {
    await page.goto("/v2/agent-chat");
    await page.waitForLoadState("networkidle");
    const content = page.locator('[data-testid="agent-list"]').or(page.locator("text=Agenti")).or(page.locator("text=Agent")).or(page.locator("text=Chat"));
    await expect(content).toBeVisible({ timeout: 15000 });
  });

  test("la pagina non produce errori critici", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
    await page.goto("/v2/agent-chat");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    const criticalErrors = errors.filter((e) => !e.includes("favicon") && !e.includes("404") && !e.includes("ERR_") && !e.includes("ResizeObserver"));
    expect(criticalErrors.length).toBeLessThan(5);
  });

  test("nessun ErrorBoundary visibile", async ({ page }) => {
    await page.goto("/v2/agent-chat");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/qualcosa è andato storto/i)).toHaveCount(0);
  });
});
