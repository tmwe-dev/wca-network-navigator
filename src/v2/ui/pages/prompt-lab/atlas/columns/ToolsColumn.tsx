/**
 * ToolsColumn — Tool platform a cui l'agente ha accesso.
 */
import { Wrench } from "lucide-react";
import type { AgentRegistryEntry } from "@/data/agentPrompts";
import { Badge } from "@/components/ui/badge";

export function ToolsColumn({ agent }: { agent: AgentRegistryEntry }) {
  return (
    <section className="bg-card rounded-lg border">
      <header className="flex items-center gap-1.5 border-b px-3 py-2">
        <Wrench className="text-muted-foreground h-3.5 w-3.5" />
        <h3 className="text-xs font-semibold">Tool disponibili ({agent.tools.length})</h3>
      </header>
      <div className="px-3 py-2.5">
        {agent.tools.length === 0 ? (
          <p className="text-muted-foreground text-[11px] italic">
            Agente puro (nessun tool — produce solo output testuale).
          </p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {agent.tools.map((t) => (
              <Badge key={t} variant="outline" className="font-mono text-[10px]">{t}</Badge>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
