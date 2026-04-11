/**
 * useAILabV2 — AI Lab playground hook
 */
import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdge } from "@/lib/api/invokeEdge";

export function useAILabV2() {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("openai/gpt-5-mini");
  const [response, setResponse] = useState("");
  const [running, setRunning] = useState(false);

  const promptsQuery = useQuery({
    queryKey: ["v2", "operative-prompts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_prompts")
        .select("id, title, instructions, is_active, scope")
        .order("priority", { ascending: false })
        .limit(20);
      if (error) return [];
      return data ?? [];
    },
  });

  const run = useCallback(async () => {
    if (!prompt.trim()) return;
    setRunning(true);
    setResponse("");
    try {
      const data = await invokeEdge<{ response?: string; message?: string }>("ai-assistant", {
        body: {
          messages: [{ role: "user", content: prompt }],
          context: "ai_lab_playground",
          model,
        },
        context: "aiLabV2",
      });
      setResponse(data?.response ?? data?.message ?? JSON.stringify(data, null, 2));
    } catch (e) {
      setResponse(`Errore: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRunning(false);
    }
  }, [prompt, model]);

  return {
    prompt,
    setPrompt,
    model,
    setModel,
    response,
    running,
    prompts: promptsQuery.data ?? [],
    run,
  };
}
