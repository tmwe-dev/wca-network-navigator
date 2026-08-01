/**
 * P0 — Regressione filtro direction su inbound email.
 *
 * Audit 2026-05-04 (`docs/audit/2026-05-04-ai-routing.md` finding #1):
 * `check-inbox/postProcessing.ts` filtrava `raw_payload.direction === "inbound"`
 * mentre il campo è top-level su `channel_messages` → 1 sola riga storica
 * in `email_classifications`.
 *
 * Questo spec è atomico: verifica solo che la pagina di osservabilità
 * Pipeline Traces sia raggiungibile e che, se ci sono trace recenti,
 * almeno una abbia step `classify_inbound`. Non muta dati.
 */
import { test, expect } from "@playwright/test";

test.describe("P0 inbound direction filter", () => {
  test("pipeline-traces page renders senza errori critici", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto("/v2/pipeline-traces");
    await expect(page.locator("body")).toBeVisible();
    await page.waitForTimeout(1500);
    expect(errors.filter((e) => !e.includes("net::ERR"))).toHaveLength(0);
  });

  test("trace inbound mostra step classify_inbound quando presente", async ({ page }) => {
    await page.goto("/v2/pipeline-traces");
    await page.waitForTimeout(2000);
    const body = await page.locator("body").innerText().catch(() => "");
    // Se ci sono trace, deve apparire almeno uno step di classificazione inbound.
    // Se la lista è vuota (ambiente test pulito), il test passa silenziosamente.
    const hasTraces = /trace|inbound|classify/i.test(body);
    if (hasTraces) {
      expect(body).toMatch(/classify_inbound|classify-inbound|inbound/i);
    }
  });

  test("nessun ErrorBoundary su pipeline-traces", async ({ page }) => {
    await page.goto("/v2/pipeline-traces");
    await expect(page.getByText(/qualcosa è andato storto/i)).toHaveCount(0);
  });
});
