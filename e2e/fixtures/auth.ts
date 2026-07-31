import { test as base, expect, type Page } from "@playwright/test";

/**
 * Auth fixture E2E — harness SOLO test/local.
 *
 * L'app usa esclusivamente TMWE OAuth (`mem://auth/tmwe-only-auth-2026-05-05`):
 * non esiste più un form email/password, quindi il vecchio login programmatico
 * è impossibile. L'unico modo sicuro di autenticare un browser di test è
 * **riusare una sessione già emessa** e passata all'harness via variabili
 * d'ambiente locali/CI. Nessun segreto è versionato, nessun bypass runtime è
 * introdotto nell'app: se le variabili mancano, i test vengono marcati
 * BLOCKED con causa esplicita invece di essere silenziosamente saltati.
 *
 * Variabili accettate (nessuna di queste esiste in produzione):
 *   E2E_SUPABASE_SESSION_JSON / LOVABLE_BROWSER_SUPABASE_SESSION_JSON
 *   E2E_SUPABASE_STORAGE_KEY  / LOVABLE_BROWSER_SUPABASE_STORAGE_KEY
 *
 * Uso:
 *   import { test, expect } from "../fixtures/auth";
 *   test("...", async ({ authedPage }) => { ... });
 */

type AuthFixtures = {
  authedPage: Page;
};

const SESSION_JSON =
  process.env.E2E_SUPABASE_SESSION_JSON ?? process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON ?? "";
const STORAGE_KEY =
  process.env.E2E_SUPABASE_STORAGE_KEY ?? process.env.LOVABLE_BROWSER_SUPABASE_STORAGE_KEY ?? "";

export const hasTestSession = SESSION_JSON.length > 0 && STORAGE_KEY.length > 0;

export const AUTH_BLOCKED_REASON =
  "BLOCKED (richiede autenticazione): l'app usa solo TMWE OAuth e non esiste sessione di test. " +
  "Fornire E2E_SUPABASE_SESSION_JSON + E2E_SUPABASE_STORAGE_KEY per abilitare queste spec. " +
  "Vedi docs/e2e/e2e-auth-blocked.md";

async function restoreSession(page: Page): Promise<void> {
  await page.goto("/");
  await page.evaluate(
    ([key, value]) => window.localStorage.setItem(key, value),
    [STORAGE_KEY, SESSION_JSON] as const,
  );
}

export const test = base.extend<AuthFixtures>({
  authedPage: async ({ page }, use) => {
    test.skip(!hasTestSession, AUTH_BLOCKED_REASON);
    await restoreSession(page);
    await use(page);
  },
});

export { expect };
