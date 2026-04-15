/**
 * browserAutoComplete tool — Submit a previously filled form after approval.
 * Used by planRunner when the user approves a browser-fill-form step.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tool, ToolResult, ToolContext } from "./types";

const MATCH = /(?:invia|submit|conferma)\s+(?:il\s+)?(?:form|modulo)/i;

export const browserAutoCompleteTool: Tool = {
  id: "browser-auto-complete",
  label: "Invia Form (Browser)",
  description: "Invia un form precedentemente compilato nel browser headless",

  match(prompt: string): boolean {
    return MATCH.test(prompt);
  },

  async execute(prompt: string, context?: ToolContext): Promise<ToolResult> {
    if (!context?.confirmed || !context.payload) {
      return {
        kind: "approval",
        title: "Conferma Invio Form",
        description: "Conferma per inviare il form nel browser headless.",
        details: [{ label: "Azione", value: "Submit form" }],
        governance: { role: "operator", permission: "write:form", policy: "approval_required" },
        pendingPayload: context?.payload ?? {},
        toolId: "browser-auto-complete",
      };
    }

    const payload = context.payload as { url: string; formSelector: string; sessionToken?: string };

    try {
      const { data, error } = await supabase.functions.invoke("browser-action", {
        body: {
          actions: [
            { type: "navigate", url: payload.url },
            { type: "waitFor", ms: 1500 },
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
  },
};
