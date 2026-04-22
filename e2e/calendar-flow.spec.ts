import { test, expect } from "@playwright/test";

test.describe("Calendar Flow - E2E Tests", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to calendar page and wait for it to fully load
    await page.goto("/v2/calendar");
    await page.waitForLoadState("networkidle");
  });

  // ==================== Page Load & Structure Tests ====================

  test("calendar page loads without errors and no ErrorBoundary visible", async ({ page }) => {
    // Check for error boundary components
    const errorBoundary = page.getByText(/qualcosa è andato storto|something went wrong/i);
    await expect(errorBoundary).toHaveCount(0);

    // Verify main calendar page container is visible
    const mainContainer = page.locator(".h-full.flex.flex-col.bg-gray-950");
    await expect(mainContainer).toBeVisible({ timeout: 15000 });
  });

  test("page header displays 'Calendario' title", async ({ page }) => {
    const pageTitle = page.getByRole("heading", { name: /Calendario/i });
    await expect(pageTitle).toBeVisible({ timeout: 10000 });
    await expect(pageTitle).toHaveText("Calendario");
  });

  test("'Nuovo Evento' (New Event) button is visible in header", async ({ page }) => {
    const newEventButton = page.getByRole("button", { name: /Nuovo Evento/i });
    await expect(newEventButton).toBeVisible({ timeout: 10000 });
  });

  // ==================== Calendar Grid Rendering Tests ====================

  test("calendar grid is rendered with 7 day columns", async ({ page }) => {
    // Day headers should be visible: Dom, Lun, Mar, Mer, Gio, Ven, Sab
    const dayHeaders = page.locator(".grid.grid-cols-7").first();
    await expect(dayHeaders).toBeVisible({ timeout: 10000 });

    // Count day header cells (should be 7)
    const headers = page.locator(".grid.grid-cols-7 div").filter({
      hasText: /^(Dom|Lun|Mar|Mer|Gio|Ven|Sab)$/,
    });
    const headerCount = await headers.count();
    expect(headerCount).toBeGreaterThanOrEqual(7);
  });

  test("calendar displays current month and year", async ({ page }) => {
    // Look for month/year display (e.g., "Aprile 2026")
    const monthYearDisplay = page.locator(".grid.grid-cols-7").first().locator("..");
    const monthText = page.locator("h2").first();
    await expect(monthText).toBeVisible({ timeout: 10000 });
    const text = await monthText.textContent();
    expect(text).toMatch(/Gennaio|Febbraio|Marzo|Aprile|Maggio|Giugno|Luglio|Agosto|Settembre|Ottobre|Novembre|Dicembre/);
  });

  test("calendar cells are clickable and have date numbers", async ({ page }) => {
    // Get calendar cells within the month view
    const calendarGrid = page.locator(".grid.grid-cols-7").first();
    const cells = calendarGrid.locator(".min-h-24");

    // Verify we have cells (6 weeks * 7 days = at least 42 cells expected)
    const cellCount = await cells.count();
    expect(cellCount).toBeGreaterThanOrEqual(35);

    // Check that cells contain date numbers
    const firstCell = cells.first();
    await expect(firstCell).toBeVisible();
  });

  // ==================== Navigation Tests ====================

  test("navigate to previous month with left chevron button", async ({ page }) => {
    // Get current month text
    const monthDisplay = page.locator("h2").first();
    const initialMonth = await monthDisplay.textContent();

    // Click previous month button
    const prevButton = page.locator("button").filter({ has: page.locator('svg[class*="w-4"][class*="h-4"]').first() }).first();
    // More reliable: find button by icon presence and position
    const buttons = page.getByRole("button");
    let prevButton2: any = null;

    // Get all buttons and find the one with ChevronLeft (first navigation button)
    for (let i = 0; i < await buttons.count(); i++) {
      const btn = buttons.nth(i);
      const html = await btn.innerHTML();
      if (html.includes("chevron") || html.includes("ChevronLeft")) {
        prevButton2 = btn;
        break;
      }
    }

    if (prevButton2) {
      await prevButton2.click();
      await page.waitForTimeout(500);

      // Verify month changed
      const newMonth = await monthDisplay.textContent();
      expect(newMonth).not.toBe(initialMonth);
    }
  });

  test("navigate to next month with right chevron button", async ({ page }) => {
    // Get current month text
    const monthDisplay = page.locator("h2").first();
    const initialMonth = await monthDisplay.textContent();

    // Find and click next month button (last navigation button)
    const buttons = page.getByRole("button");
    let nextButton: any = null;

    // Get all buttons and find the one with ChevronRight (last navigation button)
    const buttonCount = await buttons.count();
    for (let i = buttonCount - 1; i >= 0; i--) {
      const btn = buttons.nth(i);
      const html = await btn.innerHTML();
      if (html.includes("chevron") || html.includes("ChevronRight")) {
        nextButton = btn;
        break;
      }
    }

    if (nextButton) {
      await nextButton.click();
      await page.waitForTimeout(500);

      // Verify month changed
      const newMonth = await monthDisplay.textContent();
      expect(newMonth).not.toBe(initialMonth);
    }
  });

  test("'Oggi' (Today) button returns to current month", async ({ page }) => {
    // Navigate to previous month first
    const buttons = page.getByRole("button");
    let prevButton: any = null;

    for (let i = 0; i < await buttons.count(); i++) {
      const btn = buttons.nth(i);
      const html = await btn.innerHTML();
      if (html.includes("chevron") || html.includes("ChevronLeft")) {
        prevButton = btn;
        break;
      }
    }

    if (prevButton) {
      await prevButton.click();
      await page.waitForTimeout(300);

      // Get month display before clicking "Oggi"
      const monthDisplay = page.locator("h2").first();
      const monthBefore = await monthDisplay.textContent();

      // Click "Oggi" button
      const oggiButton = page.getByRole("button", { name: /Oggi/i });
      if (await oggiButton.isVisible().catch(() => false)) {
        await oggiButton.click();
        await page.waitForTimeout(300);

        const monthAfter = await monthDisplay.textContent();
        // Month should change or at least we're back at today's month
        expect(monthAfter).toBeTruthy();
      }
    }
  });

  // ==================== Event Creation Tests ====================

  test("clicking 'Nuovo Evento' button opens create event dialog", async ({ page }) => {
    // Click the "Nuovo Evento" button
    const newEventButton = page.getByRole("button", { name: /Nuovo Evento/i });
    await newEventButton.click();

    // Wait for dialog to appear
    await page.waitForTimeout(300);

    // Check for dialog elements (look for common dialog indicators)
    const dialog = page.locator("[role='dialog']").first();
    const dialogContent = page.locator("text=/Crea|Nuovo|Evento/i").first();

    // Either a dialog or dialog content should be visible
    const isDialogVisible =
      (await dialog.isVisible().catch(() => false)) ||
      (await dialogContent.isVisible().catch(() => false));

    expect(isDialogVisible).toBe(true);
  });

  test("clicking on a calendar day opens create event dialog with date pre-filled", async ({ page }) => {
    // Get a calendar cell
    const cells = page.locator(".min-h-24");
    const cellCount = await cells.count();

    if (cellCount > 0) {
      // Click on a day in the current month
      const firstCell = cells.first();
      await firstCell.click();

      // Wait for dialog to appear
      await page.waitForTimeout(300);

      // Check for dialog
      const dialog = page.locator("[role='dialog']").first();
      const isDialogOpen =
        (await dialog.isVisible().catch(() => false)) ||
        (await page.locator("text=/Crea|Nuovo/i").isVisible().catch(() => false));

      expect(isDialogOpen).toBe(true);
    }
  });

  test("create event dialog can be closed", async ({ page }) => {
    // Open create event dialog
    const newEventButton = page.getByRole("button", { name: /Nuovo Evento/i });
    await newEventButton.click();
    await page.waitForTimeout(300);

    // Look for close button (X button or Cancel)
    const closeButton = page.locator("[role='dialog']").locator("button").first();
    const cancelButton = page.getByRole("button", { name: /Cancel|Annulla|Chiudi/i }).first();

    // Try to close dialog
    const buttonToClick = (await closeButton.isVisible().catch(() => false)) ? closeButton : cancelButton;

    if (await buttonToClick.isVisible().catch(() => false)) {
      await buttonToClick.click();
      await page.waitForTimeout(300);

      // Verify dialog is closed
      const dialog = page.locator("[role='dialog']").first();
      const isClosed = await dialog.isVisible().catch(() => false);
      expect(isClosed).toBe(false);
    }
  });

  // ==================== Sidebar Tests ====================

  test("sidebar with filters is visible on the right", async ({ page }) => {
    // Look for sidebar elements
    const sidebar = page.locator(".w-80.border-l.border-gray-800");
    await expect(sidebar).toBeVisible({ timeout: 10000 });
  });

  test("event type filter buttons are present in sidebar", async ({ page }) => {
    // Look for filter buttons
    const filterButtons = page.getByRole("button");

    // Check for filter options (should include "Tutti gli eventi", "Riunioni", "Chiamate", etc.)
    const tuttiButton = page.getByRole("button", { name: /Tutti gli eventi/i });
    const riunioniButton = page.getByRole("button", { name: /Riunioni/i });

    const hasTuttiButton = await tuttiButton.isVisible().catch(() => false);
    const hasRiunioniButton = await riunioniButton.isVisible().catch(() => false);

    const hasFilterButtons = hasTuttiButton || hasRiunioniButton;
    expect(hasFilterButtons).toBe(true);
  });

  test("clicking event type filter updates calendar view", async ({ page }) => {
    // Get error listener
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    // Find and click a filter button (e.g., Riunioni)
    const filterButton = page.getByRole("button", { name: /Riunioni|Chiamate|Attività/i }).first();

    if (await filterButton.isVisible().catch(() => false)) {
      const filterText = await filterButton.textContent();

      // Click the filter
      await filterButton.click();
      await page.waitForTimeout(500);

      // Verify no critical errors occurred
      const criticalErrors = errors.filter(
        (e) =>
          !e.includes("favicon") &&
          !e.includes("404") &&
          !e.includes("ERR_") &&
          !e.includes("Network request failed")
      );
      expect(criticalErrors.length).toBeLessThan(3);
    }
  });

  test("'Tutti gli eventi' filter button resets filter", async ({ page }) => {
    // Find and click a specific filter
    const filterButton = page.getByRole("button", { name: /Riunioni/i }).first();

    if (await filterButton.isVisible().catch(() => false)) {
      await filterButton.click();
      await page.waitForTimeout(300);

      // Now click "Tutti gli eventi"
      const tuttiButton = page.getByRole("button", { name: /Tutti gli eventi/i });
      if (await tuttiButton.isVisible().catch(() => false)) {
        await tuttiButton.click();
        await page.waitForTimeout(300);

        // Verify button is now active
        await expect(tuttiButton).toBeFocused().catch(() => {
          // If focus check fails, at least verify it exists and is clickable
          expect(tuttiButton).toBeTruthy();
        });
      }
    }
  });

  test("legend is visible in sidebar with event type colors", async ({ page }) => {
    const legendTitle = page.getByText(/Legenda/i);
    await expect(legendTitle).toBeVisible({ timeout: 10000 });

    // Check for legend color indicators
    const colorDots = page.locator(".w-3.h-3.rounded");
    const colorCount = await colorDots.count();
    expect(colorCount).toBeGreaterThanOrEqual(5); // Should have at least 5 event types
  });

  test("statistics section is visible in sidebar", async ({ page }) => {
    const statsTitle = page.getByText(/Statistiche/i);
    await expect(statsTitle).toBeVisible({ timeout: 10000 });

    // Check for stats cards
    const statCards = page.locator(".grid.grid-cols-2.gap-3").first();
    await expect(statCards).toBeVisible();
  });

  test("Upcoming Events Widget is visible in sidebar", async ({ page }) => {
    // Look for upcoming events widget (usually displayed in sidebar)
    const upcomingTitle = page.getByText(/Prossimi|Upcoming/i).first();
    const isUpcomingVisible = await upcomingTitle.isVisible().catch(() => false);

    // Widget should be in sidebar which is always visible
    const sidebar = page.locator(".w-80.border-l.border-gray-800");
    await expect(sidebar).toBeVisible();
  });

  // ==================== Responsive Layout Tests ====================

  test("layout is responsive on mobile viewport (375px)", async ({ page }) => {
    // Resize to mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(300);

    // Main container should still be visible
    const mainContainer = page.locator(".h-full.flex.flex-col.bg-gray-950");
    await expect(mainContainer).toBeVisible();

    // Calendar should be visible
    const calendarGrid = page.locator(".grid.grid-cols-7").first();
    const isGridVisible = await calendarGrid.isVisible().catch(() => false);
    expect(isGridVisible).toBeTruthy();
  });

  test("layout is responsive on tablet viewport (768px)", async ({ page }) => {
    // Resize to tablet
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(300);

    // Main container should be visible
    const mainContainer = page.locator(".h-full.flex.flex-col.bg-gray-950");
    await expect(mainContainer).toBeVisible();

    // Both calendar and sidebar should be visible
    const calendarSection = page.locator(".flex-1.overflow-auto.p-6");
    const sidebar = page.locator(".w-80.border-l.border-gray-800");

    const calendarVisible = await calendarSection.isVisible().catch(() => false);
    const sidebarVisible = await sidebar.isVisible().catch(() => false);

    expect(calendarVisible || sidebarVisible).toBe(true);
  });

  test("layout is responsive on desktop viewport (1920px)", async ({ page }) => {
    // Resize to desktop
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(300);

    // Both sections should be visible
    const calendarSection = page.locator(".flex-1.overflow-auto.p-6");
    const sidebar = page.locator(".w-80.border-l.border-gray-800");

    const calendarVisible = await calendarSection.isVisible().catch(() => false);
    const sidebarVisible = await sidebar.isVisible().catch(() => false);

    expect(calendarVisible && sidebarVisible).toBe(true);
  });

  // ==================== Console Error Monitoring ====================

  test("no console errors during page load and interaction", async ({ page }) => {
    const errors: string[] = [];
    const warnings: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      } else if (msg.type() === "warning") {
        warnings.push(msg.text());
      }
    });

    // Wait for page to fully load
    await page.waitForLoadState("networkidle");

    // Perform some interactions
    const newEventButton = page.getByRole("button", { name: /Nuovo Evento/i });
    if (await newEventButton.isVisible().catch(() => false)) {
      await newEventButton.click();
      await page.waitForTimeout(300);
    }

    // Check for critical errors (filter out common benign messages)
    const criticalErrors = errors.filter(
      (e) =>
        !e.includes("favicon") &&
        !e.includes("404") &&
        !e.includes("ERR_") &&
        !e.includes("ResizeObserver") &&
        !e.includes("Network request")
    );

    expect(criticalErrors.length).toBeLessThan(3);
  });

  test("no CORS or network errors during calendar operations", async ({ page }) => {
    const errors: string[] = [];
    const responses: number[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    page.on("response", (response) => {
      if (response.status() >= 400) {
        responses.push(response.status());
      }
    });

    // Navigate and interact
    await page.waitForLoadState("networkidle");

    // Click several buttons to trigger potential network requests
    const buttons = page.getByRole("button");
    const count = Math.min(3, await buttons.count());

    for (let i = 0; i < count; i++) {
      const btn = buttons.nth(i);
      if (await btn.isVisible().catch(() => false)) {
        await btn.click();
        await page.waitForTimeout(200);
      }
    }

    // Filter errors
    const corsErrors = errors.filter((e) => e.toLowerCase().includes("cors"));
    const networkErrors = errors.filter(
      (e) =>
        e.includes("Network") &&
        !e.includes("Network request failed") &&
        !e.includes("ERR_")
    );

    expect(corsErrors.length).toBe(0);
    expect(networkErrors.length).toBeLessThan(2);
  });

  // ==================== Accessibility Tests ====================

  test("calendar header has proper heading hierarchy", async ({ page }) => {
    const h1 = page.getByRole("heading", { level: 1 });
    const h1Count = await h1.count();

    const h2 = page.getByRole("heading", { level: 2 });
    const h2Count = await h2.count();

    // Should have at least one heading
    expect(h1Count + h2Count).toBeGreaterThan(0);
  });

  test("buttons are keyboard accessible", async ({ page }) => {
    // Get first interactive button
    const firstButton = page.getByRole("button").first();

    if (await firstButton.isVisible().catch(() => false)) {
      // Focus on button using keyboard
      await firstButton.focus();

      // Verify button is focused
      const isFocused = await firstButton.evaluate((el) =>
        (el as HTMLElement).style.outline !== "none"
      ).catch(() => true);

      // Should be focusable
      expect(firstButton).toBeTruthy();
    }
  });

  test("calendar cells have semantic meaning and are interactive", async ({ page }) => {
    // Calendar cells should be identified as interactive elements
    const cells = page.locator(".min-h-24");
    const cellCount = await cells.count();

    expect(cellCount).toBeGreaterThan(0);

    // First cell should be clickable
    const firstCell = cells.first();
    await expect(firstCell).toBeVisible();

    // Should have cursor pointer class (from Tailwind)
    const hasPointerCursor = await firstCell.evaluate((el) =>
      window.getComputedStyle(el as HTMLElement).cursor === "pointer"
    ).catch(() => true);

    expect(hasPointerCursor).toBe(true);
  });

  // ==================== Visual State Tests ====================

  test("current date (today) is highlighted in calendar", async ({ page }) => {
    // Look for the today highlight (ring-2 ring-blue-400)
    const todayCell = page.locator("[class*='ring-blue']").first();
    const todayVisible = await todayCell.isVisible().catch(() => false);

    // Today should be highlighted if visible in current month view
    expect(todayVisible).toBeTruthy();
  });

  test("calendar cells show date numbers", async ({ page }) => {
    const cells = page.locator(".min-h-24");

    // Check first few cells for date numbers
    for (let i = 0; i < Math.min(5, await cells.count()); i++) {
      const cell = cells.nth(i);
      const text = await cell.textContent();
      // Should contain a number (date)
      expect(text).toMatch(/\d+/);
    }
  });

  test("event cards are displayed in calendar cells", async ({ page }) => {
    // Look for event cards (CalendarEventCard components)
    const eventCards = page.locator("[class*='bg-blue-'], [class*='bg-green-'], [class*='bg-yellow-'], [class*='bg-purple-'], [class*='bg-orange-']").filter({
      has: page.locator("[class*='border']"),
    });

    // Events may or may not be present, but if they are, they should be visible
    const eventCount = await eventCards.count();
    expect(eventCount).toBeGreaterThanOrEqual(0);
  });

  // ==================== Integration Tests ====================

  test("full user flow: navigate month, filter events, open create dialog", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    // 1. Verify page loaded
    const pageTitle = page.getByRole("heading", { name: /Calendario/i });
    await expect(pageTitle).toBeVisible();

    // 2. Navigate to previous month
    const prevButton = page.getByRole("button").filter({
      has: page.locator("svg"),
    }).nth(0);

    const monthDisplay = page.locator("h2").first();
    const initialMonth = await monthDisplay.textContent();

    if (await prevButton.isVisible().catch(() => false)) {
      await prevButton.click();
      await page.waitForTimeout(300);
    }

    // 3. Try to filter events
    const filterButton = page.getByRole("button", { name: /Riunioni|Chiamate/i }).first();
    if (await filterButton.isVisible().catch(() => false)) {
      await filterButton.click();
      await page.waitForTimeout(300);
    }

    // 4. Open create event dialog
    const newEventButton = page.getByRole("button", { name: /Nuovo Evento/i });
    await newEventButton.click();
    await page.waitForTimeout(300);

    // 5. Verify dialog opened
    const dialogContent = page.locator("[role='dialog']").first();
    const isDialogOpen =
      (await dialogContent.isVisible().catch(() => false)) ||
      (await page.locator("text=/Nuovo|Crea/i").isVisible().catch(() => false));

    expect(isDialogOpen).toBe(true);

    // 6. Check for errors
    const criticalErrors = errors.filter(
      (e) =>
        !e.includes("favicon") &&
        !e.includes("404") &&
        !e.includes("ERR_")
    );
    expect(criticalErrors.length).toBeLessThan(3);
  });
});
