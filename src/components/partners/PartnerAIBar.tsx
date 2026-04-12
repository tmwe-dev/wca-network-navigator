import { useState, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Bot, Send, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { toast } from "sonner";
import AIMarkdown from "@/components/intelliflow/AIMarkdown";
import { dispatchAiAgentEffects, parseAiAgentResponse } from "@/lib/ai/agentResponse";
import { createLogger } from "@/lib/log";

const log = createLogger("PartnerAIBar");

interface Props {
  viewContext?: {
    viewLevel: "countries" | "country" | "list";
    selectedCountry: string | null;
    totalPartners: number;
    selectedCount: number;
  };
}

export function PartnerAIBar({ viewContext }: Props) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastResponse, setLastResponse] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [history, setHistory] = useState<{ role: string; content: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setLoading(true);
    setLastResponse(null);

    const newMessages = [...history, { role: "user", content: text }];

    try {
      const data = await invokeEdge<any>("ai-assistant", { body: {
          messages: newMessages,
          context: viewContext ? {
            source: "partner_hub",
            viewLevel: viewContext.viewLevel,
            selectedCountry: viewContext.selectedCountry,
            totalPartners: viewContext.totalPartners,
            selectedCount: viewContext.selectedCount,
          } : undefined,
        }, context: "PartnerAIBar.ai_assistant" });
      if (data?.error) {
        toast.error(data.error);
        setLoading(false);
        return;
      }

      const raw = data?.content || "";
      dispatchAiAgentEffects(parseAiAgentResponse(raw));
      setLastResponse(raw);
      setHistory([...newMessages, { role: "assistant", content: raw }]);
      setExpanded(true);
    } catch (e: any) {
      log.error("ai bar error", { message: e instanceof Error ? e.message : String(e) });
      toast.error(e.message || "Errore di comunicazione");
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading, history, viewContext]);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <Bot className="w-3.5 h-3.5 text-primary shrink-0" />
        <div className="relative flex-1">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Chiedi info su partner, paesi, network, blacklist…"
            className="h-7 text-xs pr-8 border-primary/15 bg-card/60"
            disabled={loading}
          />
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-0.5 top-1/2 -translate-y-1/2 h-5 w-5"
            onClick={send}
            disabled={loading || !input.trim()}
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
          </Button>
        </div>
      </div>

      {lastResponse && (
        <div className="bg-primary/5 border border-primary/15 rounded-md px-2 py-1.5">
          <button
            className="flex items-center gap-1 text-[10px] font-medium text-primary w-full text-left"
            onClick={() => setExpanded(!expanded)}
          >
            <Bot className="w-3 h-3" />
            <span>Risposta AI</span>
            {expanded ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
          </button>
          {expanded && (
            <div className="mt-1 text-[11px] text-foreground prose prose-sm prose-p:my-0.5 prose-li:my-0 max-w-none ai-prose">
              <AIMarkdown content={lastResponse} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
