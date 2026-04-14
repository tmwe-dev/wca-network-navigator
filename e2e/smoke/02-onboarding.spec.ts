/**
 * Smoke Test 2: Onboarding flow — loads after login, navigable
 */
import { test, expect } from "../fixtures/auth";

test.describe("smoke: onboarding", () => {
  test("authenticated user can access home", async ({ authedPage: page }) => {
    // After auth, should land on home or onboarding
    const url = page.url();
    const validLanding = ["/v2", "/v1", "/onboarding", "/"].some(p => url.includes(p));
    expect(validLanding).toBeTruthy();
    // Page should have content (no blank screen)
    await expect(page.locator("#root")).not.toBeEmpty({ timeout: 10_000 });
  });

  test("onboarding page renders without crash", async ({ page }) => {
    await page.goto("/onboarding");
    // Should either show onboarding content or redirect to auth
    await page.waitForTimeout(3000);
    const url = page.url();
    if (url.includes("/onboarding")) {
      await expect(page.locator("#root")).not.toBeEmpty();
      // No error boundary
      await expect(page.getByText(/qualcosa è andato storto|something went wrong/i)).toHaveCount(0);
    }
    // If redirected to auth, that's valid too (not onboarded yet)
  });
});
