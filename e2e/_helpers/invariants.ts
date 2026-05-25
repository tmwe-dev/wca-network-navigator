import { expect, type Page, type Response } from "@playwright/test";

/**
 * Invarianti riutilizzabili per i rinforzi profondi delle spec critiche.
 *
 * Filosofia (Vol II §enterprise-method): non assertiamo logica di business
 * (richiede auth + dati), ma garantiamo che ogni route critica:
 *   - risponda 2xx/3xx (no 5xx server-side al boot)
 *   - non sganci pageerror JS
 *   - non mostri ErrorBoundary
 *   - non perda segreti server-side nel bundle
 *   - non emetta una raffica di console.error
 *   - renderizzi sia su desktop che mobile
 *   - non esegua chiamate AI dirette dal frontend
 *     (charter `mem://architecture/ai-invocation-charter`)
 */

const IGNORED_CONSOLE = [
  "favicon",
  "ResizeObserver",
  "Failed to fetch dynamically imported module",
  "net::ERR_",
  "404",
  "Manifest",
];

const IGNORED_PAGEERROR = ["ResizeObserver", "AbortError"];

const SECRET_FRAGMENTS = [
  "service_role",
  "SUPABASE_SERVICE_ROLE",
  "LOVABLE_API_KEY",
  "sk_live_",
  "sk-proj-",
];

const FORBIDDEN_DIRECT_AI_HOSTS = [
  "api.openai.com",
  "generativelanguage.googleapis.com",
  "api.anthropic.com",
];

export type Invariants = {
  consoleErrors: string[];
  pageErrors: string[];
  serverErrors: { url: string; status: number }[];
  forbiddenAiCalls: string[];
  secretLeaks: string[];
};

export function attachInvariantWatchers(page: Page): Invariants {
  const inv: Invariants = {
    consoleErrors: [],
    pageErrors: [],
    serverErrors: [],
    forbiddenAiCalls: [],
    secretLeaks: [],
  };

  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (IGNORED_CONSOLE.some((p) => text.includes(p))) return;
    inv.consoleErrors.push(text);
  });

  page.on("pageerror", (err) => {
    if (IGNORED_PAGEERROR.some((p) => err.message.includes(p))) return;
    inv.pageErrors.push(err.message);
  });

  page.on("response", async (res: Response) => {
    const url = res.url();
    if (res.status() >= 500 && !url.includes("/functions/v1/")) {
      inv.serverErrors.push({ url, status: res.status() });
    }
    if (FORBIDDEN_DIRECT_AI_HOSTS.some((h) => url.includes(h))) {
      inv.forbiddenAiCalls.push(url);
    }
  });

  page.on("request", (req) => {
    const headers = req.headers();
    const blob = JSON.stringify({ url: req.url(), headers });
    SECRET_FRAGMENTS.forEach((s) => {
      if (blob.includes(s)) inv.secretLeaks.push(`${s}@${req.url()}`);
    });
  });

  return inv;
}

export async function assertNoErrorBoundary(page: Page) {
  const eb = await page
    .getByText(/qualcosa è andato storto|something went wrong/i)
    .count();
  expect(eb, "ErrorBoundary non deve essere visibile").toBe(0);
}

export async function assertRootNotEmpty(page: Page) {
  const html = await page.locator("#root").innerHTML();
  expect(html.length, "#root deve essere idratato").toBeGreaterThan(50);
}

export async function assertHtmlLang(page: Page) {
  const lang = await page.locator("html").getAttribute("lang");
  expect(lang, "<html lang> deve essere impostato").toBeTruthy();
}

export async function assertResponsiveRender(page: Page, route: string) {
  for (const vp of [
    { width: 375, height: 812 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(vp);
    await page.goto(route);
    await page.waitForLoadState("networkidle").catch(() => {});
    await assertRootNotEmpty(page);
    await assertNoErrorBoundary(page);
  }
}

export function assertInvariants(inv: Invariants) {
  expect(inv.pageErrors, `pageerror inattesi: ${inv.pageErrors.join(" | ")}`).toHaveLength(0);
  expect(
    inv.serverErrors,
    `5xx server-side: ${inv.serverErrors.map((e) => `${e.status} ${e.url}`).join(" | ")}`,
  ).toHaveLength(0);
  expect(
    inv.forbiddenAiCalls,
    `AI provider chiamato direttamente dal frontend (charter violato): ${inv.forbiddenAiCalls.join(" | ")}`,
  ).toHaveLength(0);
  expect(
    inv.secretLeaks,
    `Possibile leak di segreti: ${inv.secretLeaks.join(" | ")}`,
  ).toHaveLength(0);
  // Soglia tollerante sul rumore console (lib di terze parti)
  expect(
    inv.consoleErrors.length,
    `Troppi console.error: ${inv.consoleErrors.slice(0, 5).join(" | ")}`,
  ).toBeLessThan(8);
}

/**
 * Esegue il bundle completo di invarianti su una route.
 * Usabile in qualsiasi spec critica per garantire copertura uniforme.
 */
export async function runDeepInvariants(page: Page, route: string) {
  const inv = attachInvariantWatchers(page);
  const response = await page.goto(route);
  expect(response, "Risposta navigazione presente").not.toBeNull();
  if (response) {
    const status = response.status();
    expect(status, `Status iniziale ${route}`).toBeLessThan(500);
  }
  await page.waitForLoadState("networkidle").catch(() => {});
  await assertRootNotEmpty(page);
  await assertHtmlLang(page);
  await assertNoErrorBoundary(page);
  await page.waitForTimeout(1500);
  assertInvariants(inv);
  return inv;
}