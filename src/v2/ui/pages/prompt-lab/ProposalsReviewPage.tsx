/**
 * ProposalsReviewPage — Review manuale delle Change Request prodotte dal
 * Co-pilot del Prompt Reader e dei nuovi materiali KB proposti.
 *
 * Doctrine: ADR 0004 — finché non esiste il Rubric Engine, l'approvazione
 * è SEMPRE manuale. Approvare applica la modifica al record sorgente
 * (operative_prompts.<block_name> / kb_entries) e segna lo stato "applied".
 */
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, Loader2, MessageSquare, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  listPromptChangeProposals,
  reviewPromptChangeProposal,
  type PromptChangeProposal,
} from "@/data/promptChangeProposals";
import {
  listKbEntryProposals,
  reviewKbEntryProposal,
  type KbEntryProposal,
} from "@/data/kbProposals";
import { useAuth } from "@/providers/AuthProvider";
import { DiffViewer } from "./components/DiffViewer";

const ALLOWED_BLOCKS = ["context", "objective", "procedure", "criteria", "examples"] as const;

export default function ProposalsReviewPage() {
  return (
    <div className="container max-w-6xl mx-auto py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/v2/settings/prompt-lab">
            <Button variant="ghost" size="sm" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" /> Prompt Lab
            </Button>
          </Link>
          <h1 className="text-xl font-semibold">Change Request &amp; KB Proposals</h1>
        </div>
        <Badge variant="outline" className="text-[10px]">
          ADR 0004 · approvazione manuale
        </Badge>
      </div>

      <p className="text-xs text-muted-foreground">
        Le proposte arrivano dal Co-pilot del Prompt Reader. Nessuna è applicata
        automaticamente: il Rubric Engine arriverà nelle fasi successive (vedi
        ADR 0004). Per ora ogni approvazione è una decisione umana esplicita.
      </p>

      <Tabs defaultValue="prompts">
        <TabsList>
          <TabsTrigger value="prompts" className="gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" /> Prompt
          </TabsTrigger>
          <TabsTrigger value="kb" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Knowledge Base
          </TabsTrigger>
        </TabsList>
        <TabsContent value="prompts" className="mt-3">
          <PromptProposalsList />
        </TabsContent>
        <TabsContent value="kb" className="mt-3">
          <KbProposalsList />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── PROMPT PROPOSALS ────────────────────────────────────────

function PromptProposalsList() {
  const [items, setItems] = useState<PromptChangeProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "applied" | "all">("pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const { user } = useAuth();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listPromptChangeProposals(filter === "all" ? {} : { status: filter });
      setItems(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore caricamento");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { void load(); }, [load]);

  async function approve(p: PromptChangeProposal) {
    if (!ALLOWED_BLOCKS.includes(p.block_name as typeof ALLOWED_BLOCKS[number])) {
      toast.error(`Blocco non supportato: ${p.block_name}`);
      return;
    }
    if (p.prompt_table !== "operative_prompts") {
      toast.error(`Tabella sorgente non gestita: ${p.prompt_table}`);
      return;
    }
    setBusyId(p.id);
    try {
      const patch: Record<string, string> = { [p.block_name]: p.proposed_content };
      const { error: upErr } = await supabase
        .from("operative_prompts")
        .update(patch as never)
        .eq("id", p.prompt_id);
      if (upErr) throw upErr;
      await reviewPromptChangeProposal(p.id, "approved", `applied by ${user?.email ?? "operator"}`);
      // Mark as applied (separate state to distinguish da semplici approvazioni)
      const { error: appliedErr } = await supabase
        .from("prompt_change_proposals")
        .update({ status: "applied" } as never)
        .eq("id", p.id);
      if (appliedErr) throw appliedErr;
      toast.success("Proposta applicata al prompt");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore approvazione");
    } finally {
      setBusyId(null);
    }
  }

  async function reject(p: PromptChangeProposal, note: string) {
    setBusyId(p.id);
    try {
      await reviewPromptChangeProposal(p.id, "rejected", note);
      toast.success("Proposta rifiutata");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore rifiuto");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5">
        {(["pending", "approved", "applied", "rejected", "all"] as const).map((s) => (
          <Button
            key={s}
            variant={filter === s ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(s)}
            className="h-7 text-[11px] capitalize"
          >
            {s}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="text-xs text-muted-foreground p-4"><Loader2 className="h-3 w-3 animate-spin inline mr-1" /> Carico…</div>
      ) : items.length === 0 ? (
        <div className="text-xs text-muted-foreground p-4 italic">Nessuna proposta {filter !== "all" && `con stato "${filter}"`}.</div>
      ) : (
        <ScrollArea className="h-[calc(100vh-260px)]">
          <div className="space-y-3 pr-3">
            {items.map((p) => (
              <PromptProposalCard
                key={p.id}
                p={p}
                busy={busyId === p.id}
                onApprove={() => approve(p)}
                onReject={(note) => reject(p, note)}
              />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

function PromptProposalCard({
  p, busy, onApprove, onReject,
}: {
  p: PromptChangeProposal;
  busy: boolean;
  onApprove: () => void;
  onReject: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px]">
          <Badge variant="secondary" className="font-mono text-[10px]">{p.block_name}</Badge>
          <span className="text-muted-foreground">prompt</span>
          <code className="text-[10px]">{p.prompt_id.slice(0, 8)}</code>
          <span className="text-muted-foreground">· {p.source_tool}</span>
        </div>
        <Badge variant={p.status === "pending" ? "outline" : p.status === "applied" ? "default" : "secondary"} className="text-[10px]">
          {p.status}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div>
          <div className="text-muted-foreground mb-1">Attuale</div>
          <pre className="bg-muted/50 rounded p-2 max-h-40 overflow-auto whitespace-pre-wrap break-words">{p.current_content || "—"}</pre>
        </div>
        <div>
          <div className="text-muted-foreground mb-1">Proposto</div>
          <pre className="bg-primary/5 rounded p-2 max-h-40 overflow-auto whitespace-pre-wrap break-words border border-primary/20">{p.proposed_content}</pre>
        </div>
      </div>

      {/* Diff visivo: prioritario sul confronto a 2 colonne, rende immediato cosa cambia. */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Differenze</div>
        <DiffViewer
          before={p.current_content ?? ""}
          after={p.proposed_content ?? ""}
        />
      </div>

      {(p.rationale || p.risks || p.assumptions) && (
        <div className="grid grid-cols-3 gap-2 text-[10px]">
          {p.rationale && <div><span className="font-semibold">Razionale:</span> {p.rationale}</div>}
          {p.risks && <div><span className="font-semibold text-amber-600">Rischi:</span> {p.risks}</div>}
          {p.assumptions && <div><span className="font-semibold">Assunzioni:</span> {p.assumptions}</div>}
        </div>
      )}

      {p.kb_entries_consulted.length > 0 && (
        <div className="text-[10px] text-muted-foreground">
          KB consultate: {p.kb_entries_consulted.length}
        </div>
      )}

      {p.status === "pending" && (
        <div className="flex items-center gap-2 pt-1 border-t">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={1}
            placeholder="Nota (obbligatoria per rifiuto)…"
            className="text-[11px] min-h-[32px] resize-none"
          />
          <Button size="sm" variant="outline" onClick={() => onReject(note || "rejected")} disabled={busy} className="h-8 gap-1">
            <X className="h-3 w-3" /> Rifiuta
          </Button>
          <Button size="sm" onClick={onApprove} disabled={busy} className="h-8 gap-1">
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            Approva &amp; applica
          </Button>
        </div>
      )}

      {p.review_note && (
        <div className="text-[10px] text-muted-foreground italic border-t pt-1">
          Nota review: {p.review_note}{p.reviewed_at ? ` · ${new Date(p.reviewed_at).toLocaleString()}` : ""}
        </div>
      )}
    </div>
  );
}

// ─── KB PROPOSALS ────────────────────────────────────────────

function KbProposalsList() {
  const [items, setItems] = useState<KbEntryProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const { user } = useAuth();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listKbEntryProposals(filter === "all" ? {} : { status: filter });
      setItems(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore caricamento");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { void load(); }, [load]);

  async function approve(p: KbEntryProposal) {
    if (!user?.id) { toast.error("Utente non autenticato"); return; }
    if (!p.suggested_category || !p.suggested_chapter || !p.suggested_title || !p.suggested_content) {
      toast.error("Proposta incompleta: mancano category/chapter/title/content");
      return;
    }
    setBusyId(p.id);
    try {
      const { data, error } = await supabase
        .from("kb_entries")
        .insert({
          user_id: user.id,
          category: p.suggested_category,
          chapter: p.suggested_chapter,
          title: p.suggested_title,
          content: p.suggested_content,
          tags: p.suggested_tags ?? [],
          priority: p.suggested_priority ?? 50,
          is_active: true,
        } as never)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      const newId = (data as { id: string } | null)?.id;
      await reviewKbEntryProposal(p.id, "approved", `inserted by ${user.email ?? "operator"}`, newId);
      toast.success("Materiale inserito in KB");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore approvazione");
    } finally {
      setBusyId(null);
    }
  }

  async function reject(p: KbEntryProposal, note: string) {
    setBusyId(p.id);
    try {
      await reviewKbEntryProposal(p.id, "rejected", note);
      toast.success("Materiale scartato");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore rifiuto");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5">
        {(["pending", "approved", "rejected", "all"] as const).map((s) => (
          <Button
            key={s}
            variant={filter === s ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(s)}
            className="h-7 text-[11px] capitalize"
          >
            {s}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="text-xs text-muted-foreground p-4"><Loader2 className="h-3 w-3 animate-spin inline mr-1" /> Carico…</div>
      ) : items.length === 0 ? (
        <div className="text-xs text-muted-foreground p-4 italic">Nessuna proposta {filter !== "all" && `con stato "${filter}"`}.</div>
      ) : (
        <ScrollArea className="h-[calc(100vh-260px)]">
          <div className="space-y-3 pr-3">
            {items.map((p) => (
              <KbProposalCard
                key={p.id}
                p={p}
                busy={busyId === p.id}
                onApprove={() => approve(p)}
                onReject={(note) => reject(p, note)}
              />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

function KbProposalCard({
  p, busy, onApprove, onReject,
}: {
  p: KbEntryProposal;
  busy: boolean;
  onApprove: () => void;
  onReject: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px]">
          <Badge variant="secondary" className="text-[10px]">{p.source}</Badge>
          <span className="font-mono text-[10px]">{p.suggested_category ?? "?"}/{p.suggested_chapter ?? "?"}</span>
          <span className="text-muted-foreground">prio {p.suggested_priority ?? "—"}</span>
        </div>
        <Badge variant={p.status === "pending" ? "outline" : "default"} className="text-[10px]">{p.status}</Badge>
      </div>

      <div className="text-sm font-semibold">{p.suggested_title ?? "(senza titolo)"}</div>

      {p.suggested_content && (
        <pre className="bg-muted/50 rounded p-2 max-h-48 overflow-auto whitespace-pre-wrap break-words text-[11px]">
          {p.suggested_content}
        </pre>
      )}

      {p.suggested_tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {p.suggested_tags.map((t) => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}
        </div>
      )}

      {p.duplicates_of && (
        <div className="text-[10px] text-amber-600">⚠ Duplicato sospetto di: {p.duplicates_of}</div>
      )}
      {p.conflicts_with.length > 0 && (
        <div className="text-[10px] text-destructive">⚠ Conflitti con: {p.conflicts_with.join(", ")}</div>
      )}
      {p.ai_rationale && (
        <div className="text-[10px] italic text-muted-foreground">{p.ai_rationale}</div>
      )}
      {p.source_url && (
        <a href={p.source_url} target="_blank" rel="noreferrer" className="text-[10px] underline text-primary block truncate">{p.source_url}</a>
      )}

      {p.status === "pending" && (
        <div className="flex items-center gap-2 pt-1 border-t">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={1}
            placeholder="Nota…"
            className="text-[11px] min-h-[32px] resize-none"
          />
          <Button size="sm" variant="outline" onClick={() => onReject(note || "rejected")} disabled={busy} className="h-8 gap-1">
            <X className="h-3 w-3" /> Rifiuta
          </Button>
          <Button size="sm" onClick={onApprove} disabled={busy} className="h-8 gap-1">
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            Approva &amp; inserisci in KB
          </Button>
        </div>
      )}

      {p.review_note && (
        <div className="text-[10px] text-muted-foreground italic border-t pt-1">
          Nota review: {p.review_note}{p.reviewed_at ? ` · ${new Date(p.reviewed_at).toLocaleString()}` : ""}
        </div>
      )}
    </div>
  );
}