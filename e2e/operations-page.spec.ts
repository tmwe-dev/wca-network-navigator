import { test, expect } from "@playwright/test";

test.describe("operations-page", () => {
  test("operations page loads", async ({ page }) => {
    await page.goto("/operations");
    await expect(page.locator("body")).toBeVisible();
  });

  test("operations page has no crash", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto("/operations");
    await page.waitForTimeout(1500);
    expect(errors.filter(e => !e.includes("net::ERR"))).toHaveLength(0);
  });

  test("operations page has no ErrorBoundary", async ({ page }) => {
    await page.goto("/operations");
    await expect(page.getByText(/qualcosa è andato storto/i)).toHaveCount(0);
  });
});
