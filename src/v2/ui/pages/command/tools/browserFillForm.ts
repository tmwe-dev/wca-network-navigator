/**
 * browserFillForm tool — Opens an internal form page via headless browser,
 * fills fields, and shows preview for approval (no submit).
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tool, ToolResult, ToolContext } from "./types";

const MATCH = /(?:compila|riempi|inserisci)\s+(?:il\s+)?(?:form|modulo|scheda)\s+/i;

interface FormField {
  selector: string;
  label: string;
  value: string;
}

export const browserFillFormTool: Tool = {
  id: "browser-fill-form",
  label: "Compila Form (Browser)",
  description: "Apre una pagina interna dell'app nel browser headless, compila i campi del form senza inviare",

  match(prompt: string): boolean {
    return MATCH.test(prompt);
  },

  async execute(prompt: string, context?: ToolContext): Promise<ToolResult> {
    // If confirmed, do the actual submit
    if (context?.confirmed && context.payload) {
      const payload = context.payload as { url: string; formSelector: string; sessionToken?: string };

      try {
        const { data, error } = await supabase.functions.invoke("browser-action", {
          body: {
            actions: [
              { type: "navigate", url: payload.url },
              { type: "waitFor", ms: 1000 },
              { type: "submit", selector: payload.formSelector },
              { type: "waitFor", ms: 2000 },
              { type: "screenshot" },
            ],
            sessionToken: payload.sessionToken,
            allowedDomains: [],
          },
        });

        if (error) {
          return { kind: "result", title: "Errore Submit", message: error.message };
        }

        return {
          kind: "result",
          title: "Form Inviato",
          message: `Form inviato con successo. Pagina finale: ${data?.finalUrl ?? "sconosciuta"}`,
        };
      } catch (e) {
        return { kind: "result", title: "Errore", message: e instanceof Error ? e.message : String(e) };
      }
    }

    // Extract form URL and fields from prompt
    const urlMatch = prompt.match(/(?:pagina|form|url)\s+(\/[^\s,]+)/i);
    const formUrl = urlMatch?.[1] ?? "/v2/crm/contacts/new";

    // Parse field instructions (simplified — in production the AI would structure this)
    const fields: FormField[] = [];
    const fieldMatches = prompt.matchAll(/campo\s+["']?(\w+)["']?\s*(?:=|:)\s*["']?([^"',]+)["']?/gi);
    for (const m of fieldMatches) {
      fields.push({ selector: `[name="${m[1]}"], #${m[1]}, [data-field="${m[1]}"]`, label: m[1], value: m[2].trim() });
    }

    if (fields.length === 0) {
      // Try to extract from natural language
      const nameMatch = prompt.match(/(?:nome|name)\s+["']?([^"',]+)["']?/i);
      const emailMatch = prompt.match(/(?:email)\s+["']?([^"',\s]+)["']?/i);
      const noteMatch = prompt.match(/(?:nota|note)\s+["']?([^"']+)["']?/i);

      if (nameMatch) fields.push({ selector: '[name="name"], #name, [data-field="name"]', label: "Nome", value: nameMatch[1].trim() });
      if (emailMatch) fields.push({ selector: '[name="email"], #email, [data-field="email"]', label: "Email", value: emailMatch[1].trim() });
      if (noteMatch) fields.push({ selector: '[name="note"], #note, textarea', label: "Nota", value: noteMatch[1].trim() });
    }

    // Get session token for auth
    const { data: { session } } = await supabase.auth.getSession();
    const sessionToken = session?.access_token;

    // Build the full URL
    const appUrl = import.meta.env.VITE_SUPABASE_URL?.replace("/rest/v1", "") ?? "";
    const fullUrl = formUrl.startsWith("http") ? formUrl : `${window.location.origin}${formUrl}`;

    // Execute browser actions: navigate + fill (no submit)
    const actions = [
      { type: "navigate" as const, url: fullUrl },
      { type: "waitFor" as const, ms: 2000 },
      ...fields.map((f) => ({ type: "type" as const, selector: f.selector, text: f.value })),
      { type: "screenshot" as const },
    ];

    try {
      const { data, error } = await supabase.functions.invoke("browser-action", {
        body: { actions, sessionToken, allowedDomains: [] },
      });

      if (error) {
        return { kind: "result", title: "Errore Browser", message: error.message };
      }

      if (data?.fallback) {
        return { kind: "result", title: "Browser Non Disponibile", message: "Il browser headless non è configurato." };
      }

      const details = fields.map((f) => ({ label: f.label, value: f.value }));
      if (data?.finalScreenshot) {
        details.push({ label: "Screenshot", value: `data:image/jpeg;base64,${data.finalScreenshot}` });
      }

      return {
        kind: "approval",
        title: "Form Compilato — Conferma Invio",
        description: `Form compilato su ${formUrl}. Conferma per inviare.`,
        details,
        governance: { role: "operator", permission: "write:form", policy: "approval_required" },
        pendingPayload: { url: fullUrl, formSelector: "button[type='submit'], form button:last-of-type", sessionToken },
        toolId: "browser-fill-form",
      };
    } catch (e) {
      return { kind: "result", title: "Errore", message: e instanceof Error ? e.message : String(e) };
    }
  },
};
