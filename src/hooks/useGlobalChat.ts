import { useReducer, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAIConversation, type ConversationMessage } from "@/hooks/useAIConversation";
import { dispatchAiAgentEffects, parseAiAgentResponse, type JobCreatedInfo } from "@/lib/ai/agentResponse";
import { type StructuredPartner } from "@/components/operations/AiResultsPanel";
import { useContinuousSpeech } from "@/hooks/useContinuousSpeech";
import { useAppSettings } from "@/hooks/useAppSettings";
import { createLogger } from "@/lib/log";

const log = createLogger("GlobalChat");

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`;
const SUPER_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/unified-assistant`;
const TTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`;

type ChatMode = "operational" | "conversational";

interface ChatState {
  input: string;
  isLoading: boolean;
  mode: ChatMode;
  playingIdx: number | null;
}

type ChatAction =
  | { type: "SET_INPUT"; value: string }
  | { type: "SET_LOADING"; value: boolean }
  | { type: "SET_MODE"; value: ChatMode }
  | { type: "SET_PLAYING"; value: number | null }
  | { type: "SEND_START" }
  | { type: "SEND_END" };

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "SET_INPUT":
      return { ...state, input: action.value };
    case "SET_LOADING":
      return { ...state, isLoading: action.value };
    case "SET_MODE":
      return { ...state, mode: action.value };
    case "SET_PLAYING":
      return { ...state, playingIdx: action.value };
    case "SEND_START":
      return { ...state, input: "", isLoading: true };
    case "SEND_END":
      return { ...state, isLoading: false };
    default:
      return state;
  }
}

async function playTTS(text: string, voiceId: string): Promise<void> {
  const cleanText = text.replace(/[#*_~`>\[\]()!|]/g, "").replace(/\n{2,}/g, ". ").trim();
  if (!cleanText || cleanText.length < 5) return;
  const truncated = cleanText.length > 500 ? cleanText.slice(0, 500) + "..." : cleanText;

  const resp = await fetch(TTS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ text: truncated, voiceId }),
  });
  if (!resp.ok) throw new Error("TTS error");
  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.onended = () => URL.revokeObjectURL(url);
  await audio.play();
}

interface SSEDelta {
  choices?: Array<{ delta?: { content?: string } }>;
}

async function readSSEStream(body: ReadableStream<Uint8Array>): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let textBuffer = "";
  let result = "";

  const processLine = (line: string) => {
    if (line.startsWith(":") || line.trim() === "") return;
    if (!line.startsWith("data: ")) return;
    const jsonStr = line.slice(6).trim();
    if (jsonStr === "[DONE]") return;
    try {
      const parsed: SSEDelta = JSON.parse(jsonStr);
      const content = parsed.choices?.[0]?.delta?.content;
      if (content) result += content;
    } catch {
      // best-effort parse
    }
  };

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    textBuffer += decoder.decode(value, { stream: true });
    let newlineIndex: number;
    while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
      let line = textBuffer.slice(0, newlineIndex);
      textBuffer = textBuffer.slice(newlineIndex + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      processLine(line);
    }
  }
  // Process remaining buffer
  for (let raw of textBuffer.split("\n")) {
    if (raw.endsWith("\r")) raw = raw.slice(0, -1);
    processLine(raw);
  }
  return result;
}

interface UseGlobalChatOptions {
  onJobCreated?: (job: JobCreatedInfo) => void;
}

export function useGlobalChat({ onJobCreated }: UseGlobalChatOptions) {
  const navigate = useNavigate();
  const { data: appSettings } = useAppSettings();
  const { messages, addMessages, newConversation } = useAIConversation("global");

  const [state, dispatch] = useReducer(chatReducer, {
    input: "",
    isLoading: false,
    mode: "operational",
    playingIdx: null,
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const mountedRef = useRef(true);

  const ttsEnabled = appSettings?.elevenlabs_tts_enabled === "true";
  const defaultVoiceId = appSettings?.elevenlabs_default_voice_id || "JBFqnCBsd6RMkjVDRZzb";

  const speech = useContinuousSpeech((text) => dispatch({ type: "SET_INPUT", value: text }));

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages]);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  useEffect(() => {
    if (!onJobCreated || messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.role !== "assistant") return;
    const parsed = parseAiAgentResponse<StructuredPartner>(last.content);
    if (parsed.jobCreated) onJobCreated(parsed.jobCreated);
  }, [messages, onJobCreated]);

  const handleReplay = useCallback(async (content: string, idx: number) => {
    if (state.playingIdx !== null) return;
    dispatch({ type: "SET_PLAYING", value: idx });
    try {
      await playTTS(content, defaultVoiceId);
    } catch (e: unknown) {
      log.warn("TTS playback failed", { error: e instanceof Error ? e.message : String(e) });
      toast({ title: "Errore TTS", description: "Impossibile riprodurre l'audio", variant: "destructive" });
    } finally {
      if (mountedRef.current) dispatch({ type: "SET_PLAYING", value: null });
    }
  }, [state.playingIdx, defaultVoiceId]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || state.isLoading) return;
    const userMsg: ConversationMessage = { role: "user", content: text.trim() };
    const prevMessages = [...messages, userMsg];
    await addMessages([userMsg]);
    dispatch({ type: "SEND_START" });

    let assistantContent = "";

    try {
      const allMsgs = prevMessages.map((m) => ({ role: m.role, content: m.content }));
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const url = state.mode === "conversational" ? SUPER_URL : CHAT_URL;

      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(state.mode === "conversational"
          ? { scope: "strategic", messages: allMsgs, pageContext: "global-chat" }
          : { messages: allMsgs }),
      });

      if (!resp.ok) {
        const err: { error?: string } = await resp.json().catch(() => ({ error: "Errore di rete" }));
        assistantContent = `⚠️ ${err.error || "Errore durante la richiesta"}`;
      } else {
        const contentType = resp.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const data: { content?: string; error?: string } = await resp.json();
          assistantContent = data.content || data.error || "Nessuna risposta";
        } else if (resp.body) {
          assistantContent = await readSSEStream(resp.body);
        } else {
          assistantContent = "Errore: nessun body";
        }
      }
    } catch (e: unknown) {
      log.error("ai chat error", { message: e instanceof Error ? e.message : String(e) });
      assistantContent = "⚠️ Errore di connessione. Riprova.";
    }

    const parsed = parseAiAgentResponse<StructuredPartner>(assistantContent);
    dispatchAiAgentEffects(parsed);
    if (parsed.jobCreated && onJobCreated) onJobCreated(parsed.jobCreated);
    await addMessages([{ role: "assistant", content: assistantContent }]);
    if (mountedRef.current) dispatch({ type: "SEND_END" });

    if (ttsEnabled && defaultVoiceId && !assistantContent.startsWith("⚠️")) {
      playTTS(assistantContent, defaultVoiceId).catch(() => {});
    }
  }, [messages, state.isLoading, state.mode, addMessages, ttsEnabled, defaultVoiceId, onJobCreated]);

  return {
    messages,
    state,
    scrollRef,
    inputRef,
    speech,
    ttsEnabled,
    sendMessage,
    handleReplay,
    newConversation,
    setInput: (v: string) => dispatch({ type: "SET_INPUT", value: v }),
    setMode: (v: ChatMode) => dispatch({ type: "SET_MODE", value: v }),
  };
}
