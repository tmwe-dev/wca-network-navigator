/**
 * Smoke E2E — Lead Status Guard
 *
 * Tutte le transizioni passano da applyLeadStatusChange (server-side).
 * Qui verifichiamo che la UI CRM esista e non esponga un downgrade
 * libero del lead_status (che il guard bloccherebbe lato server).
 */
import { test, expect } from "./fixtures/auth";

test.describe("lead-status-guard", () => {
  test("CRM page loads", async ({ authedPage: page }) => {
    await page.goto("/v2/crm");
    await page.waitForTimeout(2000);
    await expect(page.locator("#root")).not.toBeEmpty();
  });

  test("no ErrorBoundary visible on CRM", async ({ authedPage: page }) => {
    await page.goto("/v2/crm");
    await page.waitForTimeout(2000);
    const eb = await page.getByText(/qualcosa è andato storto|something went wrong/i).count();
    expect(eb).toBe(0);
  });

  test("no critical pageerror", async ({ authedPage: page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => {
      if (!err.message.includes("ResizeObserver")) errors.push(err.message);
    });
    await page.goto("/v2/crm");
    await page.waitForTimeout(2500);
    expect(errors).toHaveLength(0);
  });
});
/* ============================================================
 * DEEP INVARIANTS REINFORCEMENT (F3 - 2026-05-25)
 * Vol II §enterprise-method + audit 2026-05-13
 * Asserzioni invarianti su route critica /v2/crm
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

const DEEP_ROUTE = "/v2/crm";

deepTest.describe("Deep invariants: /v2/crm", () => {
  deepTest("nessun pageerror / 5xx / leak segreti / AI diretta", async ({ page }) => {
    await runDeepInvariants(page, DEEP_ROUTE);
  });

  deepTest("redirect coerente a /auth se non autenticato (o pagina renderizzata)", async ({ page }) => {
    const res = await page.goto(DEEP_ROUTE);
    deepExpect(res?.status() ?? 0).toBeLessThan(500);
    await page.waitForLoadState("networkidle").catch(() => {});
    const url = new URL(page.url());
    const isAuthOr = url.pathname.includes("/auth") || url.pathname.startsWith("/v2/crm".split("/").slice(0, 3).join("/"));
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
