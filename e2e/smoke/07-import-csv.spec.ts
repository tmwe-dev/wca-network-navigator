/**
 * Smoke Test 7: Import CSV — import page loads, file input present
 */
import { test, expect } from "../fixtures/auth";

test.describe("smoke: import CSV", () => {
  test("import page loads", async ({ authedPage: page }) => {
    await page.goto("/v2/import");
    await page.waitForTimeout(3000);
    await expect(page.locator("#root")).not.toBeEmpty();
    await expect(page.getByText(/qualcosa è andato storto/i)).toHaveCount(0);
  });

  test("file upload area is present", async ({ authedPage: page }) => {
    await page.goto("/v2/import");
    await page.waitForTimeout(3000);
    // Should have file input or drop zone
    const fileInput = page.locator('input[type="file"]');
    const dropZone = page.getByText(/trascina|drag|drop|carica|upload|csv|excel/i);
    const hasUpload = (await fileInput.count()) > 0 || (await dropZone.count()) > 0;
    expect(hasUpload).toBeTruthy();
  });

  test("network page loads (partner import target)", async ({ authedPage: page }) => {
    await page.goto("/v2/network");
    await page.waitForTimeout(3000);
    await expect(page.locator("#root")).not.toBeEmpty();
    await expect(page.getByText(/qualcosa è andato storto/i)).toHaveCount(0);
  });
});
