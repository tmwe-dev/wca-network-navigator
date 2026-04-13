import { test, expect } from "@playwright/test";

test.describe("PWA Offline Experience", () => {
  test("shows offline banner when network is lost", async ({ page, context }) => {
    await page.goto("/");
    await context.setOffline(true);
    const banner = page.locator('[role="alert"]');
    await expect(banner).toBeVisible({ timeout: 5000 });
  });

  test("hides offline banner when network returns", async ({ page, context }) => {
    await page.goto("/");
    await context.setOffline(true);
    await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 5000 });
    await context.setOffline(false);
    await expect(page.locator('[role="alert"]')).not.toBeVisible({ timeout: 5000 });
  });

  test("cached pages load offline after initial visit", async ({ page, context }) => {
    await page.goto("/");
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator("body")).toBeVisible({ timeout: 10000 });
  });
});
