import { useState } from "react";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { isApiError } from "@/lib/api/apiError";
import { toast } from "@/hooks/use-toast";
import type { DraftChannel } from "@/types/cockpit";

export interface RecipientIntelligence {
  sources_checked: string[];
  data_found: Record<string, boolean>;
  enrichment_snippet: string;
  warning: string | null;
}

export type JournalistVerdict = "pass" | "pass_with_edits" | "warn" | "block";

export interface JournalistReviewSummary {
  journalist: { role: string; label: string; reasoning: string; auto: boolean };
  verdict: JournalistVerdict;
  warnings: Array<{ type: string; description: string; severity: "info" | "warning" | "blocking"; upstream_fix?: string }>;
  edits: Array<{ type: string; original_fragment: string; edited_fragment: string; reason: string }>;
  quality_score: number;
  reasoning: string;
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
  /** Verdetto del Caporedattore Finale (Giornalista AI). */
  journalist_review?: JournalistReviewSummary | null;
  /** True se il contratto email è stato applicato (canale email + partner). */
  contract_used?: boolean;
  /** Warnings dalla validazione del contratto (non bloccanti). */
  contract_warnings?: string[];
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
    email_type_id?: string;
    email_type_prompt?: string;
    email_type_structure?: string;
    oracle_tone?: string;
  }) => {
    if (!params.channel) return null;
    setIsGenerating(true);
    setResult(null);
    try {
      let data: (OutreachResult & { error?: string }) | null = null;
      try {
        data = await invokeEdge<OutreachResult & { error?: string }>("generate-content", {
          body: { action: "outreach", ...params },
          context: "useOutreachGenerator",
        });
      } catch (err) {
        if (isApiError(err)) {
          const body = (err.details?.body ?? {}) as { error?: string };
          throw new Error(body.error || err.message);
        }
        throw err;
      }
      if (data?.error) throw new Error(data.error);

      const outreach = data as OutreachResult;
      setResult(outreach);
      return outreach;
    } catch (err: unknown) {
      toast({ title: "Errore generazione", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  const reset = () => setResult(null);

  return { generate, isGenerating, result, setResult, reset };
}
