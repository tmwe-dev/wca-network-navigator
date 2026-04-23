/**
 * ArchitectReviewPanel — Lab Agent Architect dentro Agent Atlas (Fase 4-5).
 *
 * Mostra un toggle Standard ↔ Architect e un pulsante "Analizza con Architect"
 * che invoca `useLabAgent.analyzeBlockArchitect` passando l'agente selezionato:
 * il prompt al modello include allora la PROCEDURA Architect (KB isolata) e
 * i CONTRATTI runtime (input/output dell'agente), così il report può proporre
 * `move-to-contract` con la firma del nuovo backend contract.
 *
 * Nota: questo pannello costruisce un "blocco sintetico" per agente
 * (concatena display name + descrizione + prompt sources) per dare al modello
 * un materiale unitario su cui ragionare. È una review a livello agente, non
 * a livello singolo blocco — quella resta nelle tab Prompt Lab esistenti.
 */
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Wrench, AlertTriangle, ArrowRight } from "lucide-react";
import type { AgentRegistryEntry } from "@/data/agentPrompts";
import { useLabAgent } from "../hooks/useLabAgent";
import type {
  ArchitectDiagnostic,
  DiagnosticDestination,
  DiagnosticSeverity,
} from "../hooks/diagnostics";
import type { Block } from "../types";

function severityClass(s: DiagnosticSeverity): string {
  switch (s) {
    case "critical": return "bg-destructive/15 text-destructive border-destructive/40";
    case "high": return "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/40";
    case "medium": return "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40";
    case "low": return "bg-muted text-muted-foreground border-border";
  }
}

function destinationLabel(d: DiagnosticDestination): string {
  if (typeof d === "string") return d;
  return `merge-with: ${d.targetBlockId}`;
}

/** Costruisce un blocco "sintetico" di agente per dare materiale unitario al modello. */
function buildAgentBlock(agent: AgentRegistryEntry): Block {
  const lines: string[] = [
    `# ${agent.displayName} (${agent.id})`,
    `Categoria: ${agent.category}`,
    `Descrizione: ${agent.description}`,
    "",
    `## Runtime`,
    `Edge function: ${agent.runtime.edgeFunction}`,
    `Modello: ${agent.runtime.modelDefault}`,
    `Trigger: ${agent.runtime.triggers.join(" • ")}`,
    "",
    `## Prompt sources mappati`,
    ...agent.promptSources.map((ps) => `- ${ps.label} → ${ps.source}`),
    "",
    `## KB categories assemblate`,
    `- ${agent.kbCategories.join(", ") || "(nessuna)"}`,
    "",
    `## Procedure critiche dichiarate`,
    ...agent.criticalProcedures.map((p) => `- ${p}`),
    "",
    `## Tools disponibili`,
    `- ${agent.tools.join(", ") || "(nessuno)"}`,
  ];
  return {
    id: `atlas-agent:${agent.id}`,
    label: `Agente ${agent.displayName}`,
    content: lines.join("\n"),
    source: { kind: "ephemeral" },
  };
}

export function ArchitectReviewPanel({ agent }: { agent: AgentRegistryEntry }) {
  const lab = useLabAgent();
  const [loading, setLoading] = useState(false);
  const [diagnostics, setDiagnostics] = useState<ArchitectDiagnostic[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const block = useMemo(() => buildAgentBlock(agent), [agent]);

  async function runAnalysis() {
    setLoading(true);
    setError(null);
    setDiagnostics(null);
    try {
      // Forza modalità architect per questa specifica analisi (anche se l'utente
      // ha lasciato il toggle su standard, qui il pulsante è esplicitamente Architect).
      if (lab.mode !== "architect") lab.setMode("architect");
      const out = await lab.analyzeBlockArchitect({
        block,
        tabLabel: "Atlas — Agent Review",
        tabActivation: agent.runtime.edgeFunction,
        agent,
        goal: `Verifica se i prompt e le KB di ${agent.displayName} sono al posto giusto, se duplicano altri agenti, se il contratto I/O ha gap.`,
      });
      setDiagnostics(out);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Errore Architect Review");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="bg-card rounded-lg border">
      <header className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Wrench className="text-muted-foreground h-3.5 w-3.5" />
          <h3 className="text-xs font-semibold">Architect Review</h3>
          <span
            className={`ml-1 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
              lab.mode === "architect"
                ? "bg-accent text-accent-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {lab.mode}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[10px]"
            onClick={() => lab.setMode(lab.mode === "architect" ? "standard" : "architect")}
            title="Toggle Standard ↔ Architect"
          >
            Toggle
          </Button>
          <Button
            size="sm"
            className="h-7 px-2 text-[11px]"
            disabled={loading}
            onClick={runAnalysis}
          >
            {loading ? (
              <>
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                Analisi…
              </>
            ) : (
              <>
                <Wrench className="mr-1 h-3 w-3" />
                Analizza con Architect
              </>
            )}
          </Button>
        </div>
      </header>

      <div className="space-y-2 px-3 py-2.5 text-[11px]">
        {!diagnostics && !error && !loading && (
          <p className="text-muted-foreground italic">
            Premi <strong>Analizza con Architect</strong> per ricevere una diagnosi strutturata
            (severity · why · destination · proposal · test) sui prompt e contratti di questo agente.
          </p>
        )}
        {error && (
          <div className="text-destructive flex items-start gap-1.5 rounded border border-destructive/30 bg-destructive/10 p-2">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {diagnostics?.map((d, i) => (
          <article key={i} className={`rounded border p-2 ${severityClass(d.severity)}`}>
            <div className="mb-1 flex items-center gap-2">
              <span className="text-[9px] font-bold uppercase tracking-wider">
                {d.severity}
              </span>
              {d.blockId && (
                <span className="text-[9px] opacity-70">block: {d.blockId}</span>
              )}
              <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-medium">
                <ArrowRight className="h-3 w-3" />
                {destinationLabel(d.destination)}
              </span>
            </div>
            <p className="mb-1 text-[11px] leading-snug">{d.why}</p>
            {d.proposal && (
              <details className="mt-1">
                <summary className="cursor-pointer text-[10px] font-medium opacity-80">
                  Proposta
                </summary>
                <pre className="bg-background/60 mt-1 overflow-auto rounded p-1.5 text-[10px] leading-snug">
                  {d.proposal}
                </pre>
              </details>
            )}
            {d.test && (
              <details className="mt-1">
                <summary className="cursor-pointer text-[10px] font-medium opacity-80">
                  Test di verifica
                </summary>
                <p className="mt-1 text-[10px] leading-snug opacity-90">{d.test}</p>
              </details>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}