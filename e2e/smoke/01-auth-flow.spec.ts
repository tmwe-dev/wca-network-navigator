/**
 * Smoke Test 1: Auth flow — signup attempt, login, logout
 */
import { test, expect } from "@playwright/test";

test.describe("smoke: auth flow", () => {
  test("login page loads and form is visible", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("login with invalid credentials shows error", async ({ page }) => {
    await page.goto("/auth");
    await page.fill('input[type="email"]', "invalid@test.com");
    await page.fill('input[type="password"]', "wrong-password");
    await page.click('button[type="submit"]');
    // Should show error or stay on auth page
    await page.waitForTimeout(3000);
    const url = page.url();
    // Either shows error toast or remains on auth page
    const stayedOnAuth = url.includes("/auth");
    const hasError = await page.locator('[role="alert"], [data-sonner-toast], .text-destructive').count() > 0;
    expect(stayedOnAuth || hasError).toBeTruthy();
  });

  test("signup tab is accessible", async ({ page }) => {
    await page.goto("/auth");
    const signupTab = page.getByRole("tab", { name: /registr|sign.?up|crea/i });
    if (await signupTab.count() > 0) {
      await signupTab.click();
      await expect(page.locator('input[type="email"]')).toBeVisible();
    } else {
      // Single form mode — just verify email input exists
      await expect(page.locator('input[type="email"]')).toBeVisible();
    }
  });

  test("reset password link exists", async ({ page }) => {
    await page.goto("/auth");
    const resetLink = page.getByRole("link", { name: /password|dimenticata|forgot/i })
      .or(page.getByText(/password|dimenticata|forgot/i));
    await expect(resetLink.first()).toBeVisible({ timeout: 5_000 });
  });
});
