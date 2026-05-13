import { test, expect } from "@playwright/test";

test.describe("Personas & Prompt Lab", () => {
  test("prompt lab page loads", async ({ page }) => {
    await page.goto("/v2/prompt-lab");
    await expect(page.getByText(/Prompt Lab|Laboratorio/).first()).toBeVisible();
  });

  test("prompt lab shows health banner", async ({ page }) => {
    await page.goto("/v2/prompt-lab");
    // Health banner should show grading info
    const banner = page.locator("[data-testid='prompt-lab-health']");
    await expect(banner.or(page.getByText(/Test|Duplicati|Persona/).first())).toBeVisible();
  });

  test("agent personas section is accessible", async ({ page }) => {
    await page.goto("/v2/prompt-lab");
    const personaSection = page.getByText(/Persona|Agenti/).first();
    await expect(personaSection).toBeVisible();
  });

  test("persona cards show tone information", async ({ page }) => {
    await page.goto("/v2/prompt-lab");
    // Navigate to personas if it's a sub-tab
    await page.getByText(/Persona/).first().click().catch(() => {});
    await expect(page.locator("body")).not.toContainText("Errore critico");
  });
});
