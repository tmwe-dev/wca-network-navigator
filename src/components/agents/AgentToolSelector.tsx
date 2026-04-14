import { useState, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";
import { AVAILABLE_TOOLS } from "@/data/agentTemplates";
import { useAgents, type Agent } from "@/hooks/useAgents";
import { toast } from "sonner";

interface Props {
  agent: Agent;
}

export function AgentToolSelector({ agent }: Props) {
  const [selected, setSelected] = useState<string[]>(agent.assigned_tools || []);
  const { updateAgent } = useAgents();
  const isDirty = JSON.stringify(selected.sort()) !== JSON.stringify([...(agent.assigned_tools || [])].sort());

  useEffect(() => setSelected(agent.assigned_tools || []), [agent.id, agent.assigned_tools]);

  const toggle = (name: string) =>
    setSelected((prev) => (prev.includes(name) ? prev.filter((t) => t !== name) : [...prev, name]));

  const save = () => {
    updateAgent.mutate(
      { id: agent.id, assigned_tools: selected } as Record<string, unknown>,
      { onSuccess: () => toast.success("Tool aggiornati") }
    );
  };

  const categories = [...new Set(AVAILABLE_TOOLS.map((t) => t.category))];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Tool Assegnati ({selected.length})</h3>
        {isDirty && (
          <Button size="sm" onClick={save}>
            <Save className="w-3.5 h-3.5 mr-1" /> Salva
          </Button>
        )}
      </div>
      {categories.map((cat) => (
        <div key={cat}>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">{cat}</p>
          <div className="grid grid-cols-2 gap-1.5">
            {AVAILABLE_TOOLS.filter((t) => t.category === cat).map((tool) => (
              <label
                key={tool.name}
                className="flex items-center gap-2 p-2 rounded-md hover:bg-accent/30 cursor-pointer text-xs"
              >
                <Checkbox
                  checked={selected.includes(tool.name)}
                  onCheckedChange={() => toggle(tool.name)}
                />
                <span>{tool.label}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
