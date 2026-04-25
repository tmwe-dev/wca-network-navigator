/**
 * GordonChatPanel — chat persistente con l'agente Curatore Gordon
 * su una specifica proposta di armonizzazione.
 *
 * Features:
 *  - Persistenza: ogni messaggio è salvato dentro proposal.chat[]
 *  - Voce: bottone 🔊 su ogni risposta di Gordon (riusa edge function elevenlabs-tts)
 *  - Dettatura: input con useContinuousSpeech
 *  - Rigenerazione "after": quando Gordon emette [REGENERATED_AFTER], mostra preview
 *    + 2 bottoni (usa solo qui / usa qui + salva regola)
 *  - Suggerimento regola: quando Gordon emette [SUGGEST_KB_RULE], card di conferma
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Send, Mic, MicOff, Volume2, VolumeX, Sparkles, Check, BookmarkPlus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useContinuousSpeech } from "@/hooks/useContinuousSpeech";
import { createSuggestion } from "@/data/suggestedImprovements";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { HarmonizeProposal } from "@/data/harmonizeRuns";

interface ChatMsg { role: "user" | "assistant"; content: string; ts?: string }

interface Props {
  runId: string;
  proposal: HarmonizeProposal;
  userId: string;
  /** Chiamata quando l'utente accetta un nuovo "after" rigenerato da Gordon. */
  onApplyRegenerated: (proposalId: string, newAfter: string) => Promise<{ ok: boolean; reason?: string }>;
  /** Voce ElevenLabs di Gordon (es. JBFqnCBsd6RMkjVDRZzb). */
  voiceId?: string | null;
  /** ID dell'agente Gordon (per system_prompt server-side). */
  agentId?: string | null;
}

interface PendingRegeneration {
  text: string;
  ruleSuggestion: { title: string; content: string } | null;
}

const DEFAULT_GORDON_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";
const SILENT_AUDIO_SRC = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQQAAAAAAA==";

function cleanReplyForSpeech(content: string) {
  const withoutTechnicalBlocks = content
    .replace(/\[REGENERATED_AFTER\][\s\S]*?\[\/REGENERATED_AFTER\]/g, "Ho preparato una nuova versione del testo. Dimmi se la accetti o cosa vuoi cambiare.")
    .replace(/\[SUGGEST_KB_RULE\][\s\S]*?\[\/SUGGEST_KB_RULE\]/g, "Posso anche salvare questa come regola per le prossime armonizzazioni.");

  return withoutTechnicalBlocks
    .replace(/_\(([^)]*)\)_/g, "$1")
    .replace(/[#*`~\[\]>|]/g, "")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, " ")
    .trim();
}

export function GordonChatPanel({ runId, proposal, userId, onApplyRegenerated, voiceId, agentId }: Props) {
  const [messages, setMessages] = useState<ChatMsg[]>(proposal.chat ?? []);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<PendingRegeneration | null>(null);
  const [savingRule, setSavingRule] = useState(false);
  const [autoVoice, setAutoVoice] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("gordon-auto-voice") !== "0";
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioActivationRef = useRef<HTMLAudioElement | null>(null);
  const lastSpokenIdxRef = useRef<number>(-1);
  const resolvedVoiceId = voiceId || DEFAULT_GORDON_VOICE_ID;

  const speech = useContinuousSpeech((text) => {
    setInput((prev) => (prev ? prev + " " + text : text));
  });

  const unlockAudioPlayback = useCallback(() => {
    if (typeof window === "undefined") return;
    const audio = audioActivationRef.current ?? new Audio(SILENT_AUDIO_SRC);
    audioActivationRef.current = audio;
    audio.muted = true;
    audio.src = SILENT_AUDIO_SRC;
    void audio.play()
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
      })
      .catch(() => {
        audio.muted = false;
      });
  }, []);

  // Reset SOLO quando cambia la proposta (non quando la chat si aggiorna server-side,
  // altrimenti lastSpokenIdxRef si reincrementa e l'autoplay TTS viene saltato).
  useEffect(() => {
    setMessages(proposal.chat ?? []);
    setPending(null);
    setInput("");
    lastSpokenIdxRef.current = (proposal.chat ?? []).length - 1; // non rileggere il pregresso
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposal.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages, pending]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    if (autoVoice) unlockAudioPlayback();
    // Stoppa la dettatura vocale se attiva, così l'input torna pulito
    if (speech.listening) speech.toggle();
    setInput("");
    setLoading(true);
    const userMsg: ChatMsg = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const { data, error } = await supabase.functions.invoke<{
        reply: string;
        regenerated_after?: string | null;
        suggested_rule?: { title: string; content: string } | null;
        error?: string;
        message?: string;
      }>("harmonize-proposal-chat", {
        body: {
          run_id: runId,
          proposal_id: proposal.id,
          agent_id: agentId,
          user_message: text,
        },
      });

      if (error || !data || data.error) {
        const msg = data?.message ?? error?.message ?? "Errore comunicazione con Gordon";
        toast.error(msg);
        setMessages((prev) => [...prev, { role: "assistant", content: `⚠️ ${msg}` }]);
        return;
      }

      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);

      // CRITICO: NON applicare nulla in autonomia. Mostra SEMPRE la card pending
      // con i bottoni Accetta/Rifiuta quando Gordon ha prodotto un nuovo testo
      // o una regola, così l'operatore decide esplicitamente.
      if (data.regenerated_after || data.suggested_rule) {
        setPending({
          text: data.regenerated_after ?? "",
          ruleSuggestion: data.suggested_rule ?? null,
        });
      }
      // La persistenza chat è già gestita dalla edge function harmonize-proposal-chat.
    } catch (e) {
      const msg = e instanceof Error ? e.message : "errore di rete";
      toast.error(msg);
      setMessages((prev) => [...prev, { role: "assistant", content: `⚠️ ${msg}` }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, autoVoice, unlockAudioPlayback, runId, proposal.id, agentId, speech]);

  const playTTS = async (text: string) => {
    try {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      const sessionRes = await supabase.auth.getSession();
      const token = sessionRes.data.session?.access_token ?? "";
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ text: text.slice(0, 3000), voiceId: resolvedVoiceId, language: "it" }),
        }
      );
      if (!res.ok) {
        toast.error("TTS non disponibile");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { URL.revokeObjectURL(url); if (audioRef.current === audio) audioRef.current = null; };
      audio.onerror = () => { URL.revokeObjectURL(url); if (audioRef.current === audio) audioRef.current = null; };
      await audio.play();
    } catch {
      toast.error("Errore riproduzione voce");
    }
  };

  // Autoplay: quando arriva un nuovo messaggio assistant e autoVoice è ON, lo legge.
  useEffect(() => {
    if (!autoVoice) return;
    if (loading) return;
    if (messages.length === 0) return;
    const lastIdx = messages.length - 1;
    const last = messages[lastIdx];
    if (last.role !== "assistant") return;
    if (lastIdx <= lastSpokenIdxRef.current) return;
    lastSpokenIdxRef.current = lastIdx;
    if (last.content.startsWith("⚠️")) return;
    let cleanText = cleanReplyForSpeech(last.content);
    // Fallback: se Gordon ha emesso solo blocchi tecnici e non resta nulla di parlabile,
    // leggi almeno una frase guida così l'operatore sa che c'è una nuova proposta pronta.
    if (cleanText.length < 5) {
      cleanText = "Ho preparato una nuova versione del testo. Dimmi se la applico o cosa vuoi cambiare.";
    }
    void playTTS(cleanText);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, loading, autoVoice, resolvedVoiceId]);

  const toggleAutoVoice = () => {
    setAutoVoice((v) => {
      const next = !v;
      localStorage.setItem("gordon-auto-voice", next ? "1" : "0");
      if (!next && audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      return next;
    });
  };

  const handleApplyHereOnly = async () => {
    if (!pending?.text) return;
    const res = await onApplyRegenerated(proposal.id, pending.text);
    if (res.ok) {
      toast.success("Nuovo testo applicato a questa proposta");
      setPending(null);
    } else {
      toast.error(res.reason ?? "Salvataggio fallito");
    }
  };

  const handleSaveRule = async () => {
    setSavingRule(true);
    try {
      const rule = pending?.ruleSuggestion;
      if (!rule) return;
      await createSuggestion(userId, {
        source_context: "manual_correction",
        suggestion_type: "kb_rule",
        title: rule.title,
        content: rule.content,
        reasoning: `Suggerita da Gordon durante revisione proposta ${proposal.id} (${proposal.target.table})`,
        priority: "medium",
      });
      toast.success("Regola salvata — visibile in Suggerimenti da approvare");
      // Rimuovi solo la regola, lascia l'eventuale testo pending finché l'utente non lo gestisce
      setPending((prev) => (prev ? { ...prev, ruleSuggestion: null } : prev));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "errore");
    } finally {
      setSavingRule(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background/40 rounded-lg border border-border/50">
      <div className="px-3 py-2 border-b border-border/30 flex items-center gap-2">
        <span className="text-xl">🧑‍🏫</span>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold leading-tight">Gordon</h3>
          <p className="text-[10px] text-muted-foreground leading-tight">Curatore — chat su questa proposta</p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={toggleAutoVoice}
          title={autoVoice ? "Voce automatica attiva — disattiva" : "Voce automatica off — attiva"}
          aria-label={autoVoice ? "Disattiva voce automatica" : "Attiva voce automatica"}
        >
          {autoVoice ? <Volume2 className="w-4 h-4 text-primary" /> : <VolumeX className="w-4 h-4 text-muted-foreground" />}
        </Button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-[260px] max-h-[480px]">
        {messages.length === 0 && (
          <div className="text-[11px] text-muted-foreground text-center py-6 px-3">
            Chiedi a Gordon il <em>perché</em> di questa proposta, oppure correggi un dato sbagliato:
            <br />
            <span className="text-foreground/60">"la sede è Peschiera, non Segrate, rigenera"</span>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn(
              "max-w-[88%] rounded-lg px-3 py-2 text-xs leading-relaxed",
              m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted/60",
            )}>
              {m.role === "assistant" ? (
                <div className="flex items-start gap-2">
                  <div className="whitespace-pre-wrap flex-1">{m.content}</div>
                  <button
                    onClick={() => {
                      unlockAudioPlayback();
                      void playTTS(cleanReplyForSpeech(m.content) || m.content);
                    }}
                    className="mt-0.5 flex-shrink-0 text-muted-foreground hover:text-foreground"
                    aria-label="Ascolta"
                    title="Ascolta con la voce di Gordon"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="whitespace-pre-wrap">{m.content}</div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-muted/60 rounded-lg px-3 py-2 text-xs">
              <span className="animate-pulse">⏳ Gordon sta pensando…</span>
            </div>
          </div>
        )}

      </div>

      {/* PENDING — sticky sopra l'input bar, sempre visibile finché c'è una proposta da decidere */}
      {pending && (pending.text || pending.ruleSuggestion) && (
        <div className="border-t border-primary/30 bg-primary/5 p-2.5 space-y-2">
          {pending.text && (
            <div className="space-y-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-primary flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Nuovo testo proposto da Gordon
              </div>
              <pre className="text-[11px] bg-background p-2 rounded border whitespace-pre-wrap max-h-32 overflow-auto">
                {pending.text}
              </pre>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="h-7 text-[11px] flex-1"
                  onClick={handleApplyHereOnly}
                  disabled={savingRule}
                >
                  <Check className="w-3 h-3 mr-1" /> Accetta nuovo testo
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[11px]"
                  onClick={() => setPending((p) => (p ? { ...p, text: "" } : null))}
                  disabled={savingRule}
                >
                  Rifiuta
                </Button>
              </div>
            </div>
          )}
          {pending.ruleSuggestion && (
            <div className="space-y-1.5 pt-1.5 border-t border-primary/20">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-primary flex items-center gap-1">
                <BookmarkPlus className="w-3 h-3" /> Regola permanente proposta
              </div>
              <p className="text-[11px] font-medium">{pending.ruleSuggestion.title}</p>
              <p className="text-[10px] text-muted-foreground italic">{pending.ruleSuggestion.content}</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="h-7 text-[11px] flex-1"
                  onClick={handleSaveRule}
                  disabled={savingRule}
                >
                  {savingRule ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <BookmarkPlus className="w-3 h-3 mr-1" />}
                  Salva regola
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[11px]"
                  onClick={() => setPending((p) => (p ? { ...p, ruleSuggestion: null } : null))}
                  disabled={savingRule}
                >
                  Scarta
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-1.5 p-2 border-t border-border/30">
        <Input
          value={speech.listening ? input + (speech.interimText ? ` ${speech.interimText}` : "") : input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
          placeholder={speech.listening ? "🎙 Sto ascoltando…" : "Scrivi a Gordon…"}
          className="text-xs h-8"
          disabled={loading}
        />
        <Button
          size="icon"
          variant={speech.listening ? "destructive" : "outline"}
          className="h-8 w-8 flex-shrink-0"
          onClick={speech.toggle}
          aria-label={speech.listening ? "Stop dettatura" : "Dettatura vocale"}
          title={speech.listening ? "Stop dettatura" : "Dettatura vocale"}
        >
          {speech.listening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
        </Button>
        <Button size="icon" className="h-8 w-8 flex-shrink-0" onClick={send} disabled={!input.trim() || loading} aria-label="Invia">
          <Send className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}