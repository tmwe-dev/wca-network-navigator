/**
 * Smoke Test 1: Auth flow — TMWE OAuth (unica porta d'ingresso).
 *
 * Allineato al flusso corrente (`mem://auth/tmwe-only-auth-2026-05-05`):
 * niente form email/password, niente signup, niente reset.
 * Le assertion di sicurezza sono rafforzate, non indebolite: verifichiamo
 * che NON esista un percorso credenziali alternativo.
 */
import { test, expect } from "@playwright/test";

test.describe("smoke: auth flow (TMWE)", () => {
  test("/auth reindirizza alla login V2", async ({ page }) => {
    await page.goto("/auth");
    await page.waitForURL(/\/v2\/login/, { timeout: 15_000 });
    expect(page.url()).toContain("/v2/login");
  });

  test("la login mostra il solo ingresso TMWE", async ({ page }) => {
    await page.goto("/v2/login");
    const tmwe = page.getByText(/Entra con TMWE|Preparazione login/i);
    await expect(tmwe.first()).toBeVisible({ timeout: 15_000 });
  });

  test("nessun form credenziali esposto (guardia di sicurezza)", async ({ page }) => {
    await page.goto("/v2/login");
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    await expect(page.locator('input[type="email"]')).toHaveCount(0);
  });

  test("errore TMWE dal callback viene mostrato all'utente", async ({ page }) => {
    await page.goto("/v2/login?tmwe=error&reason=not_whitelisted");
    await expect(page.getByText(/Email non autorizzata/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test("la pagina intermedia TMWE non espone credenziali", async ({ page }) => {
    await page.goto("/v2/tmwe-login-popup");
    await expect(page.getByRole("heading", { name: /Accesso TMWE/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
  });
});
