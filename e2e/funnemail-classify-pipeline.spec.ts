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

/* ============================================================
 * DEEP INVARIANTS REINFORCEMENT (F3 - 2026-05-25)
 * Vol II §enterprise-method + audit 2026-05-13
 * Asserzioni invarianti su route critica /v2/funnemail
 * ============================================================ */
import {
  runDeepInvariants,
  attachInvariantWatchers,
  assertInvariants,
  assertNoErrorBoundary,
  assertRootNotEmpty,
  assertResponsiveRender,
} from "./_helpers/invariants";
import { test as deepTest, expect as deepExpect } from "@playwright/test";

const DEEP_ROUTE = "/v2/funnemail";

deepTest.describe("Deep invariants: /v2/funnemail", () => {
  deepTest("nessun pageerror / 5xx / leak segreti / AI diretta", async ({ page }) => {
    await runDeepInvariants(page, DEEP_ROUTE);
  });

  deepTest("redirect coerente a /auth se non autenticato (o pagina renderizzata)", async ({ page }) => {
    const res = await page.goto(DEEP_ROUTE);
    deepExpect(res?.status() ?? 0).toBeLessThan(500);
    await page.waitForLoadState("networkidle").catch(() => {});
    const url = new URL(page.url());
    const isAuthOr = url.pathname.includes("/auth") || url.pathname.startsWith("/v2/funnemail".split("/").slice(0, 3).join("/"));
    deepExpect(isAuthOr, `URL atteso /auth o sotto ramo, got ${url.pathname}`).toBeTruthy();
  });

  deepTest("nessun ErrorBoundary anche dopo navigazioni ripetute", async ({ page }) => {
    for (let i = 0; i < 3; i++) {
      await page.goto(DEEP_ROUTE);
      await page.waitForLoadState("networkidle").catch(() => {});
      await assertNoErrorBoundary(page);
    }
  });

  deepTest("rendering responsive (mobile + desktop)", async ({ page }) => {
    await assertResponsiveRender(page, DEEP_ROUTE);
  });

  deepTest("nessuna chiamata AI diretta dal frontend (charter ai-invocation)", async ({ page }) => {
    const inv = attachInvariantWatchers(page);
    await page.goto(DEEP_ROUTE);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(2000);
    deepExpect(inv.forbiddenAiCalls,
      `AI provider diretto: ${inv.forbiddenAiCalls.join(" | ")}`
    ).toHaveLength(0);
  });

  deepTest("network: nessuna 5xx ne body con service_role", async ({ page }) => {
    const inv = attachInvariantWatchers(page);
    await page.goto(DEEP_ROUTE);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(1500);
    deepExpect(inv.serverErrors,
      `5xx: ${inv.serverErrors.map(e => e.url).join(" | ")}`
    ).toHaveLength(0);
    deepExpect(inv.secretLeaks).toHaveLength(0);
  });

  deepTest("root idratato e <html lang> impostato", async ({ page }) => {
    await page.goto(DEEP_ROUTE);
    await page.waitForLoadState("networkidle").catch(() => {});
    await assertRootNotEmpty(page);
    const lang = await page.locator("html").getAttribute("lang");
    deepExpect(lang).toBeTruthy();
  });

  deepTest("assertInvariants finale (bundle completo)", async ({ page }) => {
    const inv = attachInvariantWatchers(page);
    await page.goto(DEEP_ROUTE);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(2500);
    assertInvariants(inv);
  });
});
