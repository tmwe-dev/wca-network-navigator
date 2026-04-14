import { test, expect } from "@playwright/test";

test.describe("ai-assistant", () => {
  test("ai chat page loads", async ({ page }) => {
    await page.goto("/agent-chat");
    await expect(page.locator("body")).toBeVisible();
  });

  test("ai chat page has no crash", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto("/agent-chat");
    await page.waitForTimeout(1500);
    expect(errors.filter(e => !e.includes("net::ERR"))).toHaveLength(0);
  });

  test("ai chat page has no ErrorBoundary", async ({ page }) => {
    await page.goto("/agent-chat");
    await expect(page.getByText(/qualcosa è andato storto/i)).toHaveCount(0);
  });
});
