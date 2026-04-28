/**
 * RunHistoryPanel — Visualizza lo storico dei run "Migliora tutto" con diff visivi.
 * Mostra gli ultimi 5 run con la possibilità di espandere per vedere i dettagli.
 */
import { useEffect, useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/providers/AuthProvider";
import { findLastRuns, type GlobalRun, type GlobalRunProposal } from "@/data/promptLabGlobalRuns";
import { CheckCircle2, AlertCircle, FileText, Clock, ChevronDown, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { it as itLocale } from "date-fns/locale";


import { createLogger } from "@/lib/log";
const log = createLogger("RunHistoryPanel");
export function RunHistoryPanel() {
  const { user } = useAuth();
  const [runs, setRuns] = useState<GlobalRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    const loadRuns = async () => {
      try {
        setLoading(true);
        const data = await findLastRuns(user.id, 5);
        setRuns(data);
      } catch (err) {
        log.error("Errore caricamento storico run:", { error: err });
      } finally {
        setLoading(false);
      }
    };

    loadRuns();
  }, [user?.id]);

  const getStatusBadgeVariant = (status: GlobalRun["status"]) => {
    if (status === "done" || status === "review") return "default";
    if (status === "failed" || status === "cancelled") return "destructive";
    return "secondary";
  };

  const getStatusLabel = (status: GlobalRun["status"]) => {
    const labels: Record<GlobalRun["status"], string> = {
      collecting: "Raccolta...",
      improving: "Miglioramento...",
      review: "In revisione",
      saving: "Salvataggio...",
      done: "Completato",
      failed: "Fallito",
      cancelled: "Cancellato",
    };
    return labels[status];
  };

  const truncateGoal = (goal: string, maxLength: number = 50) => {
    if (!goal) return "(nessun obiettivo)";
    return goal.length > maxLength ? goal.substring(0, maxLength) + "..." : goal;
  };

  const readyProposals = (proposals: GlobalRunProposal[]) => proposals.filter((p) => p.status === "ready").length;
  const savedProposals = (proposals: GlobalRunProposal[]) => proposals.filter((p) => p.status === "saved").length;
  const errorProposals = (proposals: GlobalRunProposal[]) => proposals.filter((p) => p.status === "error").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        Nessuno storico ancora. Avvia un'analisi globale con "Migliora tutto".
      </div>
    );
  }

  return (
    <ScrollArea className="h-full w-full">
      <div className="p-4 space-y-2">
        {runs.map((run) => (
          <Collapsible
            key={run.id}
            open={expandedRunId === run.id}
            onOpenChange={(open) => setExpandedRunId(open ? run.id : null)}
            className="border rounded-lg"
          >
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-between h-auto p-3 hover:bg-muted/50"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium truncate">{truncateGoal(run.goal)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(run.updated_at), { addSuffix: true, locale: itLocale })}
                    </p>
                  </div>
                  <Badge variant={getStatusBadgeVariant(run.status)} className="text-xs flex-shrink-0">
                    {getStatusLabel(run.status)}
                  </Badge>
                  <Badge variant="outline" className="text-xs flex-shrink-0">
                    {run.proposals.length} proposte
                  </Badge>
                </div>
                <ChevronDown className={`h-4 w-4 ml-2 transition-transform flex-shrink-0 ${expandedRunId === run.id ? "rotate-180" : ""}`} />
              </Button>
            </CollapsibleTrigger>

            <CollapsibleContent className="border-t bg-muted/20">
              <div className="p-3 space-y-3">
                {/* Riepilogo proposte */}
                <div className="flex flex-wrap gap-2">
                  {savedProposals(run.proposals) > 0 && (
                    <Badge variant="outline" className="gap-1 text-green-700 border-green-500">
                      <CheckCircle2 className="h-3 w-3" />
                      {savedProposals(run.proposals)} salvate
                    </Badge>
                  )}
                  {readyProposals(run.proposals) > 0 && (
                    <Badge variant="outline" className="gap-1">
                      <FileText className="h-3 w-3" />
                      {readyProposals(run.proposals)} pronte
                    </Badge>
                  )}
                  {errorProposals(run.proposals) > 0 && (
                    <Badge variant="outline" className="gap-1 text-red-700 border-red-500">
                      <AlertCircle className="h-3 w-3" />
                      {errorProposals(run.proposals)} errori
                    </Badge>
                  )}
                  {run.proposals.filter((p) => p.status === "skipped").length > 0 && (
                    <Badge variant="outline" className="gap-1 text-muted-foreground">
                      {run.proposals.filter((p) => p.status === "skipped").length} già ottimi
                    </Badge>
                  )}
                </div>

                <Separator className="my-2" />

                {/* Lista proposte con diff */}
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {run.proposals.map((proposal, idx) => {
                    const isSaved = proposal.status === "saved";
                    const isReady = proposal.status === "ready";
                    const isError = proposal.status === "error";
                    const isSkipped = proposal.status === "skipped";

                    return (
                      <div
                        key={`${run.id}-${proposal.block_id}-${idx}`}
                        className={`rounded border p-2 text-sm ${
                          isSaved ? "bg-green-50/50 border-green-200" :
                          isError ? "bg-red-50/50 border-red-200" :
                          isSkipped ? "bg-gray-50/50 border-gray-200 opacity-60" :
                          "bg-background border-border"
                        }`}
                      >
                        <div className="flex items-start gap-2 mb-1.5">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                {proposal.tab_label}
                              </Badge>
                              <span className="text-xs font-medium">{proposal.label}</span>
                              {isSaved && (
                                <Badge variant="default" className="bg-green-600 text-white text-[10px]">
                                  Salvato
                                </Badge>
                              )}
                              {isError && (
                                <Badge variant="destructive" className="text-[10px]">
                                  Errore
                                </Badge>
                              )}
                              {isSkipped && (
                                <Badge variant="secondary" className="text-[10px]">
                                  Già ottimo
                                </Badge>
                              )}
                            </div>
                            {proposal.tab_activation && (
                              <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                                <span className="font-medium">Runtime:</span> {proposal.tab_activation}
                              </p>
                            )}
                          </div>
                        </div>

                        {isError && (
                          <p className="text-xs text-destructive mt-1">{proposal.error}</p>
                        )}

                        {(isReady || isSaved) && proposal.after && (
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            <div>
                              <p className="text-[10px] font-medium text-muted-foreground mb-1">Prima</p>
                              <pre className="text-[10px] font-mono bg-muted/40 rounded p-1.5 max-h-24 overflow-auto whitespace-pre-wrap break-words">
                                {proposal.before || "(vuoto)"}
                              </pre>
                            </div>
                            <div>
                              <p className="text-[10px] font-medium text-green-700 mb-1">Dopo</p>
                              <pre className="text-[10px] font-mono bg-green-50 rounded p-1.5 max-h-24 overflow-auto whitespace-pre-wrap break-words">
                                {proposal.after}
                              </pre>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    </ScrollArea>
  );
}
