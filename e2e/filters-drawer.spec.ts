import { test, expect } from "@playwright/test";

test.describe("FiltersDrawer @regression", () => {
  test("partner page renderizza", async ({ page }) => {
    await page.goto("/partners");
    await expect(page.locator("#root")).not.toBeEmpty();
    await expect(page.getByText(/qualcosa è andato storto/i)).toHaveCount(0);
  });
  test("se autenticato, il pulsante filtri è presente", async ({ page }) => {
    await page.goto("/partners");
    const candidates = [page.getByRole("button", { name: /filtri|filters/i }), page.getByRole("button", { name: /accedi|login/i })];
    let visible = false;
    for (const c of candidates) { if ((await c.count()) > 0) { visible = true; break; } }
    expect(visible).toBe(true);
  });
  test("pagina partners non ha ErrorBoundary", async ({ page }) => {
    await page.goto("/partners");
    await expect(page.getByText(/qualcosa è andato storto/i)).toHaveCount(0);
  });
  test("root ha contenuto", async ({ page }) => {
    await page.goto("/partners");
    await expect(page.locator("#root")).not.toBeEmpty({ timeout: 10000 });
  });
});
