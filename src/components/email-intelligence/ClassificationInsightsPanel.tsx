/**
 * Pannello "Proposte di apprendimento" — mostra gli insights pending generati
 * dal Refiner quando l'utente corregge un suggerimento AI di gruppo email.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Check, X, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { queryKeys } from "@/lib/queryKeys";
import {
  listClassificationInsights,
  rejectInsight,
  type ClassificationInsight,
} from "@/data/aiClassificationInsights";

export function ClassificationInsightsPanel() {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [openDetail, setOpenDetail] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const { data: insights = [], isLoading } = useQuery({
    queryKey: queryKeys.ai.classificationInsights("pending"),
    queryFn: () => listClassificationInsights("pending", 50),
    refetchInterval: 30_000,
  });

  const applyMut = useMutation({
    mutationFn: async (insight: ClassificationInsight) => {
      const overrideText = drafts[insight.id];
      await invokeEdge("apply-classification-insight", {
        body: { insight_id: insight.id, override_change_text: overrideText },
        context: "classification-insights-panel",
      });
    },
    onSuccess: () => {
      toast.success("Regola aggiornata");
      qc.invalidateQueries({ queryKey: queryKeys.ai.classificationInsights("pending") });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rejectMut = useMutation({
    mutationFn: (id: string) => rejectInsight(id),
    onSuccess: () => {
      toast.info("Proposta ignorata");
      qc.invalidateQueries({ queryKey: queryKeys.ai.classificationInsights("pending") });
    },
  });

  const count = insights.length;
  if (!isLoading && count === 0) return null;

  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardContent className="p-3 space-y-2">
        <button
          type="button"
          className="w-full flex items-center justify-between gap-2 text-left"
          onClick={() => setExpanded((v) => !v)}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Proposte di apprendimento AI</span>
            <Badge variant="secondary">{count}</Badge>
          </div>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {expanded && (
          <div className="space-y-2">
            {insights.map((ins) => {
              const isOpen = openDetail === ins.id;
              const draft = drafts[ins.id] ?? ins.proposed_change_text;
              return (
                <div key={ins.id} className="rounded border bg-background p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="text-sm">
                      <div className="font-medium text-foreground">{ins.trigger_address}</div>
                      <div className="text-xs text-foreground">
                        AI: <span className="line-through opacity-70">{ins.ai_suggested_group_name ?? "—"}</span>
                        {" → "}
                        <span className="font-semibold">{ins.user_chosen_group_name}</span>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {ins.proposed_target === "group" ? "Hint gruppo" : "Prompt operativo"} ·{" "}
                      {Math.round((ins.confidence ?? 0) * 100)}%
                    </Badge>
                  </div>

                  <Textarea
                    value={draft}
                    onChange={(e) => setDrafts((d) => ({ ...d, [ins.id]: e.target.value }))}
                    rows={2}
                    className="text-sm"
                  />

                  {ins.reasoning && (
                    <button
                      type="button"
                      onClick={() => setOpenDetail(isOpen ? null : ins.id)}
                      className="text-xs text-muted-foreground hover:underline"
                    >
                      {isOpen ? "Nascondi motivazione" : "Mostra motivazione AI"}
                    </button>
                  )}
                  {isOpen && ins.reasoning && (
                    <div className="text-xs text-foreground/80 bg-muted/40 rounded p-2 whitespace-pre-wrap">
                      {ins.reasoning}
                    </div>
                  )}

                  <div className="flex items-center gap-2 justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => rejectMut.mutate(ins.id)}
                      disabled={rejectMut.isPending}
                    >
                      <X className="h-3.5 w-3.5 mr-1" /> Ignora
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => applyMut.mutate(ins)}
                      disabled={applyMut.isPending || !draft.trim()}
                    >
                      {applyMut.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5 mr-1" />
                      )}
                      Applica
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}