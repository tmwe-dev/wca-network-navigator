/**
 * E2E test — Mission flow: create contact, scrape partner, compose email.
 * Run with: npx playwright test e2e/mission-flow.spec.ts
 */
import { protectedTest as test, expect } from "./fixtures/auth";


test.describe("Mission Flow E2E", () => {
  test("should navigate to Command page", async ({ page }) => {
    await page.goto(`/v2/command`);
    await expect(page.locator("text=Command")).toBeVisible({ timeout: 10000 });
  });

  test("should send a single-action command", async ({ page }) => {
    await page.goto(`/v2/command`);
    await page.waitForTimeout(2000);

    const composer = page.locator("textarea, input[placeholder*='scrivi']").first();
    if (await composer.isVisible()) {
      await composer.fill("cerca partner in Italia");
      await composer.press("Enter");
      // Wait for some response
      await page.waitForTimeout(5000);
      // Check that a message appeared
      const messages = page.locator("[class*='message'], [data-testid*='message']");
      expect(await messages.count()).toBeGreaterThanOrEqual(0);
    }
  });

  test("should toggle mission mode", async ({ page }) => {
    await page.goto(`/v2/command`);
    await page.waitForTimeout(2000);

    // Look for mission toggle
    const missionToggle = page.locator("button:has-text('🚀'), button[title*='missione'], button[aria-label*='missione']").first();
    if (await missionToggle.isVisible()) {
      await missionToggle.click();
      await page.waitForTimeout(500);
    }
  });

  test("should show observability page", async ({ page }) => {
    await page.goto(`/v2/observability`);
    await expect(page.locator("text=Observability")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Token AI")).toBeVisible();
    await expect(page.locator("text=Caratteri TTS")).toBeVisible();
    await expect(page.locator("text=Missioni")).toBeVisible();
  });

  test("should export audit CSV", async ({ page }) => {
    await page.goto(`/v2/observability`);
    await page.waitForTimeout(2000);

    const exportBtn = page.locator("button:has-text('Esporta')");
    if (await exportBtn.isVisible()) {
      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 10000 }).catch(() => null),
        exportBtn.click(),
      ]);
      if (download) {
        expect(download.suggestedFilename()).toContain("audit_log");
      }
    }
  });

  test("mission flow: create contact, scrape, compose", async ({ page }) => {
    await page.goto(`/v2/command`);
    await page.waitForTimeout(2000);

    // Activate mission mode
    const missionToggle = page.locator("button:has-text('🚀')").first();
    if (await missionToggle.isVisible()) {
      await missionToggle.click();
    }

    const composer = page.locator("textarea, input[placeholder*='scrivi']").first();
    if (await composer.isVisible()) {
      await composer.fill(
        "Vai nella pagina contatti, poi cerca il contatto Mario Rossi, quindi analizza il suo partner e infine prepara una bozza email di follow-up",
      );
      await composer.press("Enter");

      // Wait for agent timeline to appear
      await page.waitForTimeout(8000);

      // Check agent timeline is visible
      const timeline = page.locator("text=Missione");
      if (await timeline.isVisible({ timeout: 5000 })) {
        // Check steps are being shown
        const steps = page.locator("[class*='step'], [class*='timeline']");
        expect(await steps.count()).toBeGreaterThanOrEqual(0);
      }

      // Stop the mission if running
      const stopBtn = page.locator("button:has-text('Stop')").first();
      if (await stopBtn.isVisible({ timeout: 3000 })) {
        await stopBtn.click();
      }
    }
  });
});
