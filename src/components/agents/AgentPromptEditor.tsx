import { useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";
import { useAgents, type Agent } from "@/hooks/useAgents";
import { toast } from "sonner";

interface Props {
  agent: Agent;
}

export function AgentPromptEditor({ agent }: Props) {
  const [prompt, setPrompt] = useState(agent.system_prompt);
  const { updateAgent } = useAgents();
  const isDirty = prompt !== agent.system_prompt;

  useEffect(() => setPrompt(agent.system_prompt), [agent.id, agent.system_prompt]);

  const save = () => {
    updateAgent.mutate(
      { id: agent.id, system_prompt: prompt },
      { onSuccess: () => toast.success("Prompt salvato") }
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">System Prompt</h3>
        {isDirty && (
          <Button size="sm" onClick={save} disabled={updateAgent.isPending}>
            <Save className="w-3.5 h-3.5 mr-1" /> Salva
          </Button>
        )}
      </div>
      <Textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        className="min-h-[300px] font-mono text-xs bg-background/50"
        placeholder="Istruzioni per l'agente..."
      />
      <p className="text-xs text-muted-foreground">{prompt.length} caratteri</p>
    </div>
  );
}
