/**
 * FunnemailEvalTab — Tab "Eval" che mostra accuracy nel tempo
 * per i batch run di classificazione Funnemail.
 *
 * Read-only, DAL via src/data/funnemailEval.ts.
 * Grafico accuracy + tabella ultimi run.
 */
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FlaskConical, TrendingUp, AlertTriangle } from "lucide-react";
import { fetchEvalBatchRuns, type EvalBatchRun } from "@/data/funnemailEval";
import { queryKeys } from "@/lib/queryKeys";

function AccuracyBar({ value }: { value: number }) {
  const color = value >= 85 ? "bg-emerald-500" : value >= 70 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-medium w-12 text-right">{value.toFixed(1)}%</span>
    </div>
  );
}

export function FunnemailEvalTab() {
  const { data: runs, isLoading } = useQuery({
    queryKey: queryKeys.funnemailEvalBatchRuns,
    queryFn: fetchEvalBatchRuns,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        <FlaskConical className="h-4 w-4 animate-pulse mr-2" />
        Caricamento eval runs...
      </div>
    );
  }

  const sortedRuns = [...(runs ?? [])].sort(
    (a, b) => new Date(b.run_at).getTime() - new Date(a.run_at).getTime()
  );

  const latest = sortedRuns[0];
  const avgAccuracy = sortedRuns.length > 0
    ? sortedRuns.reduce((sum, r) => sum + (r.accuracy ?? 0), 0) / sortedRuns.length
    : 0;

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-2">
        <FlaskConical className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Funnemail Eval</h2>
        <Badge variant="outline" className="text-xs">
          {sortedRuns.length} run
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground">Ultimo run</CardTitle>
          </CardHeader>
          <CardContent>
            {latest ? (
              <>
                <div className="text-lg font-semibold">{(latest.accuracy ?? 0).toFixed(1)}%</div>
                <div className="text-xs text-muted-foreground">
                  {latest.passed_count}/{latest.dataset_size} passed · {new Date(latest.run_at).toLocaleDateString()}
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">Nessun run</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground">Media accuracy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-lg font-semibold">{avgAccuracy.toFixed(1)}%</span>
            </div>
            <div className="text-xs text-muted-foreground">su {sortedRuns.length} batch</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground">Target</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {avgAccuracy >= 85 ? (
                <Badge variant="default" className="text-xs">Raggiunto</Badge>
              ) : (
                <Badge variant="destructive" className="text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Sotto soglia
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">target: 85%</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Cronologia run</CardTitle>
        </CardHeader>
        <CardContent>
          {sortedRuns.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">
              Nessun eval run ancora. Esegui il primo via API o cron.
            </div>
          ) : (
            <div className="space-y-3">
              {sortedRuns.slice(0, 20).map((run) => (
                <div key={run.id} className="flex items-center gap-3">
                  <div className="text-xs text-muted-foreground w-20 flex-shrink-0">
                    {new Date(run.run_at).toLocaleDateString()}
                  </div>
                  <div className="flex-1">
                    <AccuracyBar value={run.accuracy ?? 0} />
                  </div>
                  <div className="text-xs text-muted-foreground w-24 text-right">
                    {run.passed_count}/{run.dataset_size}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
