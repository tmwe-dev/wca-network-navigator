/**
 * useKBSupervisorState — Stato chat + voce + canvas + audit + approvazioni
 *
 * Architettura: chat (sx) → canvas (dx). L'AI risponde con testo + structured action,
 * il canvas mostra diff e l'utente approva/rifiuta. Tutte le scritture KB passano
 * dal DAL (`@/data/kbEntries`) per rispettare layer rules e soft-delete.
 */
import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useVoiceInput } from "@/v2/ui/pages/command/hooks/useVoiceInput";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { toast } from "sonner";
import {
  findKbEntries,
  upsertKbEntry,
  deleteKbEntry as dalDeleteKbEntry,
  type KbEntry,
} from "@/data/kbEntries";

export interface SupervisorMessage {
  readonly id: string;
  readonly role: "user" | "assistant";
  readonly content: string;
  readonly timestamp: Date;
  readonly proposedAction?: ProposedAction;
}

export interface ProposedAction {
  readonly type: "create" | "update" | "delete" | "retag" | "merge";
  readonly targetId?: string;
  readonly targetTitle?: string;
  readonly currentContent?: string;
  readonly proposedContent?: string;
  readonly currentTags?: readonly string[];
  readonly proposedTags?: readonly string[];
  readonly currentCategory?: string;
  readonly proposedCategory?: string;
  readonly reason: string;
  readonly status: "pending" | "approved" | "rejected" | "applied";
}

export type KBDocument = KbEntry & { chapter?: string };

export type SupervisorMode = "guided" | "autonomous";
export type CanvasTab = "list" | "document" | "diff" | "audit";

interface AuditIssue {
  readonly severity: "critical" | "high" | "medium" | "low";
  readonly level: string;
  readonly category: string;
  readonly description: string;
  readonly location: string;
  readonly fix_proposal: string;
}

interface AuditReport {
  readonly summary?: {
    readonly total_issues?: number;
    readonly critical?: number;
    readonly high?: number;
    readonly medium?: number;
    readonly low?: number;
  };
  readonly results?: readonly AuditIssue[];
}

interface SupervisorResponse {
  readonly content: string;
  readonly structured?: {
    readonly action?: Omit<ProposedAction, "status">;
    readonly document_id?: string;
    readonly audit_request?: boolean;
  };
}

const DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";

export function useKBSupervisorState() {
  const [userId, setUserId] = useState<string | null>(null);

  // Core
  const [mode, setMode] = useState<SupervisorMode>("guided");
  const [messages, setMessages] = useState<SupervisorMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Voce
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Canvas
  const [activeDocument, setActiveDocument] = useState<KBDocument | null>(null);
  const [proposedChanges, setProposedChanges] = useState<ProposedAction | null>(null);
  const [canvasTab, setCanvasTab] = useState<CanvasTab>("list");
  const [documentList, setDocumentList] = useState<KBDocument[]>([]);

  // Audit
  const [auditReport, setAuditReport] = useState<AuditReport | null>(null);
  const [auditStatus, setAuditStatus] = useState<"idle" | "running" | "done">("idle");
  const [lastAuditDate, setLastAuditDate] = useState<Date | null>(null);
  const [totalIssues, setTotalIssues] = useState(0);

  const messageHistoryRef = useRef<Array<{ role: string; content: string }>>([]);

  // Carica userId
  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) setUserId(data.user?.id ?? null);
    });
    return () => { alive = false; };
  }, []);

  const loadDocuments = useCallback(async () => {
    try {
      const docs = await findKbEntries();
      setDocumentList(docs as KBDocument[]);
    } catch (err) {
      console.error("loadDocuments error:", err);
      toast.error("Errore caricamento documenti KB");
    }
  }, []);

  useEffect(() => {
    if (userId) loadDocuments();
  }, [userId, loadDocuments]);

  // TTS via edge function elevenlabs-tts
  const speakResponse = useCallback(async (text: string) => {
    if (!voiceEnabled || !userId || !text.trim()) return;
    try {
      setIsSpeaking(true);
      const { data: settings } = await supabase
        .from("app_settings")
        .select("key, value")
        .eq("user_id", userId)
        .in("key", ["elevenlabs_default_voice_id", "elevenlabs_custom_voice_id", "elevenlabs_language"]);

      const settingsMap = Object.fromEntries((settings ?? []).map(s => [s.key, s.value]));
      const voiceId = settingsMap.elevenlabs_custom_voice_id || settingsMap.elevenlabs_default_voice_id || DEFAULT_VOICE_ID;
      const language = settingsMap.elevenlabs_language || "it";

      const response = await supabase.functions.invoke("elevenlabs-tts", {
        body: { text: text.slice(0, 4000), voiceId, language },
      });

      if (response.data instanceof Blob) {
        const url = URL.createObjectURL(response.data);
        if (audioRef.current) {
          audioRef.current.pause();
          try { URL.revokeObjectURL(audioRef.current.src); } catch { /* noop */ }
        }
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => setIsSpeaking(false);
        audio.onerror = () => setIsSpeaking(false);
        await audio.play();
      } else {
        setIsSpeaking(false);
      }
    } catch (err) {
      console.error("TTS error:", err);
      setIsSpeaking(false);
    }
  }, [voiceEnabled, userId]);

  // Run audit via edge function dedicata
  const runAudit = useCallback(async () => {
    if (!userId) return;
    setAuditStatus("running");
    try {
      const result = await invokeEdge<AuditReport>("kb-supervisor", {
        body: { user_id: userId, audit_level: "all" },
        context: "kbSupervisorAudit",
      });
      setAuditReport(result);
      setAuditStatus("done");
      setLastAuditDate(new Date());
      setTotalIssues(result.summary?.total_issues ?? 0);
      setCanvasTab("audit");
      toast.success(`Audit completato: ${result.summary?.total_issues ?? 0} issues trovate`);
    } catch (err) {
      console.error("Audit error:", err);
      setAuditStatus("idle");
      toast.error("Errore durante l'audit");
    }
  }, [userId]);

  // Send message
  const sendMessage = useCallback(async (content: string) => {
    if (!userId || !content.trim()) return;

    const userMsg: SupervisorMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);
    messageHistoryRef.current.push({ role: "user", content });

    try {
      const result = await invokeEdge<SupervisorResponse>("unified-assistant", {
        body: {
          scope: "kb-supervisor",
          mode: "conversational",
          messages: messageHistoryRef.current.slice(-20),
          pageContext: "kb-supervisor",
          extra_context: {
            supervisor_mode: mode,
            active_document_id: activeDocument?.id,
            active_document_title: activeDocument?.title,
            total_kb_entries: documentList.length,
            available_categories: [...new Set(documentList.map(d => d.category))],
          },
        },
        context: "kbSupervisorChat",
      });

      const assistantMsg: SupervisorMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: result.content ?? "",
        timestamp: new Date(),
        proposedAction: result.structured?.action
          ? { ...result.structured.action, status: "pending" }
          : undefined,
      };

      if (result.structured) {
        const { action, document_id, audit_request } = result.structured;

        if (action) {
          const proposed: ProposedAction = { ...action, status: "pending" };
          setProposedChanges(proposed);
          setCanvasTab("diff");
          if (action.targetId) {
            const doc = documentList.find(d => d.id === action.targetId);
            if (doc) setActiveDocument(doc);
          }
        }

        if (document_id) {
          const doc = documentList.find(d => d.id === document_id);
          if (doc) {
            setActiveDocument(doc);
            setCanvasTab("document");
          }
        }

        if (audit_request) {
          void runAudit();
        }
      }

      setMessages(prev => [...prev, assistantMsg]);
      messageHistoryRef.current.push({ role: "assistant", content: result.content ?? "" });

      await speakResponse(result.content ?? "");
    } catch (err) {
      console.error("Supervisor chat error:", err);
      toast.error("Errore comunicazione con il supervisor");
    } finally {
      setIsLoading(false);
    }
  }, [userId, mode, activeDocument, documentList, speakResponse, runAudit]);

  // STT
  const { listening: isListening, start: startListening, stop: stopListening } = useVoiceInput({
    onTranscript: () => { /* live transcript handled internally */ },
    onAutoSubmit: (text: string) => {
      if (text.trim()) void sendMessage(text);
    },
    silenceMs: 2000,
    lang: "it-IT",
  });

  // Approve change → DAL
  const approveChange = useCallback(async () => {
    if (!proposedChanges) return;
    try {
      const action = proposedChanges;

      if (action.type === "update" && action.targetId) {
        const updates: Partial<KbEntry> & { title: string; content: string } = {
          id: action.targetId,
          title: action.targetTitle ?? "",
          content: action.proposedContent ?? "",
        };
        if (action.proposedTags !== undefined) updates.tags = [...action.proposedTags];
        if (action.proposedCategory !== undefined) updates.category = action.proposedCategory;
        await upsertKbEntry(updates, userId ?? "");
        toast.success(`Documento "${action.targetTitle}" aggiornato`);
      }

      if (action.type === "create") {
        await upsertKbEntry({
          title: action.targetTitle ?? "Nuovo documento",
          content: action.proposedContent ?? "",
          category: action.proposedCategory ?? "system_doctrine",
          tags: action.proposedTags ? [...action.proposedTags] : [],
          priority: 8,
          is_active: true,
        }, userId ?? "");
        toast.success(`Nuovo documento "${action.targetTitle}" creato`);
      }

      if (action.type === "delete" && action.targetId) {
        // Soft-delete via DAL (trigger globale gestisce is_active)
        await dalDeleteKbEntry(action.targetId);
        toast.success(`Documento "${action.targetTitle}" disattivato`);
      }

      if (action.type === "retag" && action.targetId) {
        const existing = documentList.find(d => d.id === action.targetId);
        if (existing) {
          await upsertKbEntry({
            ...existing,
            tags: action.proposedTags ? [...action.proposedTags] : [],
          }, userId ?? "");
          toast.success(`Tag aggiornati per "${action.targetTitle}"`);
        }
      }

      setProposedChanges({ ...action, status: "applied" });
      await loadDocuments();

      // Notifica AI dell'approvazione
      void sendMessage(`[SISTEMA] Modifica approvata e applicata: ${action.type} su "${action.targetTitle}"`);
    } catch (err) {
      console.error("Approve error:", err);
      toast.error("Errore nell'applicare la modifica");
    }
  }, [proposedChanges, userId, documentList, loadDocuments, sendMessage]);

  const rejectChange = useCallback(() => {
    if (!proposedChanges) return;
    setProposedChanges({ ...proposedChanges, status: "rejected" });
    toast.info("Modifica rifiutata");
    void sendMessage(`[SISTEMA] Modifica rifiutata: ${proposedChanges.type} su "${proposedChanges.targetTitle}".`);
  }, [proposedChanges, sendMessage]);

  const selectDocument = useCallback((doc: KBDocument) => {
    setActiveDocument(doc);
    setCanvasTab("document");
    setProposedChanges(null);
  }, []);

  const editDocument = useCallback((field: keyof KBDocument, value: string | string[] | number) => {
    setActiveDocument(prev => prev ? ({ ...prev, [field]: value } as KBDocument) : null);
  }, []);

  const saveDocument = useCallback(async () => {
    if (!activeDocument) return;
    try {
      await upsertKbEntry({
        id: activeDocument.id,
        title: activeDocument.title,
        content: activeDocument.content,
        category: activeDocument.category,
        tags: activeDocument.tags,
        priority: activeDocument.priority,
      }, userId ?? "");
      toast.success("Documento salvato");
      await loadDocuments();
    } catch (err) {
      console.error("Save error:", err);
      toast.error("Errore nel salvare");
    }
  }, [activeDocument, userId, loadDocuments]);

  const toggleVoice = useCallback(() => {
    setVoiceEnabled(prev => {
      const next = !prev;
      if (!next && audioRef.current) {
        audioRef.current.pause();
        setIsSpeaking(false);
      }
      return next;
    });
  }, []);

  return {
    // State
    mode, setMode,
    messages,
    isLoading,
    voiceEnabled, toggleVoice,
    isListening, isSpeaking,
    startListening, stopListening,
    activeDocument,
    proposedChanges,
    canvasTab, setCanvasTab,
    documentList,
    auditReport,
    auditStatus,
    lastAuditDate,
    totalDocuments: documentList.length,
    totalIssues,
    isVoiceConnected: voiceEnabled,
    // Actions
    sendMessage,
    approveChange,
    rejectChange,
    selectDocument,
    editDocument,
    saveDocument,
    runAudit,
  };
}

export type UseKBSupervisorState = ReturnType<typeof useKBSupervisorState>;
