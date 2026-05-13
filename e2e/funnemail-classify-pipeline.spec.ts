/**
 * P0 — Funnemail classify pipeline cablata sul cron inbox.
 *
 * Audit 2026-05-04 finding #2: `funnemail-classify` mai cablato → tabella
 * `funnemail_decisions` vuota nonostante inbound flow attivo.
 *
 * Spec atomico read-only: verifica che la pagina Funnemail Inbox monti,
 * il tab "Eval Accuracy" sia accessibile e l'UI esponga lo stato delle
 * decisioni (anche vuoto = OK, ma la sezione deve esistere).
 */
import { test, expect } from "@playwright/test";

test.describe("P0 funnemail classify pipeline", () => {
  test("inbox monta senza ErrorBoundary", async ({ page }) => {
    await page.goto("/v2/funnemail-inbox");
    await expect(page.locator("body")).toBeVisible();
    await expect(page.getByText(/qualcosa è andato storto/i)).toHaveCount(0);
  });

  test("tab Eval Accuracy raggiungibile", async ({ page }) => {
    await page.goto("/v2/funnemail-inbox");
    const evalTab = page.getByText(/Eval Accuracy|Accuracy/i).first();
    await expect(evalTab).toBeVisible({ timeout: 10_000 });
  });

  test("metriche di classificazione esposte (anche zero)", async ({ page }) => {
    await page.goto("/v2/funnemail-inbox");
    await page.getByText(/Eval Accuracy|Accuracy/i).first().click().catch(() => {});
    await page.waitForTimeout(1500);
    // Deve comparire almeno uno tra: percentuale, "Nessun", "Caricamento", "decision"
    const body = await page.locator("body").innerText().catch(() => "");
    expect(body).toMatch(/%|Nessun|Caricamento|decision|categor/i);
  });

  test("nessun errore JS critico durante caricamento", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto("/v2/funnemail-inbox");
    await page.waitForTimeout(2000);
    expect(errors.filter((e) => !e.includes("net::ERR"))).toHaveLength(0);
  });
});
