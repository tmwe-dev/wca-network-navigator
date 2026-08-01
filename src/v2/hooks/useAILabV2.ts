/**
 * useAILabV2 — AI Lab playground hook
 */
import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchOperativePromptsRaw } from "@/v2/io/supabase/queries/ai-lab";
import { invokeAi } from "@/lib/ai/invokeAi";

export function useAILabV2() {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("openai/gpt-5-mini");
  const [response, setResponse] = useState("");
  const [running, setRunning] = useState(false);

  const promptsQuery = useQuery({
    queryKey: ["v2", "operative-prompts"],
    queryFn: async () => {
      const { data, error } = await fetchOperativePromptsRaw();
      if (error) return [];
      return data ?? [];
    },
  });

  const run = useCallback(async () => {
    if (!prompt.trim()) return;
    setRunning(true);
    setResponse("");
    try {
      const data = await invokeAi<{ response?: string; message?: string }>("ai-assistant", {
        scope: "lab",
        context: { source: "useAILabV2", mode: "playground" },
        body: {
          messages: [{ role: "user", content: prompt }],
          context: "ai_lab_playground",
          model,
        },
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
