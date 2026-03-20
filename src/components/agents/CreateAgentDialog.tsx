import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AGENT_ROLES, AGENT_TEMPLATES } from "@/data/agentTemplates";
import { cn } from "@/lib/utils";
import { useAgents } from "@/hooks/useAgents";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateAgentDialog({ open, onOpenChange }: Props) {
  const [name, setName] = useState("");
  const [selectedRole, setSelectedRole] = useState("outreach");
  const { createAgent } = useAgents();

  const handleCreate = () => {
    if (!name.trim()) return;
    const tpl = AGENT_TEMPLATES[selectedRole];
    const role = AGENT_ROLES.find((r) => r.value === selectedRole);
    createAgent.mutate(
      {
        name: name.trim(),
        role: selectedRole,
        avatar_emoji: role?.emoji || "🤖",
        system_prompt: tpl.system_prompt,
        assigned_tools: tpl.assigned_tools,
      },
      {
        onSuccess: () => {
          toast.success("Agente creato!");
          setName("");
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuovo Agente</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome agente</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Es: Marco - Outreach Italia" />
          </div>
          <div>
            <Label>Ruolo</Label>
            <div className="grid grid-cols-1 gap-2 mt-2">
              {AGENT_ROLES.map((role) => (
                <button
                  key={role.value}
                  onClick={() => setSelectedRole(role.value)}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border text-left transition-all",
                    selectedRole === role.value
                      ? "bg-primary/10 border-primary/40"
                      : "bg-card/50 border-border/50 hover:bg-accent/30"
                  )}
                >
                  <span className="text-xl">{role.emoji}</span>
                  <div>
                    <span className="text-sm font-medium">{role.label}</span>
                    <p className="text-xs text-muted-foreground">
                      {AGENT_TEMPLATES[role.value]?.assigned_tools.length} tool pre-assegnati
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={handleCreate} disabled={!name.trim() || createAgent.isPending}>
            {createAgent.isPending ? "Creazione..." : "Crea Agente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
