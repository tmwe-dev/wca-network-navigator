import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { DraftChannel } from "@/pages/Cockpit";

export interface RecipientIntelligence {
  sources_checked: string[];
  data_found: Record<string, boolean>;
  enrichment_snippet: string;
  warning: string | null;
}

export interface OutreachDebug {
  model: string;
  quality: string;
  language_detected: string;
  language_used: string;
  country_code: string;
  recipient_name_resolved: string;
  sender_alias: string;
  sender_company: string;
  sender_role: string;
  kb_loaded: boolean;
  sales_kb_loaded: boolean;
  sales_kb_sections: string;
  goal_used: string;
  proposal_used: string;
  tokens_input: number;
  tokens_output: number;
  credits_consumed: number;
  channel_instructions: string;
  settings_keys_found: string[];
  recipient_intelligence?: RecipientIntelligence;
  interaction_history_count?: number;
  website_source?: "cached" | "live_scraped" | "not_available";
  linkedin_source?: "cached" | "live_scraped" | "not_available";
}

export interface OutreachResult {
  channel: string;
  subject: string;
  body: string;
  contact_name: string | null;
  contact_email: string | null;
  company_name: string | null;
  language: string;
  _debug?: OutreachDebug;
}

export function useOutreachGenerator() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<OutreachResult | null>(null);

  const generate = async (params: {
    channel: DraftChannel;
    contact_name: string;
    contact_email?: string;
    company_name: string;
    country_code?: string;
    language?: string;
    goal?: string;
    base_proposal?: string;
    quality?: "fast" | "standard" | "premium";
    linkedin_profile?: {
      name?: string;
      headline?: string;
      location?: string;
      about?: string;
      profileUrl?: string;
    };
  }) => {
    if (!params.channel) return null;
    setIsGenerating(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-outreach", {
        body: params,
      });

      if (error) {
        let parsed: any = null;
        try {
          if (error.context instanceof Response) {
            parsed = await error.context.json();
          }
        } catch (e) { console.warn("[OutreachGenerator] failed to parse error response:", e); }
        throw new Error(parsed?.error || error.message);
      }
      if (data?.error) throw new Error(data.error);

      const outreach = data as OutreachResult;
      setResult(outreach);
      return outreach;
    } catch (err: any) {
      toast({ title: "Errore generazione", description: err.message, variant: "destructive" });
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  const reset = () => setResult(null);

  return { generate, isGenerating, result, setResult, reset };
}
