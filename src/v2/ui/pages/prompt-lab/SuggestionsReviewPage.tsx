/**
 * SuggestionsReviewPage — Dashboard admin per approvare/rifiutare suggerimenti.
 *
 * Mostra tutti i suggerimenti pending (kb_rule + prompt_adjustment).
 * L'admin può: approvare, rifiutare, modificare il testo e approvare.
 * I suggerimenti approvati vengono consumati dall'Architect nel prossimo "Migliora tutto".
 */
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft,
  BookmarkPlus,
  Check,
  X,
  Edit3,
  Loader2,
  Sparkles,
  BookOpen,
  Wrench,
  User,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { useSuggestedImprovements } from "./hooks/useSuggestedImprovements";
import type { SuggestedImprovement, SuggestionPriority } from "@/data/suggestedImprovements";
import { findRecentHarmonizeRuns, type HarmonizeRun } from "@/data/harmonizeRuns";
import { useHarmonizeOrchestrator } from "./hooks/useHarmonizeOrchestrator";
import { HarmonizeReviewPanel } from "./HarmonizeReviewPanel";
import { toast } from "sonner";

function priorityColor(p: SuggestionPriority): string {
  switch (p) {
    case "critical": return "bg-destructive/15 text-destructive border-destructive/40";
    case "high": return "bg-orange-500/15 text-orange-700 border-orange-500/40";
    case "medium": return "bg-amber-500/15 text-amber-700 border-amber-500/40";
    case "low": return "bg-muted text-muted-foreground border-border";
  }
}

function typeIcon(type: string) {
  switch (type) {
    case "kb_rule": return <BookOpen className="h-3 w-3" />;
    case "prompt_adjustment": return <Wrench className="h-3 w-3" />;
    case "user_preference": return <User className="h-3 w-3" />;
    default: return <BookmarkPlus className="h-3 w-3" />;
  }
}

function typeLabel(type: string): string {
  switch (type) {
    case "kb_rule": return "Regola KB";
    case "prompt_adjustment": return "Modifica Prompt";
    case "user_preference": return "Preferenza utente";
    default: return type;
  }
}

function SuggestionCard({
  item,
  onApprove,
  onReject,
  onEditApprove,
}: {
  item: SuggestedImprovement;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string, note: string) => Promise<void>;
  onEditApprove: (id: string, content: string, note: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<"view" | "edit" | "reject">("view");
  const [editContent, setEditContent] = useState(item.content);
  const [rejectNote, setRejectNote] = useState("");
  const [busy, setBusy] = useState(false);

  const handleApprove = async () => {
    setBusy(true);
    try {
      await onApprove(item.id);
      toast.success("Approvato");
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    setBusy(true);
    try {
      await onReject(item.id, rejectNote);
      toast.success("Rifiutato");
    } finally {
      setBusy(false);
      setMode("view");
    }
  };

  const handleEditApprove = async () => {
    setBusy(true);
    try {
      await onEditApprove(item.id, editContent, "Modificato e approvato");
      toast.success("Modificato e approvato");
    } finally {
      setBusy(false);
      setMode("view");
    }
  };

  return (
    <div className={`rounded-lg border p-4 ${priorityColor(item.priority)}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-[10px] gap-1">
              {typeIcon(item.suggestion_type)}
              {typeLabel(item.suggestion_type)}
            </Badge>
            <Badge variant="secondary" className="text-[9px] uppercase">
              {item.priority}
            </Badge>
            <span className="text-[10px] text-muted-foreground">
              da {item.source_context} · {new Date(item.created_at).toLocaleDateString("it-IT")}
            </span>
          </div>
          <h3 className="text-sm font-semibold mt-1">{item.title}</h3>
          {item.reasoning && (
            <p className="text-[11px] text-muted-foreground mt-0.5 italic">{item.reasoning}</p>
          )}
          {item.target_block_id && (
            <p className="text-[10px] mt-0.5">
              Target: <code className="bg-muted rounded px-1">{item.target_block_id}</code>
            </p>
          )}
          {item.target_category && (
            <p className="text-[10px] mt-0.5">
              Categoria: <code className="bg-muted rounded px-1">{item.target_category}</code>
            </p>
          )}
        </div>
      </div>

      {/* Content */}
      {mode === "view" && (
        <pre className="rounded bg-background/60 p-3 text-[11px] font-mono leading-snug overflow-auto max-h-40 whitespace-pre-wrap mb-3">
          {item.content}
        </pre>
      )}

      {mode === "edit" && (
        <div className="mb-3">
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="text-[11px] font-mono min-h-[100px]"
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            Modifica il contenuto, poi clicca "Salva e approva".
          </p>
        </div>
      )}

      {mode === "reject" && (
        <div className="mb-3">
          <Textarea
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            placeholder="Motivo del rifiuto (opzionale)..."
            className="text-[11px] min-h-[60px]"
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        {mode === "view" && (
          <>
            <Button
              size="sm"
              className="h-8 gap-1.5 px-3"
              disabled={busy}
              onClick={handleApprove}
            >
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              Approva
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 px-3"
              onClick={() => setMode("edit")}
            >
              <Edit3 className="h-3 w-3" />
              Modifica
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 px-3 text-destructive hover:text-destructive"
              onClick={() => setMode("reject")}
            >
              <X className="h-3 w-3" />
              Rifiuta
            </Button>
          </>
        )}

        {mode === "edit" && (
          <>
            <Button size="sm" className="h-8 gap-1.5" disabled={busy} onClick={handleEditApprove}>
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              Salva e approva
            </Button>
            <Button size="sm" variant="ghost" className="h-8" onClick={() => { setMode("view"); setEditContent(item.content); }}>
              Annulla
            </Button>
          </>
        )}

        {mode === "reject" && (
          <>
            <Button size="sm" variant="destructive" className="h-8 gap-1.5" disabled={busy} onClick={handleReject}>
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
              Conferma rifiuto
            </Button>
            <Button size="sm" variant="ghost" className="h-8" onClick={() => setMode("view")}>
              Annulla
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export default function SuggestionsReviewPage() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const { pending, approved, counts, loading, approve, reject, editApprove, refresh } =
    useSuggestedImprovements(userId, true);
  const harmonize = useHarmonizeOrchestrator(userId);
  const [runs, setRuns] = useState<HarmonizeRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);

  const refreshRuns = useCallback(async () => {
    if (!userId) return;
    setRunsLoading(true);
    try {
      const recent = await findRecentHarmonizeRuns(userId, 10);
      const withProposals = recent.filter((run) => run.proposals.length > 0);
      setRuns(withProposals);
      const selected = withProposals.find((run) => run.status === "review") ?? withProposals[0];
      if (selected && harmonize.state.phase !== "review") harmonize.loadRunForReview(selected);
    } catch {
      toast.error("Non riesco a caricare le armonizzazioni salvate.");
    } finally {
      setRunsLoading(false);
    }
  }, [userId, harmonize]);

  useEffect(() => {
    void refreshRuns();
  }, [refreshRuns]);

  const handleRefreshAll = useCallback(() => {
    refresh();
    void refreshRuns();
  }, [refresh, refreshRuns]);

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="ghost" className="h-7 px-2">
            <Link to="/v2/prompt-lab">
              <ArrowLeft className="mr-1 h-3.5 w-3.5" />
              Prompt Lab
            </Link>
          </Button>
          <span className="text-muted-foreground text-xs">/</span>
          <h1 className="text-sm font-semibold">Suggerimenti da approvare</h1>
          <Badge variant="default" className="ml-2">
            {counts.pending} pending
          </Badge>
          <Badge variant="secondary" className="ml-1">
            {counts.approved} approvati
          </Badge>
          <Badge variant="outline" className="ml-1">
            {counts.applied} applicati
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-7 gap-1" onClick={handleRefreshAll} disabled={loading || runsLoading}>
            {loading || runsLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            Aggiorna
          </Button>
          <Button asChild size="sm" variant="default" className="h-8 gap-1.5 px-4 font-semibold">
            <Link to="/v2/prompt-lab">
              <Sparkles className="h-4 w-4" />
              Migliora tutto
            </Link>
          </Button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4 max-w-4xl mx-auto">
          {harmonize.state.proposals.length > 0 && (
            <div className="rounded-lg border bg-muted/10 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold">Armonizzazione salvata nel DB</h2>
                  <p className="text-xs text-muted-foreground">
                    Run {harmonize.state.runId?.slice(0, 8)}… · {harmonize.state.proposals.length} proposte · applicate {harmonize.state.executedCount}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {runs.map((run) => (
                    <Button key={run.id} size="sm" variant={run.id === harmonize.state.runId ? "default" : "outline"} onClick={() => harmonize.loadRunForReview(run)}>
                      {run.proposals.length} · {run.id.slice(0, 4)}
                    </Button>
                  ))}
                </div>
              </div>
              <HarmonizeReviewPanel
                proposals={harmonize.state.proposals}
                approvedIds={harmonize.state.approvedIds}
                onToggle={harmonize.toggleApproval}
                onApproveAllSafe={harmonize.approveAllSafe}
              />
              <div className="flex items-center justify-between border-t pt-3">
                <span className="text-xs text-muted-foreground">{harmonize.state.approvedIds.size} proposte selezionate</span>
                <Button onClick={harmonize.execute} disabled={harmonize.state.approvedIds.size === 0 || harmonize.state.loading}>
                  {harmonize.state.loading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Check className="mr-1 h-3 w-3" />}
                  Salva nel DB
                </Button>
              </div>
            </div>
          )}

          {/* Info box */}
          {pending.length === 0 && approved.length === 0 && harmonize.state.proposals.length === 0 && !loading && !runsLoading && (
            <div className="rounded-lg border bg-muted/20 p-6 text-center">
              <BookmarkPlus className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium">Nessun suggerimento in attesa</p>
              <p className="text-xs text-muted-foreground mt-1">
                I suggerimenti arrivano quando gli utenti interagiscono con gli agenti AI
                e confermano proposte di nuove regole o modifiche.
              </p>
            </div>
          )}

          {/* Approved but not consumed */}
          {approved.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                  Approvati — in attesa dell'Architect ({approved.length})
                </h2>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Questi suggerimenti sono approvati ma non ancora consumati.
                Verranno iniettati nel contesto al prossimo "Migliora tutto".
              </p>
              {approved.map((item) => (
                <div key={item.id} className="rounded border bg-green-500/5 border-green-500/30 p-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] gap-1 border-green-500/40 text-green-700">
                      {typeIcon(item.suggestion_type)}
                      {typeLabel(item.suggestion_type)}
                    </Badge>
                    <span className="text-xs font-medium">{item.title}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
                    {item.content.slice(0, 200)}...
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Pending for review */}
          {pending.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Da approvare ({pending.length})
              </h2>
              {pending.map((item) => (
                <SuggestionCard
                  key={item.id}
                  item={item}
                  onApprove={approve}
                  onReject={reject}
                  onEditApprove={editApprove}
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
