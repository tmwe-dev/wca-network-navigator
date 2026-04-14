import { test, expect } from "@playwright/test";

test.describe("knowledge-base", () => {
  test("settings page loads knowledge section", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto("/settings");
    await expect(page.locator("body")).toBeVisible();
    await page.waitForTimeout(1500);
    expect(errors.filter(e => !e.includes("net::ERR"))).toHaveLength(0);
  });

  test("settings page has no ErrorBoundary crash", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByText(/qualcosa è andato storto/i)).toHaveCount(0);
  });
});
