/**
 * browser-action — Headless browser actions via Browserless/Playwright.
 * Executes sequential actions (navigate, click, type, screenshot, etc.)
 * in a single session with domain whitelist and audit logging.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders } from "../_shared/cors.ts";

const MAX_ACTIONS = 20;
const TOTAL_TIMEOUT_MS = 60_000;
const APP_ORIGIN = Deno.env.get("SUPABASE_URL") ?? "";

/** Domain whitelist — app itself is always allowed */
function isDomainAllowed(url: string, allowedDomains: string[]): boolean {
  try {
    const parsed = new URL(url);
    // Always allow app origin
    if (APP_ORIGIN && parsed.origin === new URL(APP_ORIGIN).origin) return true;
    // Check whitelist
    return allowedDomains.some((d) => parsed.hostname === d || parsed.hostname.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

interface BrowserAction {
  type: "navigate" | "click" | "type" | "waitFor" | "screenshot" | "readText" | "submit";
  url?: string;
  selector?: string;
  text?: string;
  ms?: number;
}

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { actions, sessionToken, allowedDomains = [] } = body as {
      actions: BrowserAction[];
      sessionToken?: string;
      allowedDomains?: string[];
    };

    if (!Array.isArray(actions) || actions.length === 0) {
      return new Response(JSON.stringify({ error: "actions array obbligatorio" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (actions.length > MAX_ACTIONS) {
      return new Response(JSON.stringify({ error: `Max ${MAX_ACTIONS} azioni per richiesta` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate domains upfront
    for (const action of actions) {
      if (action.type === "navigate" && action.url) {
        if (!isDomainAllowed(action.url, allowedDomains)) {
          return new Response(
            JSON.stringify({ error: `Dominio non autorizzato: ${action.url}. Solo domini nella whitelist sono consentiti.` }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }
    }

    // Check Browserless availability
    const BROWSERLESS_URL = Deno.env.get("BROWSERLESS_URL");
    const BROWSERLESS_TOKEN = Deno.env.get("BROWSERLESS_TOKEN");

    if (!BROWSERLESS_URL || !BROWSERLESS_TOKEN) {
      return new Response(
        JSON.stringify({
          error: "Browser headless non configurato. Configura BROWSERLESS_URL e BROWSERLESS_TOKEN nei secrets.",
          fallback: true,
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Use Browserless CDP endpoint
    const wsEndpoint = `${BROWSERLESS_URL}?token=${BROWSERLESS_TOKEN}`;

    // Dynamic import playwright-core
    let chromium: unknown;
    try {
      const pw = await import("https://esm.sh/playwright-core@1.40.0");
      chromium = pw.chromium;
    } catch (e) {
      return new Response(
        JSON.stringify({ error: "playwright-core non disponibile in questo ambiente", detail: String(e) }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Connect to Browserless
    // deno-lint-ignore no-explicit-any
    const browser = await (chromium as any).connectOverCDP(wsEndpoint, { timeout: 15000 });
    const context = await browser.newContext({
      userAgent: "WCA-NetworkNavigator/1.0 BrowserAction",
      viewport: { width: 1280, height: 720 },
    });

    // Inject auth cookie if provided
    if (sessionToken && APP_ORIGIN) {
      try {
        const appUrl = new URL(APP_ORIGIN);
        await context.addCookies([
          {
            name: "sb-auth-token",
            value: sessionToken,
            domain: appUrl.hostname,
            path: "/",
            httpOnly: true,
            secure: appUrl.protocol === "https:",
            sameSite: "Lax",
          },
        ]);
      } catch {
        // Non-critical
      }
    }

    const page = await context.newPage();
    const results: unknown[] = [];
    const consoleMessages: string[] = [];
    let finalScreenshot = "";
    let finalUrl = "";

    // Capture console
    page.on("console", (msg: { text: () => string }) => {
      consoleMessages.push(msg.text().slice(0, 200));
      if (consoleMessages.length > 50) consoleMessages.shift();
    });

    // Execute actions with total timeout
    const deadline = Date.now() + TOTAL_TIMEOUT_MS;

    for (let i = 0; i < actions.length; i++) {
      if (Date.now() > deadline) {
        results.push({ action: i, error: "Timeout totale raggiunto (60s)" });
        break;
      }

      const action = actions[i];
      const stepTimeout = Math.min(15000, deadline - Date.now());

      try {
        switch (action.type) {
          case "navigate": {
            if (!action.url) throw new Error("url obbligatorio per navigate");
            await page.goto(action.url, { timeout: stepTimeout, waitUntil: "domcontentloaded" });
            results.push({ action: i, type: "navigate", url: action.url, title: await page.title() });
            break;
          }
          case "click": {
            if (!action.selector) throw new Error("selector obbligatorio per click");
            await page.click(action.selector, { timeout: stepTimeout });
            results.push({ action: i, type: "click", selector: action.selector });
            break;
          }
          case "type": {
            if (!action.selector || action.text === undefined) throw new Error("selector e text obbligatori per type");
            await page.fill(action.selector, action.text, { timeout: stepTimeout });
            results.push({ action: i, type: "type", selector: action.selector, text: action.text.slice(0, 100) });
            break;
          }
          case "waitFor": {
            if (action.selector) {
              await page.waitForSelector(action.selector, { timeout: stepTimeout });
              results.push({ action: i, type: "waitFor", selector: action.selector });
            } else if (action.ms) {
              await page.waitForTimeout(Math.min(action.ms, 5000));
              results.push({ action: i, type: "waitFor", ms: action.ms });
            }
            break;
          }
          case "screenshot": {
            const buf = await page.screenshot({ type: "jpeg", quality: 60 });
            const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
            results.push({ action: i, type: "screenshot", size: b64.length });
            finalScreenshot = b64;
            break;
          }
          case "readText": {
            if (!action.selector) throw new Error("selector obbligatorio per readText");
            const text = await page.textContent(action.selector, { timeout: stepTimeout });
            results.push({ action: i, type: "readText", selector: action.selector, text: (text ?? "").slice(0, 2000) });
            break;
          }
          case "submit": {
            if (!action.selector) throw new Error("selector obbligatorio per submit");
            await page.click(action.selector, { timeout: stepTimeout });
            await page.waitForTimeout(1000);
            results.push({ action: i, type: "submit", selector: action.selector });
            break;
          }
          default:
            results.push({ action: i, error: `Tipo azione sconosciuto: ${(action as BrowserAction).type}` });
        }
      } catch (e) {
        results.push({ action: i, type: action.type, error: e instanceof Error ? e.message : String(e) });
      }
    }

    // Final screenshot if not already taken
    if (!finalScreenshot) {
      try {
        const buf = await page.screenshot({ type: "jpeg", quality: 60 });
        finalScreenshot = btoa(String.fromCharCode(...new Uint8Array(buf)));
      } catch {
        // Non-critical
      }
    }

    finalUrl = page.url();

    // Cleanup
    await page.close().catch(() => {});
    await context.close().catch(() => {});
    await browser.close().catch(() => {});

    // Audit log
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
      if (supabaseUrl && serviceKey) {
        const sb = createClient(supabaseUrl, serviceKey);
        // Extract user from auth header
        const authHeader = req.headers.get("authorization") ?? "";
        const token = authHeader.replace("Bearer ", "");
        if (token) {
          const { data: { user } } = await sb.auth.getUser(token);
          if (user) {
            await sb.from("browser_action_log").insert({
              user_id: user.id,
              actions,
              result: { results, finalUrl },
              target_url: actions.find((a) => a.type === "navigate")?.url ?? null,
              status: results.some((r: Record<string, unknown>) => r && typeof r === "object" && "error" in r) ? "partial" : "success",
            });
          }
        }
      }
    } catch {
      // Audit log failure is non-critical
    }

    return new Response(
      JSON.stringify({ results, finalScreenshot, finalUrl, console: consoleMessages.slice(-20) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("browser-action error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Errore sconosciuto" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
