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
import { Bot, Check, Globe, Loader2, Paperclip, Save, Send, Sparkles, Target, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { createPromptChangeProposal } from "@/data/promptChangeProposals";
import { createKbEntryProposal } from "@/data/kbProposals";
import { DiffViewer } from "./components/DiffViewer";
import { buildDiffText } from "@/lib/textDiff";

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
  global_proposal: GlobalProposal | null;
  occurrences: Occurrence[];
  kb_consulted: KbConsulted[];
  families_used: string[];
  intent: string;
  mode: "edit" | "global" | "diagnose";
}
interface IntakeResponse {
  proposal: KbProposal;
}
interface Occurrence {
  kind: "operative_prompt" | "kb_entry";
  id: string;
  label: string;
  field: string;
  excerpt: string;
}
interface GlobalReplacement {
  source_kind: "operative_prompt" | "kb_entry";
  source_id: string;
  source_label: string;
  field: string;
  old_excerpt: string;
  new_excerpt: string;
  rationale: string;
  risk: "low" | "medium" | "high";
}
interface GlobalProposal {
  global_replacements?: GlobalReplacement[];
  skipped?: Array<{ source_id: string; reason: string }>;
}

export interface PromptCopilotPanelProps {
  agentSlug: string;
  agentKbCategories: string[];
  blockName: string;
  currentContent: string;
  promptId?: string | null;
  promptTable?: string;
  /** When true, the panel is in fullscreen mode: chat and proposal box get more vertical room. */
  expanded?: boolean;
  /**
   * When true, container è abbastanza largo per il layout a 2 colonne
   * (proposta SX, chat DX). Calcolato dal parent via ResizeObserver.
   */
  compactWidth?: boolean;
}

export default function PromptCopilotPanel(props: PromptCopilotPanelProps) {
  const { agentSlug, agentKbCategories, blockName, currentContent, promptId, promptTable, expanded = false, compactWidth = false } = props;

  // Modalità: 'block' (lavora sul blocco target) | 'global' (search-replace su tutto)
  const [mode, setMode] = useState<"block" | "global">("block");
  const [searchTerm, setSearchTerm] = useState("");

  const [history, setHistory] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  // Proposta corrente sul prompt (mostrata sopra)
  const [promptProposal, setPromptProposal] = useState<PromptProposal | null>(null);
  const [kbConsulted, setKbConsulted] = useState<KbConsulted[]>([]);
  const [savingPrompt, setSavingPrompt] = useState(false);

  // Proposta GLOBALE corrente (batch di sostituzioni)
  const [globalProposal, setGlobalProposal] = useState<GlobalProposal | null>(null);
  const [savingGlobal, setSavingGlobal] = useState(false);

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
    if (!msg && !attachedMaterial.trim() && !(mode === "global" && searchTerm.trim())) return;
    if (busy) return;

    setBusy(true);
    const userBubble: ChatMsg = {
      role: "user",
      content: attachedMaterial
        ? `${msg || "(materiale allegato per la KB)"}\n\n📎 ${attachedMaterial.slice(0, 200)}${attachedMaterial.length > 200 ? "…" : ""}`
        : (mode === "global" ? `🌐 Globale "${searchTerm}": ${msg}` : msg),
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
      } else if (mode === "global") {
        // ── GLOBALE: search-replace su prompt + KB
        const { data, error } = await supabase.functions.invoke("prompt-copilot-chat", {
          body: {
            user_message: msg || `Cerca "${searchTerm}" e proponi sostituzioni dove ha senso.`,
            search_term: searchTerm,
            history: history.filter((h) => h.kind !== "intake").slice(-4).map((h) => ({ role: h.role, content: h.content })),
            mode: "global",
            scope: "lab",
            context: { source: "prompt-reader-copilot-global" },
          },
        });
        if (error) throw error;
        const resp = data as CopilotResponse;
        if (resp.global_proposal?.global_replacements?.length) {
          setGlobalProposal(resp.global_proposal);
        }
        const occCount = resp.occurrences?.length ?? 0;
        const planCount = resp.global_proposal?.global_replacements?.length ?? 0;
        const header = `🌐 Trovate ${occCount} occorrenze · proposte ${planCount} sostituzioni\n\n`;
        setHistory((h) => [...h, { role: "assistant", content: header + resp.reply, kind: "chat" }]);
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
      const diffText = buildDiffText(currentContent ?? "", promptProposal.proposed_content);
      await createPromptChangeProposal({
        prompt_id: promptId,
        prompt_table: promptTable ?? "operative_prompts",
        block_name: blockName,
        current_content: currentContent,
        proposed_content: promptProposal.proposed_content,
        diff_text: diffText,
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

  async function saveGlobalBatch() {
    if (!globalProposal?.global_replacements?.length) return;
    setSavingGlobal(true);
    const batchId = crypto.randomUUID();
    let okCount = 0;
    try {
      for (const r of globalProposal.global_replacements) {
        try {
          if (r.source_kind === "operative_prompt") {
            await createPromptChangeProposal({
              prompt_id: r.source_id,
              prompt_table: "operative_prompts",
              block_name: r.field,
              current_content: r.old_excerpt,
              proposed_content: r.new_excerpt,
              rationale: `[GLOBAL "${searchTerm}"] ${r.rationale}`,
              risks: `Rischio dichiarato: ${r.risk}`,
              assumptions: `Sostituzione su ${r.source_label}`,
              kb_entries_consulted: [],
            });
            okCount++;
          } else {
            await createKbEntryProposal({
              source: "chat",
              raw_content: r.new_excerpt,
              suggested_title: r.source_label,
              suggested_content: r.new_excerpt,
              ai_rationale: `[GLOBAL "${searchTerm}"] ${r.rationale} (era: "${r.old_excerpt}")`,
            });
            okCount++;
          }
        } catch (err) {
          console.error("global save fail", r.source_id, err);
        }
      }
      toast.success(`${okCount}/${globalProposal.global_replacements.length} proposte salvate (batch ${batchId.slice(0, 8)})`);
      setGlobalProposal(null);
    } finally {
      setSavingGlobal(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header: blocco target */}
      <div className="border-b px-3 py-2 bg-muted/30 space-y-1.5">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Bot className="h-3 w-3 text-primary" />
          {mode === "block" ? (
            <>Blocco <span className="font-mono text-foreground">{blockName}</span> · <span className="font-mono">{agentSlug}</span></>
          ) : (
            <>Modalità globale: cerca e sostituisci in tutti i prompt + KB</>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant={mode === "block" ? "default" : "outline"}
            className="h-6 text-[10px] gap-1 px-2"
            onClick={() => setMode("block")}
          >
            <Target className="h-3 w-3" /> Blocco
          </Button>
          <Button
            size="sm"
            variant={mode === "global" ? "default" : "outline"}
            className="h-6 text-[10px] gap-1 px-2"
            onClick={() => setMode("global")}
            title="Cerca un termine in tutti i prompt e tutte le entry KB e proponi sostituzioni"
          >
            <Globe className="h-3 w-3" /> Globale
          </Button>
          {mode === "global" && (
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Termine da cercare (es. WSI Network Navigator)"
              className="flex-1 ml-2 text-[11px] h-6 rounded border bg-background px-2"
            />
          )}
        </div>
      </div>

      {/* Body: layout 2 colonne (compactWidth) o verticale (default).
          La proposta resta visibile in parallelo alla chat quando c'è spazio. */}
      <div className={cn(
        "flex-1 min-h-0 flex",
        compactWidth ? "flex-row" : "flex-col"
      )}>

      {/* PROPOSTA: a sinistra (compactWidth) o sopra (mobile) */}
      <div className={cn(
        "bg-card overflow-hidden flex flex-col",
        compactWidth
          ? "w-1/2 border-r min-h-0"
          : cn("border-b", expanded ? "max-h-[60%]" : "max-h-[45%]")
      )}>
        <div className="px-3 py-1.5 text-[10px] uppercase font-semibold text-primary tracking-wider border-b bg-muted/40">
          {mode === "global" ? "Batch di sostituzioni globali" : "Modifica proposta dall'AI"}
        </div>
        <ScrollArea className="flex-1">
          {mode === "global" ? (
            !globalProposal?.global_replacements?.length ? (
              <div className="p-4 text-[11px] text-muted-foreground italic">
                Scrivi cosa cercare e cosa cambiare. Esempio:<br />
                <em>"Ovunque dica che Luca è direttore del CRM di WSI Network Navigator,
                correggi: direttore del CRM di Transport Management Worldwide Express (TMWE)."</em>
                <br /><br />
                L'AI cerca in tutti i prompt e in tutte le KB, esamina ogni occorrenza nel
                contesto e propone solo dove ha senso.
              </div>
            ) : (
              <div className="p-3 space-y-2">
                {globalProposal.global_replacements.map((r, i) => (
                  <div key={i} className="rounded border bg-background p-2 space-y-1 text-[11px]">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="outline" className="text-[9px]">{r.source_kind}</Badge>
                      <span className="font-mono text-[10px] text-muted-foreground">{r.field}</span>
                      <span className="font-medium truncate">{r.source_label}</span>
                      <Badge
                        variant={r.risk === "high" ? "destructive" : r.risk === "medium" ? "secondary" : "outline"}
                        className="text-[9px] ml-auto"
                      >
                        {r.risk}
                      </Badge>
                    </div>
                    <div className="bg-destructive/10 rounded px-2 py-1 text-[11px] line-through text-muted-foreground">
                      {r.old_excerpt}
                    </div>
                    <div className="bg-success/10 rounded px-2 py-1 text-[11px]">
                      {r.new_excerpt}
                    </div>
                    <div className="text-[10px] text-muted-foreground italic">{r.rationale}</div>
                  </div>
                ))}
                {globalProposal.skipped?.length ? (
                  <details className="text-[10px] text-muted-foreground">
                    <summary className="cursor-pointer">Saltate ({globalProposal.skipped.length})</summary>
                    <ul className="mt-1 space-y-0.5">
                      {globalProposal.skipped.map((s, i) => (
                        <li key={i}><span className="font-mono">{s.source_id.slice(0, 8)}</span>: {s.reason}</li>
                      ))}
                    </ul>
                  </details>
                ) : null}
                <div className="flex gap-1.5 pt-1">
                  <Button size="sm" className="flex-1 h-7 gap-1.5 text-[11px]" onClick={saveGlobalBatch} disabled={savingGlobal}>
                    {savingGlobal ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                    Salva tutte come proposte ({globalProposal.global_replacements.length})
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => setGlobalProposal(null)}>
                    Scarta
                  </Button>
                </div>
              </div>
            )
          ) : !promptProposal ? (
            <div className="p-4 text-[11px] text-muted-foreground italic">
              Nessuna proposta ancora. Scrivi nella chat sotto cosa vuoi migliorare
              (es. <em>"leggi il prompt e rendi più severo il guardrail"</em>) — l'AI
              consulta da sola la KB pertinente e propone qui sopra il nuovo testo.
            </div>
          ) : (
            <div className="p-3 space-y-2">
              {/* Diff before/after evidenziato — la cosa più importante: cosa cambia */}
              <DiffViewer before={currentContent ?? ""} after={promptProposal.proposed_content ?? ""} />
              {/* Testo finale completo (collassato in dettaglio) */}
              <details className="rounded border bg-muted/20">
                <summary className="cursor-pointer text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1 hover:bg-muted/40">
                  Vedi testo completo proposto
                </summary>
                <pre className="text-[12px] whitespace-pre-wrap font-mono leading-relaxed p-2 max-h-[300px] overflow-auto">
                  {promptProposal.proposed_content}
                </pre>
              </details>
              {promptProposal.rationale && (
                <div className="text-[11px]">
                  <span className="font-semibold">Perché:</span>{" "}
                  <span className="text-muted-foreground">{promptProposal.rationale}</span>
                </div>
              )}
              {promptProposal.risks && (
                <div className="text-[11px]">
                  <span className="font-semibold text-warning dark:text-warning">Rischi:</span>{" "}
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

      {/* CHAT: a destra (compactWidth) o sotto */}
      <div className={cn("flex-1 min-h-0 flex flex-col", compactWidth && "w-1/2")}>
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
              <div className="rounded border bg-warning/10 p-2 mr-6 text-[11px] space-y-1.5">
                <div className="font-semibold text-[11px] flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> L'AI propone di salvarlo così:
                </div>
                <div><span className="text-muted-foreground">Categoria:</span> <span className="font-mono">{kbProposal.suggested_category ?? "—"}</span> / {kbProposal.suggested_chapter ?? "—"}</div>
                <div><span className="text-muted-foreground">Titolo:</span> {kbProposal.suggested_title ?? "—"}</div>
                {kbProposal.duplicates_of && (
                  <div className="text-warning dark:text-warning">⚠ Possibile duplicato di: {kbProposal.duplicates_of}</div>
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