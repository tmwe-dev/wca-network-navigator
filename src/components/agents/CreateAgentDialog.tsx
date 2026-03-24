import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AGENT_ROLES, AGENT_TEMPLATES } from "@/data/agentTemplates";
import { AGENT_AVATARS } from "@/data/agentAvatars";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
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
  const [selectedAvatar, setSelectedAvatar] = useState("luca");
  const { createAgent } = useAgents();

  const handleCreate = () => {
    if (!name.trim()) return;
    const tpl = AGENT_TEMPLATES[selectedRole];
    createAgent.mutate(
      {
        name: name.trim(),
        role: selectedRole,
        avatar_emoji: selectedAvatar, // Now stores avatar ID instead of emoji
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuovo Agente</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome agente</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Es: Marco - Outreach Italia" />
          </div>

          {/* Avatar Picker */}
          <div>
            <Label>Avatar</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {AGENT_AVATARS.map((av) => (
                <button
                  key={av.id}
                  type="button"
                  onClick={() => setSelectedAvatar(av.id)}
                  className={cn(
                    "rounded-full p-0.5 transition-all",
                    selectedAvatar === av.id
                      ? "ring-2 ring-primary ring-offset-2 ring-offset-background scale-110"
                      : "opacity-60 hover:opacity-100"
                  )}
                >
                  <Avatar className="h-11 w-11">
                    <AvatarImage src={av.src} alt={av.label} />
                  </Avatar>
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>Ruolo</Label>
            <div className="grid grid-cols-1 gap-2 mt-2">
              {AGENT_ROLES.map((role) => {
                const avatarForRole = AGENT_AVATARS.find((a) => a.id === selectedAvatar);
                return (
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
                );
              })}
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
