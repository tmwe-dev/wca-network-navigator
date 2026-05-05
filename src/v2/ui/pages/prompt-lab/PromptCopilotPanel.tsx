/**
 * PromptCopilotPanel — pannello unico Co-pilot.
 *
 * Layout verticale:
 *   ┌──────────────────────────────────────┐
 *   │ MODIFICHE PROPOSTE (sopra)           │  ← diff/preview che l'AI propone
 *   ├──────────────────────────────────────┤
 *   │ CHAT con AI (sotto)                  │  ← parli, lui legge KB, propone
 *   │ [📎 Aggiungi materiale alla KB]     │
 *   └──────────────────────────────────────┘
 *
 * L'AI legge da sola la KB pertinente al blocco target. L'utente può:
 *  - chiedere "leggi il prompt" / "migliora il guardrail" / etc.
 *  - allegare nuovo materiale: l'AI lo confronta con la KB esistente e
 *    propone se/dove inserirlo (duplicati, conflitti, categoria).
 *
 * Nessuna scrittura diretta: tutto sale come proposta da revisionare.
 */
import { useEffect, useRef, useState } from "react";
import { Bot, Check, Loader2, Paperclip, Save, Send, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createPromptChangeProposal } from "@/data/promptChangeProposals";
import { createKbEntryProposal } from "@/data/kbProposals";

type ChatMsg = {
  role: "user" | "assistant";
  content: string;
  kind?: "chat" | "intake";
};

interface KbConsulted { id: string; category: string; chapter: string | null; title: string }
interface PromptProposal { proposed_content?: string; rationale?: string; risks?: string; assumptions?: string }
interface KbProposal {
  suggested_category?: string | null;
  suggested_chapter?: string | null;
  suggested_title?: string | null;
  suggested_content?: string | null;
  suggested_tags?: string[];
  suggested_priority?: number;
  conflicts_with?: string[];
  duplicates_of?: string | null;
  rationale?: string | null;
}
interface CopilotResponse {
  reply: string;
  proposal: PromptProposal | null;
  kb_consulted: KbConsulted[];
  families_used: string[];
  intent: string;
}
interface IntakeResponse {
  proposal: KbProposal;
}

export interface PromptCopilotPanelProps {
  agentSlug: string;
  agentKbCategories: string[];
  blockName: string;
  currentContent: string;
  promptId?: string | null;
  promptTable?: string;
}

export default function PromptCopilotPanel(props: PromptCopilotPanelProps) {
  const { agentSlug, agentKbCategories, blockName, currentContent, promptId, promptTable } = props;

  const [history, setHistory] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  // Proposta corrente sul prompt (mostrata sopra)
  const [promptProposal, setPromptProposal] = useState<PromptProposal | null>(null);
  const [kbConsulted, setKbConsulted] = useState<KbConsulted[]>([]);
  const [savingPrompt, setSavingPrompt] = useState(false);

  // Allegato KB pendente (materiale che l'utente sta sottoponendo)
  const [attachedMaterial, setAttachedMaterial] = useState<string>("");
  const [attachedUrl, setAttachedUrl] = useState<string>("");
  const [showAttach, setShowAttach] = useState(false);
  const [kbProposal, setKbProposal] = useState<KbProposal | null>(null);
  const [savingKb, setSavingKb] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset proposta quando cambia blocco target
  useEffect(() => {
    setPromptProposal(null);
    setKbConsulted([]);
  }, [blockName, agentSlug]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [history, busy]);

  async function readFile(f: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result ?? ""));
      r.onerror = () => reject(r.error);
      r.readAsText(f);
    });
  }

  async function handleFile(f: File) {
    try {
      const text = await readFile(f);
      setAttachedMaterial(text);
      setShowAttach(true);
      toast.success(`Allegato: ${f.name} (${text.length} char)`);
    } catch {
      toast.error("Lettura file fallita");
    }
  }

  async function send() {
    const msg = input.trim();
    if (!msg && !attachedMaterial.trim()) return;
    if (busy) return;

    setBusy(true);
    const userBubble: ChatMsg = {
      role: "user",
      content: attachedMaterial
        ? `${msg || "(materiale allegato per la KB)"}\n\n📎 ${attachedMaterial.slice(0, 200)}${attachedMaterial.length > 200 ? "…" : ""}`
        : msg,
      kind: attachedMaterial ? "intake" : "chat",
    };
    setHistory((h) => [...h, userBubble]);
    setInput("");

    try {
      if (attachedMaterial.trim()) {
        // ── INTAKE: l'AI valuta nuovo materiale per la KB
        const { data, error } = await supabase.functions.invoke("kb-intake-analyze", {
          body: {
            raw_content: attachedMaterial,
            source: attachedUrl ? "url" : "paste",
            source_url: attachedUrl || undefined,
            user_hint: msg || undefined,
          },
        });
        if (error) throw error;
        const resp = data as IntakeResponse;
        setKbProposal(resp.proposal);
        const summary = formatKbProposalSummary(resp.proposal);
        setHistory((h) => [...h, { role: "assistant", content: summary, kind: "intake" }]);
      } else {
        // ── CHAT: editor sul blocco target
        const { data, error } = await supabase.functions.invoke("prompt-copilot-chat", {
          body: {
            agent_slug: agentSlug,
            agent_kb_categories: agentKbCategories,
            block_name: blockName,
            current_content: currentContent,
            user_message: msg,
            history: history.filter((h) => h.kind !== "intake").slice(-6).map((h) => ({ role: h.role, content: h.content })),
            mode: "edit",
            scope: "lab",
            context: { source: "prompt-reader-copilot" },
          },
        });
        if (error) throw error;
        const resp = data as CopilotResponse;
        if (resp.proposal?.proposed_content) {
          setPromptProposal(resp.proposal);
          setKbConsulted(resp.kb_consulted);
        }
        setHistory((h) => [...h, { role: "assistant", content: resp.reply, kind: "chat" }]);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore AI");
      setHistory((h) => [...h, { role: "assistant", content: "⚠ Errore. Riprova.", kind: "chat" }]);
    } finally {
      setBusy(false);
    }
  }

  async function savePromptProposal() {
    if (!promptProposal?.proposed_content || !promptId) {
      toast.error("Proposta o prompt id mancante");
      return;
    }
    setSavingPrompt(true);
    try {
      await createPromptChangeProposal({
        prompt_id: promptId,
        prompt_table: promptTable ?? "operative_prompts",
        block_name: blockName,
        current_content: currentContent,
        proposed_content: promptProposal.proposed_content,
        rationale: promptProposal.rationale ?? null,
        risks: promptProposal.risks ?? null,
        assumptions: promptProposal.assumptions ?? null,
        kb_entries_consulted: kbConsulted.map((k) => k.id),
      });
      toast.success("Proposta salvata. Vai su /v2/prompt-lab/proposals per applicarla.");
      setPromptProposal(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Salvataggio fallito");
    } finally {
      setSavingPrompt(false);
    }
  }

  async function saveKbProposal() {
    if (!kbProposal) return;
    setSavingKb(true);
    try {
      await createKbEntryProposal({
        source: attachedUrl ? "url" : "paste",
        raw_content: attachedMaterial,
        source_url: attachedUrl || null,
        suggested_category: kbProposal.suggested_category ?? null,
        suggested_chapter: kbProposal.suggested_chapter ?? null,
        suggested_title: kbProposal.suggested_title ?? null,
        suggested_content: kbProposal.suggested_content ?? null,
        suggested_tags: kbProposal.suggested_tags ?? [],
        suggested_priority: kbProposal.suggested_priority ?? 50,
        conflicts_with: kbProposal.conflicts_with ?? [],
        duplicates_of: kbProposal.duplicates_of ?? null,
        ai_rationale: kbProposal.rationale ?? null,
      });
      toast.success("Materiale salvato come proposta KB.");
      setKbProposal(null);
      setAttachedMaterial("");
      setAttachedUrl("");
      setShowAttach(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Salvataggio fallito");
    } finally {
      setSavingKb(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header: blocco target */}
      <div className="border-b px-3 py-2 text-[11px] text-muted-foreground bg-muted/30 flex items-center gap-2">
        <Bot className="h-3 w-3 text-primary" />
        Stai lavorando sul blocco <span className="font-mono text-foreground">{blockName}</span>
        <span className="text-muted-foreground/60">·</span>
        <span className="font-mono">{agentSlug}</span>
      </div>

      {/* SOPRA: Modifica proposta sul prompt */}
      <div className="border-b bg-card max-h-[45%] overflow-hidden flex flex-col">
        <div className="px-3 py-1.5 text-[10px] uppercase font-semibold text-primary tracking-wider border-b bg-muted/40">
          Modifica proposta dall'AI
        </div>
        <ScrollArea className="flex-1">
          {!promptProposal ? (
            <div className="p-4 text-[11px] text-muted-foreground italic">
              Nessuna proposta ancora. Scrivi nella chat sotto cosa vuoi migliorare
              (es. <em>"leggi il prompt e rendi più severo il guardrail"</em>) — l'AI
              consulta da sola la KB pertinente e propone qui sopra il nuovo testo.
            </div>
          ) : (
            <div className="p-3 space-y-2">
              <div className="rounded border bg-background p-2 text-[12px] whitespace-pre-wrap font-mono leading-relaxed">
                {promptProposal.proposed_content}
              </div>
              {promptProposal.rationale && (
                <div className="text-[11px]">
                  <span className="font-semibold">Perché:</span>{" "}
                  <span className="text-muted-foreground">{promptProposal.rationale}</span>
                </div>
              )}
              {promptProposal.risks && (
                <div className="text-[11px]">
                  <span className="font-semibold text-amber-600 dark:text-amber-400">Rischi:</span>{" "}
                  <span className="text-muted-foreground">{promptProposal.risks}</span>
                </div>
              )}
              {promptProposal.assumptions && (
                <div className="text-[11px]">
                  <span className="font-semibold">Assunzioni:</span>{" "}
                  <span className="text-muted-foreground">{promptProposal.assumptions}</span>
                </div>
              )}
              {kbConsulted.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1 border-t">
                  <span className="text-[10px] text-muted-foreground mr-1">KB consultate:</span>
                  {kbConsulted.map((k) => (
                    <Badge key={k.id} variant="outline" className="text-[10px]" title={`${k.category}/${k.chapter ?? "-"}`}>
                      {k.title}
                    </Badge>
                  ))}
                </div>
              )}
              <div className="flex gap-1.5 pt-1">
                <Button size="sm" className="flex-1 h-7 gap-1.5 text-[11px]" onClick={savePromptProposal} disabled={savingPrompt || !promptId}>
                  {savingPrompt ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  Salva come proposta
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => setPromptProposal(null)}>
                  Scarta
                </Button>
              </div>
            </div>
          )}
        </ScrollArea>
      </div>

      {/* SOTTO: Chat */}
      <div className="flex-1 min-h-0 flex flex-col">
        <ScrollArea className="flex-1" ref={scrollRef as never}>
          <div className="p-3 space-y-2">
            {history.length === 0 && (
              <p className="text-[11px] text-muted-foreground italic">
                Parla con l'AI. Esempi:
                <br />— "leggi il prompt e dimmi cosa è debole"
                <br />— "migliora il guardrail sui rifiuti"
                <br />— allega materiale con 📎 e l'AI lo confronta con la KB
              </p>
            )}
            {history.map((m, i) => (
              <div
                key={i}
                className={
                  m.role === "user"
                    ? "ml-6 rounded bg-primary/10 px-3 py-2 text-[12px] leading-relaxed whitespace-pre-wrap"
                    : "mr-6 rounded bg-muted px-3 py-2 text-[12px] leading-relaxed whitespace-pre-wrap"
                }
              >
                {m.content}
              </div>
            ))}
            {busy && (
              <div className="mr-6 rounded bg-muted px-3 py-2 text-[12px] flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" /> L'AI sta consultando la KB…
              </div>
            )}

            {/* Box proposta KB (intake) */}
            {kbProposal && (
              <div className="rounded border bg-amber-50 dark:bg-amber-950/30 p-2 mr-6 text-[11px] space-y-1.5">
                <div className="font-semibold text-[11px] flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> L'AI propone di salvarlo così:
                </div>
                <div><span className="text-muted-foreground">Categoria:</span> <span className="font-mono">{kbProposal.suggested_category ?? "—"}</span> / {kbProposal.suggested_chapter ?? "—"}</div>
                <div><span className="text-muted-foreground">Titolo:</span> {kbProposal.suggested_title ?? "—"}</div>
                {kbProposal.duplicates_of && (
                  <div className="text-amber-700 dark:text-amber-400">⚠ Possibile duplicato di: {kbProposal.duplicates_of}</div>
                )}
                {(kbProposal.conflicts_with ?? []).length > 0 && (
                  <div className="text-destructive">⚠ Conflitti: {(kbProposal.conflicts_with ?? []).join(", ")}</div>
                )}
                <div className="flex gap-1.5 pt-1">
                  <Button size="sm" className="h-7 gap-1.5 text-[11px] flex-1" onClick={saveKbProposal} disabled={savingKb}>
                    {savingKb ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    Salva proposta KB
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => setKbProposal(null)}>Scarta</Button>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Banner allegato attivo */}
        {showAttach && attachedMaterial && (
          <div className="border-t bg-muted/40 px-3 py-1.5 flex items-center gap-2 text-[11px]">
            <Paperclip className="h-3 w-3 text-primary" />
            <span className="font-medium">Materiale allegato</span>
            <span className="text-muted-foreground">({attachedMaterial.length} char)</span>
            <Button size="sm" variant="ghost" className="h-5 w-5 p-0 ml-auto" onClick={() => { setAttachedMaterial(""); setAttachedUrl(""); setShowAttach(false); }}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* Input bar */}
        <div className="border-t p-2 space-y-1.5">
          {showAttach && (
            <div className="flex gap-1.5">
              <input
                value={attachedUrl}
                onChange={(e) => setAttachedUrl(e.target.value)}
                placeholder="URL sorgente (opzionale)"
                className="flex-1 text-[11px] h-7 rounded border bg-background px-2"
              />
              <Textarea
                value={attachedMaterial}
                onChange={(e) => setAttachedMaterial(e.target.value)}
                rows={3}
                placeholder="O incolla qui il testo da aggiungere alla KB…"
                className="flex-1 text-[11px] resize-none"
              />
            </div>
          )}
          <div className="flex gap-1.5 items-end">
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.json,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
                e.target.value = "";
              }}
            />
            <Button
              size="sm"
              variant={showAttach ? "secondary" : "ghost"}
              className="h-9 w-9 p-0 flex-shrink-0"
              onClick={() => {
                if (showAttach) {
                  setShowAttach(false);
                  setAttachedMaterial("");
                  setAttachedUrl("");
                } else {
                  setShowAttach(true);
                }
              }}
              title="Allega materiale per la KB"
            >
              <Paperclip className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-9 px-2 text-[10px] flex-shrink-0"
              onClick={() => fileInputRef.current?.click()}
              title="Carica file"
            >
              File
            </Button>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={1}
              placeholder={attachedMaterial ? "Spiega cosa è e premi invio…" : "Parla all'AI: leggi, migliora, valuta…"}
              className="text-[12px] resize-none min-h-9"
              disabled={busy}
            />
            <Button size="sm" onClick={send} disabled={busy || (!input.trim() && !attachedMaterial.trim())} className="h-9 w-9 p-0 flex-shrink-0">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatKbProposalSummary(p: KbProposal): string {
  const lines: string[] = [];
  lines.push("Ho analizzato il materiale. Ecco cosa propongo:");
  lines.push(`• Categoria: ${p.suggested_category ?? "—"} / ${p.suggested_chapter ?? "—"}`);
  lines.push(`• Titolo: ${p.suggested_title ?? "—"}`);
  if ((p.suggested_tags ?? []).length) lines.push(`• Tag: ${(p.suggested_tags ?? []).join(", ")}`);
  if (p.duplicates_of) lines.push(`⚠ Sembra un duplicato di: ${p.duplicates_of}`);
  if ((p.conflicts_with ?? []).length) lines.push(`⚠ Conflitti con: ${(p.conflicts_with ?? []).join(", ")}`);
  if (p.rationale) lines.push(`\n${p.rationale}`);
  lines.push(`\nApprova qui sotto per salvarlo come proposta KB.`);
  return lines.join("\n");
}