/**
 * KBColumn — KB categories caricate a runtime + procedure critiche iniettate.
 */
import { BookOpen } from "lucide-react";
import type { AgentRegistryEntry } from "@/data/agentPrompts";
import { Badge } from "@/components/ui/badge";

export function KBColumn({ agent }: { agent: AgentRegistryEntry }) {
  return (
    <section className="bg-card rounded-lg border">
      <header className="flex items-center gap-1.5 border-b px-3 py-2">
        <BookOpen className="text-muted-foreground h-3.5 w-3.5" />
        <h3 className="text-xs font-semibold">KB consultate a runtime</h3>
      </header>
      <div className="space-y-3 px-3 py-2.5">
        <div>
          <p className="text-muted-foreground text-[10px] uppercase tracking-wider">Categories</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {agent.kbCategories.length === 0 && (
              <span className="text-muted-foreground text-[11px] italic">nessuna</span>
            )}
            {agent.kbCategories.map((c) => (
              <Badge key={c} variant="secondary" className="text-[10px]">{c}</Badge>
            ))}
          </div>
        </div>
        <div>
          <p className="text-muted-foreground text-[10px] uppercase tracking-wider">
            Procedure critiche iniettate
          </p>
          <ul className="mt-1 space-y-0.5">
            {agent.criticalProcedures.length === 0 && (
              <li className="text-muted-foreground text-[11px] italic">nessuna</li>
            )}
            {agent.criticalProcedures.map((p, i) => (
              <li key={i} className="text-[11px] leading-snug">· {p}</li>
            ))}
          </ul>
        </div>
        {agent.requiredVars.length > 0 && (
          <div>
            <p className="text-muted-foreground text-[10px] uppercase tracking-wider">
              Variabili richieste
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              {agent.requiredVars.map((v) => (
                <code key={v} className="bg-muted rounded px-1 py-0.5 text-[10px]">{v}</code>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
