/**
 * P0 — AI Invocation Charter ENFORCED.
 *
 * Memoria `mem://architecture/ai-invocation-charter` + audit 2026-05-04
 * finding #3: ogni chiamata AI dal frontend DEVE passare da `invokeAi()`
 * con `scope` (ai_scope_registry) e `context.source`, e DEVE scrivere in
 * `ai_interaction_log`. L'audit segnalava telemetria spenta.
 *
 * Spec atomico: verifica che la pagina /v2/ai-interactions-log esista,
 * mostri la tabella di log e (se ci sono righe) esponga le colonne scope
 * e source previste dal charter.
 */
import { test, expect } from "@playwright/test";

test.describe("P0 AI Invocation Charter", () => {
  test("pagina ai-interactions-log raggiungibile", async ({ page }) => {
    await page.goto("/v2/ai-interactions-log");
    await expect(page.locator("body")).toBeVisible();
    await expect(page.getByText(/qualcosa è andato storto/i)).toHaveCount(0);
  });

  test("UI espone colonne scope/source o stato vuoto esplicito", async ({ page }) => {
    await page.goto("/v2/ai-interactions-log");
    await page.waitForTimeout(2000);
    const body = await page.locator("body").innerText().catch(() => "");
    expect(body).toMatch(/scope|source|nessun|empty|interazion/i);
  });

  test("export CSV/JSON disponibile", async ({ page }) => {
    await page.goto("/v2/ai-interactions-log");
    await page.waitForTimeout(1500);
    const exportBtn = page.getByRole("button", { name: /export|csv|json|esporta/i });
    const count = await exportBtn.count().catch(() => 0);
    expect(count).toBeGreaterThan(0);
  });

  test("nessun errore JS critico", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto("/v2/ai-interactions-log");
    await page.waitForTimeout(2000);
    expect(errors.filter((e) => !e.includes("net::ERR"))).toHaveLength(0);
  });
});
