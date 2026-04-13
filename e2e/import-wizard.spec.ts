import { test, expect } from "@playwright/test";

test.describe("ImportWizard @regression", () => {
  test("la pagina import è raggiungibile", async ({ page }) => {
    await page.goto("/import");
    await expect(page.locator("#root")).not.toBeEmpty();
    await expect(page.getByText(/qualcosa è andato storto/i)).toHaveCount(0);
  });
  test("mostra header o login", async ({ page }) => {
    await page.goto("/import");
    const candidates = [page.getByRole("heading", { name: /import|importazione/i }), page.getByRole("button", { name: /accedi|login/i })];
    let visible = false;
    for (const c of candidates) { if ((await c.count()) > 0) { visible = true; break; } }
    expect(visible).toBe(true);
  });
  test("no ErrorBoundary", async ({ page }) => {
    await page.goto("/import");
    await expect(page.getByText(/qualcosa è andato storto/i)).toHaveCount(0);
  });
  test("root ha contenuto", async ({ page }) => {
    await page.goto("/import");
    await expect(page.locator("#root")).not.toBeEmpty({ timeout: 10000 });
  });
});
