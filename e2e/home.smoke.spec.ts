import { test, expect } from "@playwright/test";

test.describe("home @smoke", () => {
  test("la root monta senza errori console critici", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
    page.on("console", (msg) => { if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`); });
    await page.goto("/");
    await expect(page.locator("#root")).not.toBeEmpty({ timeout: 10_000 });
    expect(errors, errors.join("\n")).toHaveLength(0);
  });

  test("nessun ErrorBoundary visibile al primo render", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/qualcosa è andato storto/i)).toHaveCount(0);
  });

  test("il root element contiene contenuto", async ({ page }) => {
    await page.goto("/");
    const root = page.locator("#root");
    await expect(root).not.toBeEmpty({ timeout: 10_000 });
    const childCount = await root.locator("> *").count();
    expect(childCount).toBeGreaterThan(0);
  });

  test("la pagina ha un titolo", async ({ page }) => {
    await page.goto("/");
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });
});
