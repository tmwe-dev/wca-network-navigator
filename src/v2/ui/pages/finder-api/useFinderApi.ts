/**
 * useFinderApi — state + AI invocation per la Finder API page.
 * Charter: tutte le invocazioni AI passano da `invokeAi` con scope `finder_api`.
 */
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { invokeAi } from "@/lib/ai/invokeAi";
import { proposeFinderApiKb } from "@/data/finderApiKb";
import type { Message } from "../command/components/CommandHistory";

export interface FinderToolResult {
  op: string;
  ok: boolean;
  data: unknown;
}

export interface FinderKbProposal {
  title: string;
  body: string;
  trigger_query?: string;
  trigger_op?: string;
  trigger_error?: string;
  tags?: string[];
}

interface ChatHistoryMsg {
  role: "user" | "assistant";
  content: string;
}

function ts() {
  return new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

export function useFinderApi() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [inputFocused, setInputFocused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastResults, setLastResults] = useState<FinderToolResult[]>([]);
  const [lastKbProposal, setLastKbProposal] = useState<FinderKbProposal | null>(null);
  const [canvasOpen, setCanvasOpen] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const idRef = useRef(0);
  const historyRef = useRef<ChatHistoryMsg[]>([]);

  const pushMsg = useCallback((m: Omit<Message, "id">) => {
    setMessages((prev) => [...prev, { ...m, id: ++idRef.current }]);
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (busy) return;
    setBusy(true);
    pushMsg({ role: "user", content, timestamp: ts() });
    pushMsg({ role: "assistant", content: "", timestamp: ts(), agentName: "Finder API", thinking: true });
    historyRef.current.push({ role: "user", content });

    try {
      const res = await invokeAi<{
        text: string;
        spoken_summary?: string;
        tool_results?: FinderToolResult[];
        kb_proposal?: FinderKbProposal | null;
        error?: string;
      }>("finder-api-chat", {
        scope: "finder_api",
        context: { source: "FinderApiPage", route: "/v2/finder-api", mode: "query" },
        body: { messages: historyRef.current },
      });

      setMessages((prev) => prev.filter((m) => !m.thinking));

      if (res.error) {
        toast.error(res.error);
        pushMsg({ role: "assistant", content: `⚠️ ${res.error}`, timestamp: ts(), agentName: "Finder API" });
        return;
      }

      const text = res.text || "Pronto.";
      pushMsg({ role: "assistant", content: text, timestamp: ts(), agentName: "Finder API" });
      historyRef.current.push({ role: "assistant", content: text });

      const tr = res.tool_results ?? [];
      if (tr.length > 0) {
        setLastResults(tr);
        setCanvasOpen(true);
      }
      if (res.kb_proposal) {
        setLastKbProposal(res.kb_proposal);
        setCanvasOpen(true);
      }
    } catch (err) {
      setMessages((prev) => prev.filter((m) => !m.thinking));
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Errore Finder API: ${msg}`);
      pushMsg({ role: "assistant", content: `⚠️ Errore: ${msg}`, timestamp: ts(), agentName: "Finder API" });
    } finally {
      setBusy(false);
    }
  }, [busy, pushMsg]);

  const saveKbProposal = useCallback(async () => {
    if (!lastKbProposal) return;
    try {
      await proposeFinderApiKb(lastKbProposal);
      toast.success("Articolo KB salvato (in attesa di approvazione)");
      setLastKbProposal(null);
    } catch (err) {
      toast.error(`Errore salvataggio KB: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [lastKbProposal]);

  const dismissKbProposal = useCallback(() => setLastKbProposal(null), []);
  const closeCanvas = useCallback(() => {
    setCanvasOpen(false);
    setLastResults([]);
    setLastKbProposal(null);
  }, []);

  return {
    messages, input, setInput, inputFocused, setInputFocused, busy,
    lastResults, lastKbProposal, canvasOpen,
    chatEndRef, sendMessage, saveKbProposal, dismissKbProposal, closeCanvas,
  };
}