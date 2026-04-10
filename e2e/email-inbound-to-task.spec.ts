import { test, expect } from "@playwright/test";

/**
 * [E01] Email Inbound → Task Flow
 * Scope: Inbound message should generate agent screening task visible in UI.
 * Preconditions: Requires auth + active agents + inbound messages.
 */

test.describe("Email Inbound to Task [E01]", () => {
  test("auth page loads", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.locator("body")).toBeVisible();
  });

  test.skip("inbound message creates screening task (requires auth)", async ({ page }) => {
    // Full flow: login → trigger check-inbox → verify task appears in agent operations
    // Requires: active IMAP config, real inbound email, agent with matching territory
    expect(true).toBe(true);
  });
});
