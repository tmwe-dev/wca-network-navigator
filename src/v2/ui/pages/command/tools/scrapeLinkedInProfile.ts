import { callExtension } from "@/v2/io/extensions/bridge";
import { createBusinessCard } from "@/v2/io/supabase/mutations/business-cards";
import { supabase } from "@/integrations/supabase/client";
import type { Tool, ToolResult } from "./types";

interface LinkedInProfile {
  url: string;
  name: string;
  headline: string;
  company: string;
  position: string;
  location: string;
  email?: string;
  phone?: string;
  about?: string;
}

export const scrapeLinkedInProfileTool: Tool = {
  id: "scrape-linkedin-profile",
  label: "Scrape profilo LinkedIn",
  description:
    "Estrae dati dal profilo LinkedIn aperto nella tab attiva e salva come business card",
  match: (p: string) =>
    /scrape.*linkedin|estrai.*linkedin|scarica.*linkedin/i.test(p),
  execute: async (_prompt, context) => {
    if (!context?.confirmed) {
      return {
        kind: "approval",
        title: "Scrape profilo LinkedIn",
        description:
          "L'estensione leggerà il profilo LinkedIn aperto nella tab attiva e salverà i dati come business card.",
        details: [
          {
            label: "Sorgente",
            value: "Estensione browser · linkedin-scraper",
          },
          { label: "Destinazione", value: "business_cards" },
        ],
        governance: {
          role: "USER",
          permission: "EXECUTE:SCRAPE",
          policy: "POLICY v1.0 · SCRAPE",
        },
        pendingPayload: {},
        toolId: "scrape-linkedin-profile",
      } as ToolResult;
    }

    const res = await callExtension<LinkedInProfile>(
      "linkedin-scraper",
      "extractProfile",
      {},
    );
    if (!res.ok) throw new Error(res.error);

    const profile = res.data;

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Utente non autenticato");

    const card = await createBusinessCard({
      user_id: user.id,
      company_name: profile.company || null,
      contact_name: profile.name || null,
      position: profile.position || null,
      email: profile.email ?? null,
      phone: profile.phone ?? null,
      location: profile.location || null,
      notes: profile.about ?? null,
      raw_data: profile as unknown as Record<string, unknown>,
    });

    if (card._tag === "Err")
      throw new Error(card.error.message ?? "Salvataggio fallito");

    return {
      kind: "result",
      title: "Profilo salvato",
      message: `Business card creata per ${profile.name} (${profile.company})`,
      meta: { count: 1, sourceLabel: "LinkedIn → business_cards" },
    } as ToolResult;
  },
};
