import { test, expect } from "@playwright/test";

test.describe("PWA Offline Experience", () => {
  test("shows offline banner when network is lost", async ({ page, context }) => {
    await page.goto("/");
    await context.setOffline(true);
    const banner = page.locator('[role="alert"]');
    await expect(banner).toBeVisible({ timeout: 5000 });
    await expect(banner).toContainText(/offline/i);
  });

  test("hides offline banner when network returns", async ({ page, context }) => {
    await page.goto("/");
    await context.setOffline(true);
    await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 5000 });
    await context.setOffline(false);
    await expect(page.locator('[role="alert"]')).not.toBeVisible({ timeout: 5000 });
  });

  test("serves offline fallback for uncached routes", async ({ page, context }) => {
    // Go offline BEFORE navigating to uncached route
    await context.setOffline(true);
    await page.goto("/v2/never-visited-route-xyz", { waitUntil: "domcontentloaded" }).catch(() => {});
    const bodyText = await page.textContent("body");
    // Should show offline content or error
    expect(bodyText?.toLowerCase() ?? "").toMatch(/offline|error|unavailable|connessione/);
  });

  test("cached pages load offline after initial visit", async ({ page, context }) => {
    await page.goto("/");
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator("body")).toBeVisible({ timeout: 10000 });
    // Verify content is present, not just a blank page
    const bodyText = await page.textContent("body");
    expect(bodyText?.length ?? 0).toBeGreaterThan(10);
  });

  test("offline banner persists across navigation attempts", async ({ page, context }) => {
    await page.goto("/");
    await context.setOffline(true);
    const banner = page.locator('[role="alert"]');
    await expect(banner).toBeVisible({ timeout: 5000 });

    // Try navigating — banner should persist
    await page.evaluate(() => window.history.pushState({}, "", "/settings"));
    await expect(banner).toBeVisible({ timeout: 3000 });
  });
});
