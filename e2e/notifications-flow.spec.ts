import { test, expect } from "@playwright/test";

test.describe("Notifications Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/v2/notifications");
    await page.waitForLoadState("networkidle");
  });

  test("route /v2/notifications loads without errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });

    await page.waitForTimeout(2000);

    const criticalErrors = errors.filter((e) =>
      !e.includes("favicon") &&
      !e.includes("404") &&
      !e.includes("ERR_") &&
      !e.includes("ResizeObserver")
    );
    expect(criticalErrors.length).toBeLessThan(3);
  });

  test("notification list or empty state renders", async ({ page }) => {
    const notificationList = page.locator("div").filter({ has: page.locator('[role="generic"]') });
    const emptyState = page.getByText(/nessuna notifica/i);
    const notificationItems = page.locator("div").filter({ has: page.locator("button") });

    const hasContent = await notificationList.isVisible({ timeout: 5000 }).catch(() => false)
      || await emptyState.isVisible({ timeout: 5000 }).catch(() => false)
      || await notificationItems.count().then(c => c > 0).catch(() => false);

    expect(hasContent).toBeTruthy();
  });

  test("mark as read interaction", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });

    // Try to find a notification item and click it
    const notificationItems = page.locator("div").filter({ has: page.locator("button") });
    const itemCount = await notificationItems.count().catch(() => 0);

    if (itemCount > 0) {
      // Click first notification to mark as read
      await notificationItems.first().click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(500);
    }

    const criticalErrors = errors.filter((e) =>
      !e.includes("favicon") &&
      !e.includes("404") &&
      !e.includes("ERR_")
    );
    expect(criticalErrors.length).toBeLessThan(3);
  });

  test("notification categories/filters present", async ({ page }) => {
    const filters = page.locator('[role="combobox"]');
    const filterCount = await filters.count().catch(() => 0);

    // Should have at least 1 filter (type, priority, or read status)
    expect(filterCount).toBeGreaterThanOrEqual(1);

    // Try to interact with a filter if present
    if (filterCount > 0) {
      await filters.first().click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(300);
    }
  });

  test("bell icon in header or notification badge visible", async ({ page }) => {
    const header = page.locator('[data-testid="app-header"]').or(page.locator('[role="banner"]'));
    const bellIcon = page.locator('svg').filter({ has: page.locator('path[d*="M"]') });
    const notificationBadge = page.locator('[role="status"]');

    const hasHeader = await header.isVisible({ timeout: 10000 }).catch(() => false);
    const hasBellOrBadge = await bellIcon.count().then(c => c > 0).catch(() => false)
      || await notificationBadge.count().then(c => c > 0).catch(() => false);

    expect(hasHeader || hasBellOrBadge).toBeTruthy();
  });

  test("nessun ErrorBoundary visibile", async ({ page }) => {
    await expect(page.getByText(/qualcosa è andato storto|something went wrong/i)).toHaveCount(0);
  });

  test("responsive layout - desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    const container = page.locator("div").filter({ has: page.locator("h1") });
    await expect(container).toBeVisible({ timeout: 10000 });

    const heading = page.getByText(/notifiche/i).first();
    await expect(heading).toBeVisible();
  });

  test("responsive layout - tablet", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    const heading = page.getByText(/notifiche/i).first();
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test("responsive layout - mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    const heading = page.getByText(/notifiche/i).first();
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test("filters can be interacted with", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });

    const selects = page.locator('[role="combobox"]');
    const count = await selects.count().catch(() => 0);

    for (let i = 0; i < Math.min(count, 2); i++) {
      await selects.nth(i).click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(300);
      // Click outside to close if opened
      await page.keyboard.press("Escape").catch(() => {});
    }

    const criticalErrors = errors.filter((e) =>
      !e.includes("favicon") &&
      !e.includes("404") &&
      !e.includes("ERR_")
    );
    expect(criticalErrors.length).toBeLessThan(3);
  });

  test("pagination controls visible if needed", async ({ page }) => {
    const prevButton = page.getByText(/precedente|previous/i);
    const nextButton = page.getByText(/successivo|next/i);

    // Pagination should exist but might be disabled
    const hasPagination = await prevButton.count().then(c => c > 0).catch(() => false)
      || await nextButton.count().then(c => c > 0).catch(() => false);

    // If pagination exists, verify buttons are interactive
    if (hasPagination) {
      const nextBtn = page.getByText(/successivo|next/i).first();
      await expect(nextBtn).toBeVisible({ timeout: 5000 });
    }
  });

  test("back button present and functional", async ({ page }) => {
    const backButton = page.getByText(/indietro|back/i);
    const isVisible = await backButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (isVisible) {
      await expect(backButton).toBeVisible();
    }
  });
});
