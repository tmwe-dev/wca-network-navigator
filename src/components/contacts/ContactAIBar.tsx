import { useState, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Bot, Send, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { ContactFilters } from "@/hooks/useContacts";
import ReactMarkdown from "react-markdown";

export interface AICommand {
  type: "apply_filters" | "set_sort" | "select_contacts" | "update_status" | "export_csv" | "send_to_workspace" | "create_jobs" | "multi";
  filters?: Partial<ContactFilters>;
  groupBy?: ContactFilters["groupBy"];
  sort?: string;
  contact_ids?: string[];
  status?: string;
  commands?: AICommand[];
}

interface Props {
  filters: ContactFilters;
  totalContacts: number;
  selectedCount: number;
  sortKey: string;
  onAICommand: (cmd: AICommand) => void;
}

function parseCommand(content: string): { message: string; command: AICommand | null } {
  const delimiter = "---COMMAND---";
  const idx = content.indexOf(delimiter);
  if (idx === -1) return { message: content.trim(), command: null };

  const message = content.substring(0, idx).trim();
  const jsonStr = content.substring(idx + delimiter.length).trim();
  try {
    const command = JSON.parse(jsonStr) as AICommand;
    return { message, command };
  } catch {
    return { message: content.trim(), command: null };
  }
}

export function ContactAIBar({ filters, totalContacts, selectedCount, sortKey, onAICommand }: Props) {
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
      const { data, error } = await supabase.functions.invoke("contacts-assistant", {
        body: {
          messages: newMessages,
          context: {
            filters,
            totalContacts,
            selectedCount,
            groupBy: filters.groupBy || "country",
            sortKey,
          },
        },
      });

      if (error) throw error;
      if (data?.error) {
        toast({ title: "Errore AI", description: data.error, variant: "destructive" });
        setLoading(false);
        return;
      }

      const raw = data?.content || "";
      const { message, command } = parseCommand(raw);

      setLastResponse(message);
      setHistory([...newMessages, { role: "assistant", content: raw }]);
      setExpanded(true);

      if (command) {
        if (command.type === "multi" && command.commands) {
          for (const cmd of command.commands) onAICommand(cmd);
        } else {
          onAICommand(command);
        }
      }
    } catch (e: any) {
      console.error("ContactAIBar error:", e);
      toast({ title: "Errore", description: e.message || "Errore di comunicazione", variant: "destructive" });
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading, history, filters, totalContacts, selectedCount, sortKey, onAICommand]);

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
            placeholder="Chiedi all'AI di filtrare, ordinare, selezionare…"
            className="h-7 text-xs pr-8"
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
        <div className="bg-primary/5 border border-primary/20 rounded-md px-2 py-1.5">
          <button
            className="flex items-center gap-1 text-[10px] font-medium text-primary w-full text-left"
            onClick={() => setExpanded(!expanded)}
          >
            <Bot className="w-3 h-3" />
            <span>Risposta AI</span>
            {expanded ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
          </button>
          {expanded && (
            <div className="mt-1 text-[11px] text-foreground prose prose-sm prose-p:my-0.5 prose-li:my-0 max-w-none">
              <ReactMarkdown>{lastResponse}</ReactMarkdown>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
