/**
 * AILabPage — AI playground for prompts and agents
 */
import * as React from "react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "../atoms/Button";
import { Bot, Play, Code } from "lucide-react";

export function AILabPage(): React.ReactElement {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("openai/gpt-5-mini");
  const [response, setResponse] = useState("");
  const [running, setRunning] = useState(false);

  const { data: prompts } = useQuery({
    queryKey: ["v2-operative-prompts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_prompts")
        .select("id, title, instructions, is_active, scope")
        .order("priority", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const handleRun = async () => {
    if (!prompt.trim()) return;
    setRunning(true);
    setResponse("");
    try {
      const { data, error } = await supabase.functions.invoke("ai-assistant", {
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
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">AI Lab</h1>
        <p className="text-sm text-muted-foreground">Playground per prompt e modelli AI.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input */}
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Modello</label>
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            >
              <option value="openai/gpt-5-mini">GPT-5 Mini</option>
              <option value="openai/gpt-5">GPT-5</option>
              <option value="openai/gpt-5-nano">GPT-5 Nano</option>
              <option value="google/gemini-2.5-flash">Gemini 2.5 Flash</option>
              <option value="google/gemini-2.5-pro">Gemini 2.5 Pro</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Prompt</label>
            <textarea
              className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground min-h-[200px] font-mono"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Inserisci il tuo prompt..."
            />
          </div>
          <Button onClick={handleRun} isLoading={running} className="gap-2">
            <Play className="h-4 w-4" />Esegui
          </Button>
        </div>

        {/* Output */}
        <div className="space-y-4">
          <label className="text-sm font-medium text-foreground">Risposta</label>
          <div className="rounded-md border bg-muted/30 p-4 min-h-[200px] text-sm text-foreground whitespace-pre-wrap font-mono">
            {response || "La risposta apparirà qui..."}
          </div>
        </div>
      </div>

      {/* Prompt library */}
      {prompts && prompts.length > 0 ? (
        <div className="space-y-3">
          <h3 className="font-semibold text-foreground flex items-center gap-2"><Code className="h-4 w-4" />Prompt operativi</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {prompts.map((p) => (
              <button
                key={p.id}
                onClick={() => setPrompt(p.instructions)}
                className="text-left p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <p className="font-medium text-sm text-foreground">{p.title}</p>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.instructions}</p>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
