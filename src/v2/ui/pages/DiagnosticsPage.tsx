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
import { PageShell } from "@/v2/ui/templates/PageShell";

export function DiagnosticsPage() {
  const isAdmin = useRequireRole({ role: "admin" });
  const { results, running, expandedCats, categories, summary, runAll, abort, toggleCat, byCat } = useDiagnosticsRunner();

  if (!isAdmin) {
    return (
      <PageShell title="Diagnostica Sistema">
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          Accesso riservato agli amministratori.
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      testId="page-diagnostics"
      width="default"
      title="Diagnostica Sistema"
      description="Test completo di infrastruttura, database, edge functions e integrità dati"
      actions={
        <>
          {running && (
            <Button variant="outline" size="sm" onClick={abort}>Stop</Button>
          )}
          <Button onClick={runAll} disabled={running} size="sm" className="gap-2">
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {running ? "In esecuzione…" : "Avvia tutti i test"}
          </Button>
        </>
      }
    >
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
        <div className="rounded-xl border border-dashed border-border bg-card/40 py-16 text-center text-muted-foreground">
          <p className="text-sm">Premi "Avvia tutti i test" per iniziare la diagnostica completa</p>
        </div>
      )}
      <ErrorLogPanel />
    </PageShell>
  );
}
