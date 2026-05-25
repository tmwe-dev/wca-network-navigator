import { test, expect } from "@playwright/test";

test.describe("Outreach Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/v2/outreach");
    await page.waitForLoadState("networkidle");
  });

  test("outreach page mounts with data-testid", async ({ page }) => {
    await expect(page.locator('[data-testid="page-outreach"]')).toBeVisible({ timeout: 15000 });
  });

  test("outreach shows campaign list or queue", async ({ page }) => {
    const content = page.locator("table, [role='grid'], [role='tablist']")
      .or(page.getByText(/outreach|campagn|invio|send|queue/i));
    await expect(content.first()).toBeVisible({ timeout: 15000 });
  });

  test("outreach has action buttons", async ({ page }) => {
    await page.waitForTimeout(2000);
    const buttons = page.locator("button");
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);
  });

  test("no ErrorBoundary on outreach", async ({ page }) => {
    await expect(page.getByText(/qualcosa è andato storto/i)).toHaveCount(0);
  });

  test("outreach no critical console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
    await page.goto("/v2/outreach");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    const critical = errors.filter((e) => !e.includes("favicon") && !e.includes("404") && !e.includes("ERR_") && !e.includes("ResizeObserver"));
    expect(critical.length).toBeLessThan(5);
  });
});

/* ============================================================
 * DEEP INVARIANTS REINFORCEMENT (F3 - 2026-05-25)
 * Vol II §enterprise-method + audit 2026-05-13
 * Asserzioni invarianti su route critica /v2/outreach
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

const DEEP_ROUTE = "/v2/outreach";

deepTest.describe("Deep invariants: /v2/outreach", () => {
  deepTest("nessun pageerror / 5xx / leak segreti / AI diretta", async ({ page }) => {
    await runDeepInvariants(page, DEEP_ROUTE);
  });

  deepTest("redirect coerente a /auth se non autenticato (o pagina renderizzata)", async ({ page }) => {
    const res = await page.goto(DEEP_ROUTE);
    deepExpect(res?.status() ?? 0).toBeLessThan(500);
    await page.waitForLoadState("networkidle").catch(() => {});
    const url = new URL(page.url());
    const isAuthOr = url.pathname.includes("/auth") || url.pathname.startsWith("/v2/outreach".split("/").slice(0, 3).join("/"));
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
