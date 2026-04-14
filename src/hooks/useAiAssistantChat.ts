import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { createLogger } from "@/lib/log";
import { findActiveWorkPlans } from "@/data/workPlans";

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
const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`;

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
  const [activePlans, setActivePlans] = useState<Record<string, unknown>[]>([]);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return;
      const data = await findActiveWorkPlans(session.user.id);
      setActivePlans(data || []);
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
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const enrichedContext = { ...context, currentPage: location.pathname };

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: allMsgs, context: enrichedContext }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Errore di rete" }));
        upsertAssistant(`⚠️ ${err.error || "Errore"}`);
        setIsLoading(false);
        return;
      }

      const contentType = resp.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const data = await resp.json();
        const content = data.content || data.error || "Nessuna risposta";
        upsertAssistant(content);
        const { uiActions } = parseStructuredMessage(content);
        if (uiActions.length > 0) handleUiActions(uiActions);
        setIsLoading(false);
        return;
      }

      if (!resp.body) { upsertAssistant("Errore: nessun body"); setIsLoading(false); return; }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });
        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try { const parsed = JSON.parse(jsonStr); const content = parsed.choices?.[0]?.delta?.content; if (content) upsertAssistant(content); }
          catch (e) { log.debug("stream parse chunk failed", { error: e instanceof Error ? e.message : String(e) }); textBuffer = line + "\n" + textBuffer; break; }
        }
      }

      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (raw.startsWith(":") || raw.trim() === "") continue;
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try { const parsed = JSON.parse(jsonStr); const content = parsed.choices?.[0]?.delta?.content; if (content) upsertAssistant(content); } catch (e) { log.debug("best-effort operation failed", { error: e instanceof Error ? e.message : String(e) }); /* intentionally ignored: best-effort cleanup */ }
        }
      }

      const { uiActions } = parseStructuredMessage(assistantSoFar);
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
