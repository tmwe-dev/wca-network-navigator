/**
 * DiagnosticsPage V2 — Standalone V1 content migration (NO wrapper)
 */
import { Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDiagnosticsRunner } from "@/hooks/useDiagnosticsRunner";
import { DiagnosticsSummaryBar } from "@/components/diagnostics/DiagnosticsSummaryBar";
import { DiagnosticsCategoryCard } from "@/components/diagnostics/DiagnosticsCategoryCard";
import { ErrorLogPanel } from "@/components/diagnostics/ErrorLogPanel";
import { SystemHealthPanel } from "@/components/diagnostics/SystemHealthPanel";
import { useRequireRole } from "@/v2/hooks/useRequireRole";

export function DiagnosticsPage() {
  const isAdmin = useRequireRole({ role: "admin" });

  if (!isAdmin) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Accesso riservato agli amministratori.
      </div>
    );
  }

  const { results, running, expandedCats, categories, summary, runAll, abort, toggleCat, byCat } = useDiagnosticsRunner();

  return (
    <div data-testid="page-diagnostics" className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Diagnostica Sistema</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Test completo di infrastruttura, database, edge functions e integrità dati
          </p>
        </div>
        <div className="flex gap-2">
          {running && (
            <Button variant="outline" size="sm" onClick={abort}>Stop</Button>
          )}
          <Button onClick={runAll} disabled={running} size="sm" className="gap-2">
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {running ? "In esecuzione…" : "Avvia tutti i test"}
          </Button>
        </div>
      </div>

      <SystemHealthPanel />

      <DiagnosticsSummaryBar summary={summary} visible={results.length > 0} />

      {categories.map(cat => (
        <DiagnosticsCategoryCard
          key={cat}
          category={cat}
          items={byCat(cat)}
          expanded={expandedCats.has(cat)}
          onToggle={() => toggleCat(cat)}
        />
      ))}

      {results.length === 0 && !running && (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-lg">Premi "Avvia tutti i test" per iniziare la diagnostica completa</p>
        </div>
      )}

      <ErrorLogPanel />
    </div>
  );
}
