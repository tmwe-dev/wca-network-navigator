/**
 * Scrape tool for agent loop — calls scrape-website edge function.
 */
import { supabase } from "@/integrations/supabase/client";
import type { AgentTool, AgentToolResult } from "./index";

export const scrapeUrlTool: AgentTool = {
  name: "scrape_url",
  description: "Scrape a website URL to extract title, headings, emails, phones, and text content.",
  parameters: {
    url: { type: "string", description: "Full URL to scrape (https://...)", required: true },
    mode: { type: "string", description: "'static' or 'render' (default: static)", required: false },
  },
  requiresApproval: true,
  execute: async (args): Promise<AgentToolResult> => {
    const url = String(args.url ?? "");
    const mode = String(args.mode ?? "static");

    if (!url.startsWith("http")) {
      return { success: false, error: "URL deve iniziare con http:// o https://" };
    }

    try {
      const { data, error } = await supabase.functions.invoke("scrape-website", {
        body: { url, mode },
      });

      if (error) return { success: false, error: error.message };

      return {
        success: true,
        data: {
          url: data.url,
          title: data.title,
          description: data.description,
          emails: data.emails,
          phones: data.phones,
          headings: data.headings?.slice(0, 20),
          rawText: data.rawText?.slice(0, 3000),
        },
      };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
};
