import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { countActivePartners } from "@/data/partners";
import { countPartnerContacts } from "@/data/partnerRelations";
import { countEmailDrafts } from "@/data/emailDrafts";
import { countBusinessCards } from "@/data/businessCards";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { useAIConversation, type ConversationMessage } from "@/hooks/useAIConversation";
import { dispatchAiAgentEffects, parseAiAgentResponse } from "@/lib/ai/agentResponse";
import { useContinuousSpeech } from "@/hooks/useContinuousSpeech";
import type { StructuredPartner } from "@/components/operations/AiResultsPanel";
import { ROUTE_OUTREACH, ROUTE_NETWORK, ROUTE_CRM, ROUTE_AGENDA } from "@/constants/routes";

function useSystemStats() {
  return useQuery({
    queryKey: ["intelliflow-stats"],
    queryFn: async () => {
      const [partners, contacts, drafts, cards] = await Promise.all([
        countActivePartners().then(c => ({ count: c })),
        countPartnerContacts().then(c => ({ count: c })),
        countEmailDrafts().then(c => ({ count: c })),
        countBusinessCards().then(c => ({ count: c })),
      ]);
      return { partners: partners.count ?? 0, contacts: contacts.count ?? 0, drafts: drafts.count ?? 0, cards: cards.count ?? 0 };
    },
    staleTime: 60_000,
  });
}

const QUICK_PROMPTS: Record<string, string[]> = {
  default: ["Riepilogo del giorno", "Partner senza contatti", "Attività in scadenza", "Stato campagne attive"],
  [`/${ROUTE_OUTREACH}`]: ["Filtra contatti italiani", "Seleziona tutti con priorità alta", "Prepara email per i contatti selezionati", "Deep search dei selezionati"],
  [`/${ROUTE_NETWORK}`]: ["Scarica tutti i partner", "Scarica partner USA", "Aggiorna profili mancanti", "Stato download attivi"],
  [`/${ROUTE_CRM}`]: ["Contatti importati per origine", "Contatti senza email", "Statistiche per paese", "Contatti più recenti"],
};

const PAGE_LABELS: Record<string, string> = {
  [`/${ROUTE_OUTREACH}`]: "Cockpit", [`/${ROUTE_NETWORK}`]: "Network", [`/${ROUTE_CRM}`]: "CRM",
  "/": "Dashboard", "/global": "Global", [`/${ROUTE_AGENDA}`]: "Agenda",
};

export interface OverlayProps {
  open: boolean;
  onClose: () => void;
  cockpitContacts?: Array<{ id: string; name: string; company: string; country: string; priority: number; language: string; channels: string[] }>;
  onCockpitAIActions?: (actions: unknown[], message: string) => void;
}

export function useIntelliFlowOverlay({ open, onClose, cockpitContacts, onCockpitAIActions }: OverlayProps) {
  const { messages, addMessages, newConversation, conversations, resumeConversation, deleteConversation } = useAIConversation("intelliflow");
  const location = useLocation();
  const currentPage = location.pathname;
  const seg = currentPage.replace(/^\/v2/, "");
  const isCockpit = seg === `/${ROUTE_OUTREACH}`;

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showPanel, setShowPanel] = useState(true);
  const [mode, setMode] = useState<"operational" | "conversational">("operational");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: stats } = useSystemStats();
  const speech = useContinuousSpeech((text) => setInput(text));
  const isEmpty = messages.length === 0;

  const panelData = useMemo(() => {
    const allPartners: StructuredPartner[] = [];
    const allOperations: Record<string, unknown>[] = [];
    for (const msg of messages) {
      if (msg.role !== "assistant") continue;
      const parsed = parseAiAgentResponse<StructuredPartner>(msg.content);
      if (parsed.partners.length) allPartners.push(...parsed.partners);
      if (parsed.operations.length) allOperations.push(...parsed.operations);
    }
    return { partners: allPartners, operations: allOperations };
  }, [messages]);

  const hasPanelContent = panelData.partners.length > 0 || panelData.operations.length > 0;

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const ts = () => new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  const quickPrompts = QUICK_PROMPTS[currentPage] || QUICK_PROMPTS.default;
  const pageLabel = PAGE_LABELS[currentPage] || "Sistema";
  const statsLine = stats
    ? `${stats.partners.toLocaleString("it-IT")} partner · ${stats.contacts.toLocaleString("it-IT")} contatti · ${stats.drafts.toLocaleString("it-IT")} campagne · ${stats.cards.toLocaleString("it-IT")} business card`
    : "Caricamento dati…";

  const sendMessage = useCallback(async (text?: string) => {
    const content = (text || input).trim();
    if (!content || loading) return;
    const userMsg: ConversationMessage = { role: "user", content, timestamp: ts() };
    const prevMessages = [...messages, userMsg];
    await addMessages([userMsg]);
    setInput("");
    setLoading(true);
    const history = prevMessages.map(m => ({ role: m.role, content: m.content }));
    try {
      if (isCockpit && mode === "operational" && cockpitContacts) {
        const data = await invokeEdge<Record<string, unknown>>("unified-assistant", { body: { scope: "cockpit", command: content, contacts: cockpitContacts }, context: "IntelliFlowOverlay.cockpit_assistant" });
        if (data?.error) throw new Error(String(data.error));
        const actions = (data?.actions as unknown[]) || [];
        const message = String(data?.message || "Comando eseguito.");
        if (onCockpitAIActions && actions.length > 0) onCockpitAIActions(actions, message);
        await addMessages([{ role: "assistant", content: message, timestamp: ts() }]);
      } else {
        const scope = mode === "conversational" ? "strategic" : "partner_hub";
        const body = mode === "conversational"
          ? { scope, messages: history, pageContext: currentPage, systemStats: stats }
          : { scope, messages: history, context: { currentPage } };
        const data = await invokeEdge<Record<string, unknown>>("unified-assistant", { body, context: `IntelliFlowOverlay.unified_${scope}` });
        const raw = String(data?.content || data?.message || "");
        dispatchAiAgentEffects(parseAiAgentResponse(raw));
        await addMessages([{ role: "assistant", content: raw, timestamp: ts() }]);
      }
    } catch (e: unknown) {
      await addMessages([{ role: "assistant", content: "⚠️ " + (e instanceof Error ? e.message : "Errore di comunicazione"), timestamp: ts() }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading, messages, addMessages, mode, stats, currentPage, isCockpit, cockpitContacts, onCockpitAIActions]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 300); }, [open]);

  return {
    messages, newConversation, conversations, resumeConversation, deleteConversation,
    input, setInput, loading, inputFocused, setInputFocused,
    showHistory, setShowHistory, showPanel, setShowPanel,
    mode, setMode, chatEndRef, inputRef, speech,
    isEmpty, panelData, hasPanelContent,
    quickPrompts, pageLabel, statsLine, sendMessage,
  };
}
