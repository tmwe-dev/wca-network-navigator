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
  const [error, setError] = useState<string | null>(null);

  const analyze = async (message: ChannelMessage, companyName: string) => {
    setIsAnalyzing(true);
    setStrategy(null);
    setError(null);
    try {
      // Find the first active agent to use for analysis
      const { data: agents } = await supabase
        .from("agents")
        .select("id")
        .eq("is_active", true)
        .limit(1)
        .single();

      if (!agents?.id) {
        setError("Nessun agente AI attivo. Configura almeno un agente nella sezione Agenti.");
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
      const content = (result as Record<string, unknown>)?.response as string || (result as Record<string, unknown>)?.message as string || "";
      const parsed: HoldingStrategy = {
        draftReply: content,
        sentiment: "unknown",
        intent: "da analizzare",
        suggestedAction: "Rispondi",
        nextStepDate: null,
        confidence: 70,
      };
      setStrategy(parsed);
      return parsed;
    } catch (err: unknown) {
      const msg = err?.message || "Errore durante l'analisi AI";
      console.error("Strategy analysis failed:", err);
      setError(msg);
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  };

  const reset = () => {
    setStrategy(null);
    setError(null);
  };

  return { analyze, isAnalyzing, strategy, setStrategy, error, reset };
}
