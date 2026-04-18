import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { createLogger } from "@/lib/log";
import { findActiveWorkPlans } from "@/data/workPlans";
import { invokeEdge } from "@/lib/api/invokeEdge";

const log = createLogger("useAiAssistantChat");

export type Msg = { role: "user" | "assistant"; content: string };

export interface JobCreatedInfo {
  job_id: string; country: string; mode: string;
  total_partners: number; estimated_time_minutes: number;
}

export interface UiAction {
  action_type: "navigate" | "show_toast" | "apply_filters" | "open_dialog";
  path?: string; message?: string;
  toast_type?: "default" | "success" | "error";
  filters?: Record<string, unknown>; dialog?: string;
}

const STRUCTURED_DELIMITER = "---STRUCTURED_DATA---";
const JOB_CREATED_DELIMITER = "---JOB_CREATED---";
const UI_ACTIONS_DELIMITER = "---UI_ACTIONS---";

export function parseStructuredMessage(content: string) {
  let text = content;
  let partners: Array<Record<string, unknown>> = [];
  let jobCreated: JobCreatedInfo | null = null;
  let uiActions: UiAction[] = [];

  const uiIdx = text.indexOf(UI_ACTIONS_DELIMITER);
  if (uiIdx !== -1) {
    const jsonStr = text.substring(uiIdx + UI_ACTIONS_DELIMITER.length).trim();
    text = text.substring(0, uiIdx).trim();
    try { uiActions = JSON.parse(jsonStr.split("\n\n")[0]); } catch (e) { log.debug("best-effort operation failed", { error: e instanceof Error ? e.message : String(e) }); /* intentionally ignored: best-effort cleanup */ }
  }
  const jobIdx = text.indexOf(JOB_CREATED_DELIMITER);
  if (jobIdx !== -1) {
    const jsonStr = text.substring(jobIdx + JOB_CREATED_DELIMITER.length).trim();
    text = text.substring(0, jobIdx).trim();
    try { jobCreated = JSON.parse(jsonStr.split("\n")[0]); } catch (e) { log.debug("best-effort operation failed", { error: e instanceof Error ? e.message : String(e) }); /* intentionally ignored: best-effort cleanup */ }
  }
  const idx = text.indexOf(STRUCTURED_DELIMITER);
  if (idx !== -1) {
    const jsonStr = text.substring(idx + STRUCTURED_DELIMITER.length).trim();
    text = text.substring(0, idx).trim();
    try { const parsed = JSON.parse(jsonStr); if (parsed?.type === "partners" && Array.isArray(parsed.data)) partners = parsed.data; } catch (e) { log.debug("best-effort operation failed", { error: e instanceof Error ? e.message : String(e) }); /* intentionally ignored: best-effort cleanup */ }
  }
  return { text, partners, jobCreated, uiActions };
}

interface UseAiChatProps {
  open: boolean;
  onClose: () => void;
  context?: { selectedCountries: { code: string; name: string }[]; filterMode: string };
}

export function useAiAssistantChat({ open, onClose, context }: UseAiChatProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [activePlans, setActivePlans] = useState<Array<{ id: string; title: string; status: string; steps: Array<Record<string, unknown>>; current_step: number; tags: string[] }>>([]);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return;
      const data = await findActiveWorkPlans(session.user.id);
      setActivePlans((data || []) as unknown as Array<{ id: string; title: string; status: string; steps: Array<Record<string, unknown>>; current_step: number; tags: string[] }>);
    })();
  }, [open, messages.length]);

  const handleUiActions = useCallback((actions: UiAction[]) => {
    for (const action of actions) {
      switch (action.action_type) {
        case "navigate": if (action.path) { navigate(action.path); onClose(); } break;
        case "show_toast": toast({ title: action.toast_type === "error" ? "⚠️ Errore" : "ℹ️ Info", description: action.message || "" }); break;
        case "apply_filters": window.dispatchEvent(new CustomEvent("ai-command", { detail: { filters: action.filters } })); break;
        case "open_dialog": window.dispatchEvent(new CustomEvent("ai-ui-action", { detail: action })); break;
      }
    }
  }, [navigate, onClose]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: Msg = { role: "user", content: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    let assistantSoFar = "";
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      const allMsgs = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));
      const enrichedContext = { ...context, currentPage: location.pathname };
      const data = await invokeEdge<{ content?: string; error?: string }>("ai-assistant", {
        body: { messages: allMsgs, context: enrichedContext },
        context: "aiAssistantChat",
      });
      const content = data.content || data.error || "Nessuna risposta";
      upsertAssistant(content);
      const { uiActions } = parseStructuredMessage(content);
      if (uiActions.length > 0) handleUiActions(uiActions);
    } catch (e) {
      log.error("ai chat error", { message: e instanceof Error ? e.message : String(e) });
      upsertAssistant("⚠️ Errore di connessione. Riprova.");
    }

    setIsLoading(false);
  }, [messages, isLoading, context, location.pathname, handleUiActions]);

  const clearMessages = useCallback(() => { setMessages([]); }, []);

  return {
    messages, input, setInput, isLoading,
    scrollRef, inputRef, activePlans,
    sendMessage, clearMessages,
    currentPage: location.pathname,
  };
}
