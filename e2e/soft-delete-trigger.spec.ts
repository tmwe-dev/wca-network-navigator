/**
 * Smoke E2E — Soft-delete trigger (constraints/no-physical-delete)
 *
 * Il trigger DB intercetta DELETE su 15 tabelle business e li converte
 * in UPDATE deleted_at. Qui verifichiamo solo che le viste CRM/Network
 * carichino senza errori (la garanzia della conversione vive nel
 * trigger DB e nelle policy RLS RESTRICTIVE).
 */
import { test, expect } from "./fixtures/auth";

const VIEWS = ["/v2/crm", "/v2/network", "/v2/contacts"];

test.describe("soft-delete-trigger", () => {
  for (const route of VIEWS) {
    test(`${route} loads without crash`, async ({ authedPage: page }) => {
      await page.goto(route);
      await page.waitForTimeout(2000);
      await expect(page.locator("#root")).not.toBeEmpty();
      const eb = await page.getByText(/qualcosa è andato storto/i).count();
      expect(eb).toBe(0);
    });
  }
});