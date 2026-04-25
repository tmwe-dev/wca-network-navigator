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
import { Send, Mic, MicOff, Volume2, Sparkles, Check, BookmarkPlus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useContinuousSpeech } from "@/hooks/useContinuousSpeech";
import { createSuggestion } from "@/data/suggestedImprovements";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { appendProposalChat, type HarmonizeProposal } from "@/data/harmonizeRuns";

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

export function GordonChatPanel({ runId, proposal, userId, onApplyRegenerated, voiceId, agentId }: Props) {
  const [messages, setMessages] = useState<ChatMsg[]>(proposal.chat ?? []);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<PendingRegeneration | null>(null);
  const [savingRule, setSavingRule] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const speech = useContinuousSpeech((text) => {
    setInput((prev) => (prev ? prev + " " + text : text));
  });

  // Reset quando cambia proposta
  useEffect(() => {
    setMessages(proposal.chat ?? []);
    setPending(null);
    setInput("");
  }, [proposal.id, proposal.chat]);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages, pending]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
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

      if (data.regenerated_after) {
        setPending({ text: data.regenerated_after, ruleSuggestion: data.suggested_rule ?? null });
      } else if (data.suggested_rule) {
        // Solo regola, senza nuovo testo: la mostriamo come "pending" senza testo rigenerato
        setPending({ text: "", ruleSuggestion: data.suggested_rule });
      }

      // Persistenza chat: salva sia il messaggio utente che la risposta dell'assistente
      try {
        await appendProposalChat(runId, proposal.id, [
          { role: "user", content: text },
          { role: "assistant", content: data.reply },
        ]);
      } catch (persistErr) {
        console.warn("[GordonChatPanel] persist chat failed", persistErr);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "errore di rete";
      toast.error(msg);
      setMessages((prev) => [...prev, { role: "assistant", content: `⚠️ ${msg}` }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, runId, proposal.id, agentId]);

  const playTTS = async (text: string) => {
    if (!voiceId) {
      toast.info("Voce non configurata per Gordon");
      return;
    }
    try {
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
          body: JSON.stringify({ text: text.slice(0, 3000), voiceId }),
        }
      );
      if (!res.ok) {
        toast.error("TTS non disponibile");
        return;
      }
      const blob = await res.blob();
      new Audio(URL.createObjectURL(blob)).play();
    } catch {
      toast.error("Errore riproduzione voce");
    }
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

  const handleApplyAndSaveRule = async () => {
    setSavingRule(true);
    try {
      // 1) Applica il nuovo after (se presente)
      if (pending?.text) {
        const res = await onApplyRegenerated(proposal.id, pending.text);
        if (!res.ok) {
          toast.error(res.reason ?? "Salvataggio testo fallito");
          return;
        }
      }
      // 2) Salva la regola permanente in suggested_improvements
      const rule = pending?.ruleSuggestion;
      if (rule) {
        await createSuggestion(userId, {
          source_context: "manual_correction",
          suggestion_type: "kb_rule",
          title: rule.title,
          content: rule.content,
          reasoning: `Suggerita da Gordon durante revisione proposta ${proposal.id} (${proposal.target.table})`,
          priority: "medium",
        });
        toast.success("Regola salvata — visibile in Suggerimenti da approvare");
      } else {
        toast.success("Testo applicato (nessuna regola da salvare)");
      }
      setPending(null);
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
                  {voiceId && (
                    <button
                      onClick={() => playTTS(m.content)}
                      className="mt-0.5 flex-shrink-0 text-muted-foreground hover:text-foreground"
                      aria-label="Ascolta"
                      title="Ascolta con la voce di Gordon"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                  )}
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

        {/* Pending regenerated_after / rule */}
        {pending && (
          <Card className="p-3 border-primary/40 bg-primary/5 space-y-2">
            {pending.text && (
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-primary flex items-center gap-1 mb-1">
                  <Sparkles className="w-3 h-3" /> Nuovo "after" da Gordon
                </div>
                <pre className="text-[11px] bg-background/70 p-2 rounded border whitespace-pre-wrap max-h-40 overflow-auto">
                  {pending.text}
                </pre>
              </div>
            )}
            {pending.ruleSuggestion && (
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-primary flex items-center gap-1 mb-1">
                  <BookmarkPlus className="w-3 h-3" /> Regola permanente proposta
                </div>
                <p className="text-[11px] font-medium">{pending.ruleSuggestion.title}</p>
                <p className="text-[10px] text-muted-foreground italic">{pending.ruleSuggestion.content}</p>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              {pending.text && (
                <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={handleApplyHereOnly} disabled={savingRule}>
                  <Check className="w-3 h-3 mr-1" /> Usa solo qui
                </Button>
              )}
              <Button size="sm" className="h-7 text-[11px]" onClick={handleApplyAndSaveRule} disabled={savingRule}>
                {savingRule ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <BookmarkPlus className="w-3 h-3 mr-1" />}
                {pending.text ? "Usa qui + salva regola" : "Salva come regola permanente"}
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-[11px] ml-auto" onClick={() => setPending(null)} disabled={savingRule}>
                Ignora
              </Button>
            </div>
          </Card>
        )}
      </div>

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