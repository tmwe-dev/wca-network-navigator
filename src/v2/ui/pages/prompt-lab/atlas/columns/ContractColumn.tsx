/**
 * ContractColumn — Contratto I/O dell'agente (input/output).
 * Il Lab Agent in modalità Architect (Fase 4-5) usa questi dati per
 * proporre nuovi backend contracts (es. EmailBrief, VoiceBrief).
 */
import { Network } from "lucide-react";
import type { AgentRegistryEntry } from "@/data/agentPrompts";

export function ContractColumn({ agent }: { agent: AgentRegistryEntry }) {
  return (
    <section className="bg-card rounded-lg border">
      <header className="flex items-center gap-1.5 border-b px-3 py-2">
        <Network className="text-muted-foreground h-3.5 w-3.5" />
        <h3 className="text-xs font-semibold">Contratto runtime</h3>
      </header>
      <div className="space-y-2 px-3 py-2.5 text-[11px]">
        <div>
          <p className="text-muted-foreground mb-0.5 text-[10px] uppercase tracking-wider">Input</p>
          <pre className="bg-muted overflow-auto rounded p-2 text-[10px] leading-snug">{agent.contract.input}</pre>
        </div>
        <div>
          <p className="text-muted-foreground mb-0.5 text-[10px] uppercase tracking-wider">Output</p>
          <pre className="bg-muted overflow-auto rounded p-2 text-[10px] leading-snug">{agent.contract.output}</pre>
        </div>
      </div>
    </section>
  );
}
