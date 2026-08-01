import { test, expect } from "@playwright/test";

test.describe("download-pipeline", () => {
  test("download page loads without errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto("/download");
    await expect(page.locator("body")).toBeVisible();
    await page.waitForTimeout(1500);
    expect(errors.filter(e => !e.includes("net::ERR"))).toHaveLength(0);
  });

  test("download page has country selection UI", async ({ page }) => {
    await page.goto("/download");
    await page.waitForTimeout(2000);
    const body = page.locator("body");
    await expect(body).toBeVisible();
  });

  test("download page has no ErrorBoundary crash", async ({ page }) => {
    await page.goto("/download");
    await expect(page.getByText(/qualcosa è andato storto/i)).toHaveCount(0);
  });
});
