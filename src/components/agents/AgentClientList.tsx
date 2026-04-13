import { useAgentClients } from "@/hooks/useClientAssignments";
import { Users } from "lucide-react";
import type { Agent } from "@/hooks/useAgents";

interface Props {
  agent: Agent;
}

export function AgentClientList({ agent }: Props) {
  const { data: clients, isLoading } = useAgentClients(agent.id);

  if (isLoading) {
    return <div className="p-4 text-xs text-muted-foreground">Caricamento...</div>;
  }

  if (!clients || clients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
        <Users className="w-8 h-8 text-muted-foreground/40" />
        <p className="text-xs text-muted-foreground">Nessun cliente assegnato</p>
        <p className="text-[10px] text-muted-foreground/60">I clienti verranno assegnati automaticamente alla prima attività</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 py-2">
      <p className="text-xs text-muted-foreground px-1 mb-2">{clients.length} clienti assegnati</p>
      {clients.map((c) => {
        const _meta = (c as any).source_meta;
        return (
          <div
            key={c.id}
            className="flex items-center justify-between p-2 rounded-lg bg-card/50 border border-border/30 text-xs"
          >
            <div className="min-w-0">
              <span className="font-medium text-foreground truncate block">
                {c.source_type === "partner" ? "Partner" : c.source_type === "prospect" ? "Prospect" : "Contatto"} 
              </span>
              <span className="text-[10px] text-muted-foreground">{c.source_type} · {new Date(c.assigned_at).toLocaleDateString("it-IT")}</span>
            </div>
            <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
              Attivo
            </span>
          </div>
        );
      })}
    </div>
  );
}
