/**
 * Hook to generate AI strategy for a selected holding pattern message.
 * Calls the agent-execute edge function to analyze the message and propose a response.
 */
import { useState } from "react";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { supabase } from "@/integrations/supabase/client";
import type { ChannelMessage } from "@/hooks/useChannelMessages";

export interface HoldingStrategy {
  draftReply: string;
  sentiment: "positive" | "neutral" | "negative" | "unknown";
  intent: string;
  suggestedAction: string;
  nextStepDate: string | null;
  confidence: number;
}

export function useHoldingStrategy() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [strategy, setStrategy] = useState<HoldingStrategy | null>(null);

  const analyze = async (message: ChannelMessage, companyName: string) => {
    setIsAnalyzing(true);
    setStrategy(null);
    try {
      // Find the first active agent to use for analysis
      const { data: agents } = await supabase
        .from("agents")
        .select("id")
        .eq("is_active", true)
        .limit(1)
        .single();

      if (!agents?.id) {
        console.error("No active agent found for strategy analysis");
        return null;
      }

      const result = await invokeEdge<{ strategy: HoldingStrategy }>("agent-execute", {
        body: {
          agent_id: agents.id,
          chat_messages: [{
            role: "user",
            content: `Analizza questo messaggio in arrivo da "${companyName}" e proponi una strategia di risposta.\n\nOggetto: ${message.subject || "—"}\nCorpo: ${message.body_text || "—"}\nCanale: ${message.channel}\nData: ${message.email_date || message.created_at}\n\nRispondi con:\n1. Una bozza di risposta professionale\n2. Il sentiment del messaggio (positive/neutral/negative)\n3. L'intent rilevato (interesse, richiesta info, reclamo, OOO, ecc.)\n4. L'azione suggerita (rispondere, attendere, escalation, chiamare)\n5. Data suggerita per il prossimo step`
          }],
        },
        context: "useHoldingStrategy",
      });

      // Parse AI response into structured strategy
      const content = (result as any)?.response || (result as any)?.message || "";
      setStrategy({
        draftReply: content,
        sentiment: "unknown",
        intent: "da analizzare",
        suggestedAction: "Rispondi",
        nextStepDate: null,
        confidence: 70,
      });

      return strategy;
    } catch (err: any) {
      console.error("Strategy analysis failed:", err);
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  };

  const reset = () => setStrategy(null);

  return { analyze, isAnalyzing, strategy, setStrategy, reset };
}
