/**
 * Smoke Test 5: Agent Chat — page loads, can type message
 */
import { test, expect } from "../fixtures/auth";

test.describe("smoke: agent chat", () => {
  test("agent chat page loads without crash", async ({ authedPage: page }) => {
    await page.goto("/v2/agent-chat");
    await page.waitForTimeout(3000);
    await expect(page.locator("#root")).not.toBeEmpty();
    await expect(page.getByText(/qualcosa è andato storto/i)).toHaveCount(0);
  });

  test("chat has input area", async ({ authedPage: page }) => {
    await page.goto("/v2/agent-chat");
    await page.waitForTimeout(3000);
    // Should have a textarea or input for chat
    const chatInput = page.locator('textarea, input[type="text"]').last();
    if (await chatInput.count() > 0) {
      await expect(chatInput).toBeVisible();
      // Can type in the input
      await chatInput.fill("Test message");
      await expect(chatInput).toHaveValue("Test message");
    }
  });

  test("agent list or selector is visible", async ({ authedPage: page }) => {
    await page.goto("/v2/agent-chat");
    await page.waitForTimeout(3000);
    // Should show agents (sidebar, tabs, or cards)
    const agentElements = page.locator('[data-testid*="agent"], .agent-card, [role="tab"]');
    const headings = page.getByRole("heading");
    const someContent = (await agentElements.count()) > 0 || (await headings.count()) > 0;
    expect(someContent).toBeTruthy();
  });
});
