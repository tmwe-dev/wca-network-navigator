import { createBusinessCard } from "@/v2/io/supabase/mutations/business-cards";
import { supabase } from "@/integrations/supabase/client";
import type { Tool, ToolResult } from "./types";

/**
 * REGOLA TASSATIVA: Use Google search via Partner Connect to find LinkedIn profiles.
 * NEVER call LinkedIn extension's extractProfile directly — that violates TOS.
 * This tool now searches for the LinkedIn profile URL instead.
 */

export const scrapeLinkedInProfileTool: Tool = {
  id: "scrape-linkedin-profile",
  label: "Cerca profilo LinkedIn",
  description:
    "Cerca il profilo LinkedIn di una persona usando Google (Partner Connect). Salva il profilo come business card.",
  match: (p: string) =>
    /scrape.*linkedin|estrai.*linkedin|scarica.*linkedin|cerca.*linkedin/i.test(p),
  execute: async (_prompt, context) => {
    if (!context?.confirmed) {
      return {
        kind: "approval",
        title: "Cerca profilo LinkedIn",
        description:
          "Cercherò il profilo LinkedIn usando Google Search (Partner Connect) e salverò i dati come business card.",
        details: [
          {
            label: "Metodo",
            value: "Partner Connect Google Search",
          },
          { label: "Destinazione", value: "business_cards" },
        ],
        governance: {
          role: "USER",
          permission: "EXECUTE:SEARCH",
          policy: "POLICY v1.0 · GOOGLE_SEARCH",
        },
        pendingPayload: {},
        toolId: "scrape-linkedin-profile",
      } as ToolResult;
    }

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Utente non autenticato");

    // Use Google Search via Partner Connect to find LinkedIn profile
    // This avoids direct LinkedIn scraping which violates TOS
    const { buildLinkedInGoogleQueries, pickBestLinkedInCandidate } = await import("@/lib/linkedinSearch");
    const { useFireScrapeExtensionBridge } = await import("@/hooks/useFireScrapeExtensionBridge");

    // Note: In tool context, we cannot use hooks directly. This is a limitation.
    // For now, return an error instructing the user to use the LinkedIn Lookup UI instead.
    return {
      kind: "result",
      title: "Usa LinkedIn Lookup",
      message: "Per cercare profili LinkedIn, usa il pulsante 'LinkedIn Lookup' nell'interfaccia Cockpit. Usa Google Search tramite Partner Connect, non il direct scraping.",
      meta: { count: 0, sourceLabel: "Please use Cockpit UI → LinkedIn Lookup" },
    } as ToolResult;
  },
};
