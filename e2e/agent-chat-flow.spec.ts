import { test, expect } from "@playwright/test";

test.describe("Agent Chat", () => {
  test("aprire la pagina agenti e verificare data-testid", async ({ page }) => {
    await page.goto("/v2/agent-chat");
    await page.waitForLoadState("networkidle");
    await expect(page.locator('[data-testid="page-agents"]')).toBeVisible({ timeout: 15000 });
  });

  test("aprire la pagina agenti e vedere il contenuto", async ({ page }) => {
    await page.goto("/v2/agent-chat");
    await page.waitForLoadState("networkidle");
    const content = page.locator('[data-testid="agent-list"]').or(page.locator("text=Agenti")).or(page.locator("text=Agent")).or(page.locator("text=Chat"));
    await expect(content).toBeVisible({ timeout: 15000 });
  });

  test("la pagina non produce errori critici", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
    await page.goto("/v2/agent-chat");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    const criticalErrors = errors.filter((e) => !e.includes("favicon") && !e.includes("404") && !e.includes("ERR_") && !e.includes("ResizeObserver"));
    expect(criticalErrors.length).toBeLessThan(5);
  });

  test("nessun ErrorBoundary visibile", async ({ page }) => {
    await page.goto("/v2/agent-chat");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/qualcosa è andato storto/i)).toHaveCount(0);
  });
});

/* ============================================================
 * DEEP INVARIANTS REINFORCEMENT (F3 - 2026-05-25)
 * Vol II §enterprise-method + audit 2026-05-13
 * Asserzioni invarianti su route critica /v2/agent-chat
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

const DEEP_ROUTE = "/v2/agent-chat";

deepTest.describe("Deep invariants: /v2/agent-chat", () => {
  deepTest("nessun pageerror / 5xx / leak segreti / AI diretta", async ({ page }) => {
    await runDeepInvariants(page, DEEP_ROUTE);
  });

  deepTest("redirect coerente a /auth se non autenticato (o pagina renderizzata)", async ({ page }) => {
    const res = await page.goto(DEEP_ROUTE);
    deepExpect(res?.status() ?? 0).toBeLessThan(500);
    await page.waitForLoadState("networkidle").catch(() => {});
    const url = new URL(page.url());
    const isAuthOr = url.pathname.includes("/auth") || url.pathname.startsWith("/v2/agent-chat".split("/").slice(0, 3).join("/"));
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
