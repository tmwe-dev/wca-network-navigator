import { Check } from "lucide-react";
import type { MissionStepProps } from "./types";

export function AgentStep({ data, onChange, agentsList }: MissionStepProps) {
  const agents = agentsList || [];
  const assigned = data.agents || [];

  const toggleAgent = (agent: typeof agents[0]) => {
    const exists = assigned.find(a => a.agentId === agent.id);
    if (exists) {
      onChange({ ...data, agents: assigned.filter(a => a.agentId !== agent.id) });
    } else {
      onChange({ ...data, agents: [...assigned, { agentId: agent.id, agentName: agent.name, countries: agent.territories }] });
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Seleziona gli agenti AI da coinvolgere:</p>
      {agents.length === 0 && <p className="text-xs text-muted-foreground italic">Nessun agente configurato. Vai su Agenti per crearne.</p>}
      <div className="space-y-2">
        {agents.map(a => {
          const isActive = assigned.some(x => x.agentId === a.id);
          return (
            <button key={a.id} onClick={() => toggleAgent(a)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${isActive ? "bg-primary/10 border-primary" : "bg-muted/30 border-border hover:border-primary/50"}`}>
              <span className="text-xl">{a.emoji}</span>
              <div className="flex-1">
                <div className="text-sm font-medium">{a.name}</div>
                <div className="text-xs text-muted-foreground">{a.territories.length > 0 ? `Territori: ${a.territories.join(", ")}` : "Nessun territorio"}</div>
              </div>
              {isActive && <Check className="w-4 h-4 text-primary" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
