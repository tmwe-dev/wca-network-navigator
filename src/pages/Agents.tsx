import { useState } from "react";
import { motion } from "framer-motion";
import { Bot, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAgents } from "@/hooks/useAgents";
import { AgentCard } from "@/components/agents/AgentCard";
import { AgentDetail } from "@/components/agents/AgentDetail";
import { CreateAgentDialog } from "@/components/agents/CreateAgentDialog";

export default function Agents() {
  const { agents, isLoading } = useAgents();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const selected = agents.find((a) => a.id === selectedId) || null;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Sidebar — Agent List */}
      <div className="w-[280px] flex-shrink-0 border-r border-border/50 flex flex-col bg-card/20">
        <div className="flex items-center justify-between p-3 border-b border-border/30">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-primary" />
            <h1 className="text-sm font-bold">Agenti</h1>
            <span className="text-xs text-muted-foreground">({agents.length})</span>
          </div>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {isLoading ? (
            <p className="text-xs text-muted-foreground text-center py-8">Caricamento...</p>
          ) : agents.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <Bot className="w-10 h-10 text-muted-foreground mx-auto" />
              <p className="text-xs text-muted-foreground">Nessun agente creato</p>
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Crea il primo agente
              </Button>
            </div>
          ) : (
            agents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                isSelected={selectedId === agent.id}
                onClick={() => setSelectedId(agent.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Detail */}
      <div className="flex-1 overflow-y-auto p-6">
        {selected ? (
          <motion.div
            key={selected.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
          >
            <AgentDetail agent={selected} onDeleted={() => setSelectedId(null)} />
          </motion.div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-3">
              <Bot className="w-16 h-16 text-muted-foreground/30 mx-auto" />
              <p className="text-muted-foreground">Seleziona un agente o creane uno nuovo</p>
              <Button variant="outline" onClick={() => setCreateOpen(true)}>
                <Plus className="w-4 h-4 mr-2" /> Nuovo Agente
              </Button>
            </div>
          </div>
        )}
      </div>

      <CreateAgentDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
