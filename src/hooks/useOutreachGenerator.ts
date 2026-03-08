import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { DraftChannel } from "@/pages/Cockpit";

export interface OutreachResult {
  channel: string;
  subject: string;
  body: string;
  contact_name: string | null;
  contact_email: string | null;
  company_name: string | null;
  language: string;
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
        } catch {}
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
