/**
 * Diagnostics — orchestrator (refactored from 532-line monolith)
 */
import { Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDiagnosticsRunner } from "@/hooks/useDiagnosticsRunner";
import { DiagnosticsSummaryBar } from "@/components/diagnostics/DiagnosticsSummaryBar";
import { DiagnosticsCategoryCard } from "@/components/diagnostics/DiagnosticsCategoryCard";
import { ErrorLogPanel } from "@/components/diagnostics/ErrorLogPanel";

export default function Diagnostics() {
  const { results, running, expandedCats, categories, summary, runAll, abort, toggleCat, byCat } = useDiagnosticsRunner();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">🔬 Diagnostica Sistema</h1>
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

      {/* Error Log Section */}
      <ErrorLogPanel />
    </div>
  );
}
