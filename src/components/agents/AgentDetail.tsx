import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Trash2 } from "lucide-react";
import type { Agent } from "@/hooks/useAgents";
import { useAgents } from "@/hooks/useAgents";
import { AgentPromptEditor } from "./AgentPromptEditor";
import { AgentToolSelector } from "./AgentToolSelector";
import { AgentKnowledgeBase } from "./AgentKnowledgeBase";
import { AgentClientList } from "./AgentClientList";
import { AgentTaskList } from "./AgentTaskList";
import { AgentVoiceConfig } from "./AgentVoiceConfig";
import { AgentSignatureConfig } from "./AgentSignatureConfig";
import { AgentTerritoryConfig } from "./AgentTerritoryConfig";
import { AgentChat } from "./AgentChat";
import { AGENT_ROLES } from "@/data/agentTemplates";
import { toast } from "sonner";

interface Props {
  agent: Agent;
  onDeleted: () => void;
}

export function AgentDetail({ agent, onDeleted }: Props) {
  const { updateAgent, deleteAgent } = useAgents();
  const roleMeta = AGENT_ROLES.find((r) => r.value === agent.role);

  const toggleActive = () => {
    updateAgent.mutate(
      { id: agent.id, is_active: !agent.is_active },
      { onSuccess: () => toast.success(agent.is_active ? "Agente disattivato" : "Agente attivato") }
    );
  };

  const handleDelete = () => {
    if (!confirm(`Eliminare l'agente "${agent.name}"? Tutti i compiti associati verranno rimossi.`)) return;
    deleteAgent.mutate(agent.id, { onSuccess: () => { toast.success("Agente eliminato"); onDeleted(); } });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{agent.avatar_emoji}</span>
          <div>
            <h2 className="text-lg font-bold">{agent.name}</h2>
            <span className={`text-xs ${roleMeta?.color || "text-muted-foreground"}`}>
              {roleMeta?.label || agent.role}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-xs text-muted-foreground">{agent.is_active ? "Attivo" : "Inattivo"}</span>
            <Switch checked={agent.is_active} onCheckedChange={toggleActive} />
          </div>
          <Button size="icon" variant="ghost" onClick={handleDelete} aria-label="Elimina">
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Task completati", value: agent.stats?.tasks_completed ?? 0 },
          { label: "Email inviate", value: agent.stats?.emails_sent ?? 0 },
          { label: "Chiamate", value: agent.stats?.calls_made ?? 0 },
        ].map((s) => (
          <div key={s.label} className="text-center p-3 rounded-lg bg-card/50 border border-border/30">
            <p className="text-xl font-bold">{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="chat" className="w-full">
        <TabsList className="w-full grid grid-cols-9 h-9">
          <TabsTrigger value="chat" className="text-xs">Chat</TabsTrigger>
          <TabsTrigger value="clients" className="text-xs">Clienti</TabsTrigger>
          <TabsTrigger value="tasks" className="text-xs">Compiti</TabsTrigger>
          <TabsTrigger value="zones" className="text-xs">Zone</TabsTrigger>
          <TabsTrigger value="prompt" className="text-xs">Prompt</TabsTrigger>
          <TabsTrigger value="tools" className="text-xs">Tool</TabsTrigger>
          <TabsTrigger value="kb" className="text-xs">KB</TabsTrigger>
          <TabsTrigger value="signature" className="text-xs">Firma</TabsTrigger>
          <TabsTrigger value="voice" className="text-xs">Voce</TabsTrigger>
        </TabsList>
        <TabsContent value="chat"><AgentChat agent={agent} /></TabsContent>
        <TabsContent value="clients"><AgentClientList agent={agent} /></TabsContent>
        <TabsContent value="tasks"><AgentTaskList agent={agent} /></TabsContent>
        <TabsContent value="zones"><AgentTerritoryConfig agent={agent} /></TabsContent>
        <TabsContent value="prompt"><AgentPromptEditor agent={agent} /></TabsContent>
        <TabsContent value="tools"><AgentToolSelector agent={agent} /></TabsContent>
        <TabsContent value="kb"><AgentKnowledgeBase agent={agent} /></TabsContent>
        <TabsContent value="signature"><AgentSignatureConfig agent={agent} /></TabsContent>
        <TabsContent value="voice"><AgentVoiceConfig agent={agent} /></TabsContent>
      </Tabs>
    </div>
  );
}
