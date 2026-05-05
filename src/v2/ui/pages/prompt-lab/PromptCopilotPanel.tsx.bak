/**
 * PromptCopilotPanel — colonna destra del Prompt Reader.
 *
 * 3 tab:
 *  - Co-pilot Chat (modalità Editor: propone diff su un blocco)
 *  - Mappa KB    (visualizza kb-index-map)
 *  - Aggiungi KB (intake nuovo materiale → kb-intake-analyze → proposta)
 *
 * NON scrive su prompt o kb_entries: produce solo proposte
 * (`prompt_change_proposals`, `kb_entry_proposals`).
 */
import { useEffect, useState } from "react";
import { Bot, Loader2, MessageSquare, Plus, Save, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createPromptChangeProposal } from "@/data/promptChangeProposals";
import { createKbEntryProposal } from "@/data/kbProposals";

type ChatMsg = { role: "user" | "assistant"; content: string };

interface KbConsulted { id: string; category: string; chapter: string | null; title: string }
interface CopilotResponse {
  reply: string;
  proposal: { proposed_content?: string; rationale?: string; risks?: string; assumptions?: string } | null;
  kb_consulted: KbConsulted[];
  families_used: string[];
  intent: string;
}

interface IndexMap {
  total_active_entries: number;
  families: Array<{ family: string; categories: string[]; total_entries: number; sample_titles: string[]; chapters: Record<string, number> }>;
  intent_routing: Record<string, string[]>;
}

export interface PromptCopilotPanelProps {
  agentSlug: string;
  agentKbCategories: string[];
  /** Blocco target selezionato dall'utente (nome leggibile) */
  blockName: string;
  /** Contenuto attuale del blocco target (sorgente di verità per il diff) */
  currentContent: string;
  /** ID del prompt nella tabella sorgente (operative_prompts.id) — opzionale: se assente disabilita "Salva proposta" */
  promptId?: string | null;
  promptTable?: string;
}

export default function PromptCopilotPanel(props: PromptCopilotPanelProps) {
  return (
    <Tabs defaultValue="chat" className="h-full flex flex-col">
      <TabsList className="rounded-none border-b w-full justify-start h-9">
        <TabsTrigger value="chat" className="text-[11px] gap-1"><MessageSquare className="h-3 w-3" /> Chat</TabsTrigger>
        <TabsTrigger value="map" className="text-[11px] gap-1"><Sparkles className="h-3 w-3" /> Mappa KB</TabsTrigger>
        <TabsTrigger value="intake" className="text-[11px] gap-1"><Plus className="h-3 w-3" /> Aggiungi KB</TabsTrigger>
      </TabsList>
      <TabsContent value="chat" className="flex-1 min-h-0 m-0">
        <ChatTab {...props} />
      </TabsContent>
      <TabsContent value="map" className="flex-1 min-h-0 m-0">
        <MapTab />
      </TabsContent>
      <TabsContent value="intake" className="flex-1 min-h-0 m-0">
        <IntakeTab />
      </TabsContent>
    </Tabs>
  );
}

// ─── CHAT TAB ────────────────────────────────────────────────

function ChatTab({ agentSlug, agentKbCategories, blockName, currentContent, promptId, promptTable }: PromptCopilotPanelProps) {
  const [history, setHistory] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<CopilotResponse | null>(null);
  const [saving, setSaving] = useState(false);

  async function send() {
    const msg = input.trim();
    if (!msg || busy) return;
    const newHistory = [...history, { role: "user", content: msg } as ChatMsg];
    setHistory(newHistory);
    setInput("");
    setBusy(true);
    try {
      // Charter R1+R2: scope=lab, context.source identifica il caller
      const { data, error } = await supabase.functions.invoke("prompt-copilot-chat", {
        body: {
          agent_slug: agentSlug,
          agent_kb_categories: agentKbCategories,
          block_name: blockName,
          current_content: currentContent,
          user_message: msg,
          history: history.slice(-6),
          mode: "edit",
          scope: "lab",
          context: { source: "prompt-reader-copilot" },
        },
      });
      if (error) throw error;
      const resp = data as CopilotResponse;
      setLast(resp);
      setHistory([...newHistory, { role: "assistant", content: resp.reply }]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore chat");
    } finally {
      setBusy(false);
    }
  }

  async function saveAsProposal() {
    if (!last?.proposal?.proposed_content) {
      toast.error("Nessuna proposta strutturata da salvare");
      return;
    }
    if (!promptId) {
      toast.error("Prompt ID non disponibile per questo blocco");
      return;
    }
    setSaving(true);
    try {
      await createPromptChangeProposal({
        prompt_id: promptId,
        prompt_table: promptTable ?? "operative_prompts",
        block_name: blockName,
        current_content: currentContent,
        proposed_content: last.proposal.proposed_content,
        rationale: last.proposal.rationale ?? null,
        risks: last.proposal.risks ?? null,
        assumptions: last.proposal.assumptions ?? null,
        kb_entries_consulted: last.kb_consulted.map((k) => k.id),
      });
      toast.success("Proposta salvata. Revisione su /v2/prompt-lab/proposals");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Salvataggio fallito");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-3 py-2 text-[11px] text-muted-foreground bg-muted/30">
        Blocco target: <span className="font-mono text-foreground">{blockName}</span> · agente <span className="font-mono">{agentSlug}</span>
      </div>
      <ScrollArea className="flex-1 px-3 py-2">
        {history.length === 0 ? (
          <p className="text-[11px] text-muted-foreground italic px-2 py-4">
            Chiedi al co-pilot di migliorare il blocco. L'AI consulta solo le KB pertinenti
            (decision tree intent → famiglie) e propone un diff. La proposta sarà salvata come
            change request, mai applicata direttamente.
          </p>
        ) : (
          <div className="space-y-3">
            {history.map((m, i) => (
              <div
                key={i}
                className={
                  m.role === "user"
                    ? "ml-6 rounded bg-primary/10 px-3 py-2 text-[12px] leading-relaxed"
                    : "mr-6 rounded bg-muted px-3 py-2 text-[12px] leading-relaxed whitespace-pre-wrap"
                }
              >
                <div className="text-[10px] uppercase font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                  {m.role === "assistant" && <Bot className="h-3 w-3" />}
                  {m.role}
                </div>
                {m.content}
              </div>
            ))}
          </div>
        )}
        {last && (
          <div className="mt-3 space-y-2">
            <div className="text-[10px] uppercase font-semibold text-muted-foreground">
              KB consultate ({last.kb_consulted.length}) · intent: <span className="font-mono">{last.intent}</span> · famiglie: {last.families_used.join(", ")}
            </div>
            <div className="flex flex-wrap gap-1">
              {last.kb_consulted.map((k) => (
                <Badge key={k.id} variant="outline" className="text-[10px]" title={`${k.category}/${k.chapter ?? "-"}`}>
                  {k.title}
                </Badge>
              ))}
            </div>
            {last.proposal?.proposed_content && (
              <Button size="sm" className="w-full mt-2 gap-1.5 h-8" onClick={saveAsProposal} disabled={saving || !promptId}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                Salva come Change Request
              </Button>
            )}
          </div>
        )}
      </ScrollArea>
      <div className="border-t p-2 flex gap-1.5">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void send(); }}
          rows={2}
          placeholder="Es: rendi più severo il guardrail sul rifiuto…"
          className="text-[12px] resize-none"
          disabled={busy}
        />
        <Button size="sm" onClick={send} disabled={busy || !input.trim()} className="h-auto">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );
}

// ─── MAPPA KB TAB ────────────────────────────────────────────

function MapTab() {
  const [map, setMap] = useState<IndexMap | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.functions.invoke("kb-index-map", { body: {} })
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) { toast.error(error.message); return; }
        setMap(data as IndexMap);
      })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  if (loading) return <div className="p-4 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin inline mr-1" /> Carico mappa KB…</div>;
  if (!map) return <div className="p-4 text-xs text-destructive">Mappa KB non disponibile</div>;

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-3 text-xs">
        <div className="text-[11px] text-muted-foreground">
          {map.total_active_entries} entry attive in KB · {map.families.length} famiglie canoniche
        </div>
        {map.families.map((f) => (
          <div key={f.family} className="rounded border p-2">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold uppercase text-primary text-[11px]">{f.family}</span>
              <Badge variant="secondary" className="text-[10px]">{f.total_entries} entry</Badge>
            </div>
            <div className="text-[10px] text-muted-foreground mb-1">
              Categorie: {f.categories.join(", ")}
            </div>
            {f.sample_titles.length > 0 && (
              <ul className="text-[10px] text-muted-foreground list-disc pl-4">
                {f.sample_titles.slice(0, 3).map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            )}
          </div>
        ))}
        <div className="pt-2 border-t">
          <div className="text-[11px] font-semibold mb-1">Decision tree intent → famiglie</div>
          <ul className="space-y-1">
            {Object.entries(map.intent_routing).map(([intent, fams]) => (
              <li key={intent} className="text-[10px]">
                <span className="font-mono">{intent}</span> → {fams.join(" + ")}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </ScrollArea>
  );
}

// ─── INTAKE TAB ──────────────────────────────────────────────

function IntakeTab() {
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [proposal, setProposal] = useState<Record<string, unknown> | null>(null);
  const [saving, setSaving] = useState(false);

  async function analyze() {
    if (!content.trim()) return;
    setAnalyzing(true);
    setProposal(null);
    try {
      const { data, error } = await supabase.functions.invoke("kb-intake-analyze", {
        body: { raw_content: content, source: url ? "url" : "paste", source_url: url || undefined },
      });
      if (error) throw error;
      setProposal((data as { proposal: Record<string, unknown> }).proposal);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Analisi fallita");
    } finally {
      setAnalyzing(false);
    }
  }

  async function save() {
    if (!proposal) return;
    setSaving(true);
    try {
      await createKbEntryProposal({
        source: url ? "url" : "paste",
        raw_content: content,
        source_url: url || null,
        suggested_category: (proposal.suggested_category as string) ?? null,
        suggested_chapter: (proposal.suggested_chapter as string) ?? null,
        suggested_title: (proposal.suggested_title as string) ?? null,
        suggested_content: (proposal.suggested_content as string) ?? null,
        suggested_tags: (proposal.suggested_tags as string[]) ?? [],
        suggested_priority: (proposal.suggested_priority as number) ?? 50,
        conflicts_with: (proposal.conflicts_with as string[]) ?? [],
        duplicates_of: (proposal.duplicates_of as string) ?? null,
        ai_rationale: (proposal.rationale as string) ?? null,
      });
      toast.success("Proposta KB salvata. Revisione su /v2/prompt-lab/proposals");
      setContent(""); setUrl(""); setProposal(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Salvataggio fallito");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-2">
        <p className="text-[11px] text-muted-foreground">
          Incolla nuovo materiale: l'AI suggerisce categoria/capitolo/tag/priorità e segnala duplicati o conflitti.
        </p>
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="URL sorgente (opzionale)"
          className="text-[12px] h-8"
        />
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={6}
          placeholder="Incolla qui il testo da valutare per l'inserimento in KB…"
          className="text-[12px]"
        />
        <Button size="sm" onClick={analyze} disabled={analyzing || !content.trim()} className="w-full h-8 gap-1.5">
          {analyzing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          Analizza
        </Button>

        {proposal && (
          <div className="rounded border bg-muted/30 p-2 space-y-1.5 text-[11px]">
            <div><span className="text-muted-foreground">Categoria:</span> <span className="font-mono">{String(proposal.suggested_category ?? "—")}</span></div>
            <div><span className="text-muted-foreground">Chapter:</span> <span className="font-mono">{String(proposal.suggested_chapter ?? "—")}</span></div>
            <div><span className="text-muted-foreground">Titolo:</span> {String(proposal.suggested_title ?? "—")}</div>
            <div><span className="text-muted-foreground">Tags:</span> {((proposal.suggested_tags as string[]) ?? []).join(", ") || "—"}</div>
            <div><span className="text-muted-foreground">Priorità:</span> {String(proposal.suggested_priority ?? "—")}</div>
            {proposal.duplicates_of ? (
              <div className="text-amber-600 dark:text-amber-400">⚠ Duplicato sospetto di: {String(proposal.duplicates_of)}</div>
            ) : null}
            {((proposal.conflicts_with as string[]) ?? []).length > 0 ? (
              <div className="text-destructive">⚠ Conflitti con: {(proposal.conflicts_with as string[]).join(", ")}</div>
            ) : null}
            {proposal.rationale ? (
              <div className="text-muted-foreground italic mt-2">{String(proposal.rationale)}</div>
            ) : null}
            {proposal.suggested_content ? (
              <details className="mt-2">
                <summary className="cursor-pointer text-[10px] font-semibold">Anteprima contenuto</summary>
                <pre className="whitespace-pre-wrap break-words text-[11px] mt-1 bg-background p-2 rounded">
                  {String(proposal.suggested_content)}
                </pre>
              </details>
            ) : null}
            <Button size="sm" onClick={save} disabled={saving} className="w-full mt-2 h-8 gap-1.5">
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              Salva proposta KB
            </Button>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}