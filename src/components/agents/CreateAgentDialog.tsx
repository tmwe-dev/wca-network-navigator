import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AGENT_ROLES, AGENT_TEMPLATES, AGENT_DEFAULT_VOICES, AGENT_DEFAULT_KB, ROBIN_VOICE_CALL_URL } from "@/data/agentTemplates";
import { AGENT_AVATARS, resolveAgentAvatar } from "@/data/agentAvatars";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useAgents } from "@/hooks/useAgents";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function generateSignatureHtml(name: string, role: string, avatarId: string): string {
  const avatar = AGENT_AVATARS.find(a => a.id === avatarId);
  const avatarSrc = avatar ? resolveAgentAvatar(name, avatarId) : null;
  const avatarHtml = avatarSrc
    ? `<img src="${avatarSrc}" alt="${name}" style="width:60px;height:60px;border-radius:50%;object-fit:cover;" />`
    : `<span style="font-size:36px;">🤖</span>`;

  return `<table cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;font-size:13px;color:#333;">
  <tr>
    <td style="padding-right:12px;vertical-align:top;">
      ${avatarHtml}
    </td>
    <td style="vertical-align:top;">
      <strong style="font-size:14px;">${name}</strong><br/>
      <span style="color:#666;font-size:12px;">Agente Digitale TMWI — ${role}</span><br/>
      <a href="${ROBIN_VOICE_CALL_URL}" style="color:#2563eb;font-size:12px;text-decoration:none;">📞 Chiamami</a>
    </td>
  </tr>
</table>`;
}

export function CreateAgentDialog({ open, onOpenChange }: Props) {
  const [name, setName] = useState("");
  const [selectedRole, setSelectedRole] = useState("outreach");
  const [selectedAvatar, setSelectedAvatar] = useState("luca");
  const { createAgent } = useAgents();

  const handleCreate = () => {
    if (!name.trim()) return;
    const tpl = AGENT_TEMPLATES[selectedRole];
    const avatar = AGENT_AVATARS.find(a => a.id === selectedAvatar);
    const gender = avatar?.gender || "male";
    const voice = AGENT_DEFAULT_VOICES[gender];
    const kb = AGENT_DEFAULT_KB[selectedRole] || [];
    const signatureHtml = generateSignatureHtml(name.trim(), selectedRole, selectedAvatar);

    createAgent.mutate(
      {
        name: name.trim(),
        role: selectedRole,
        avatar_emoji: selectedAvatar,
        system_prompt: tpl.system_prompt,
        assigned_tools: tpl.assigned_tools,
        elevenlabs_voice_id: voice.voiceId,
        signature_html: signatureHtml,
        voice_call_url: ROBIN_VOICE_CALL_URL,
        knowledge_base: kb,
      } as Record<string, unknown>,
      {
        onSuccess: () => {
          toast.success("Agente creato con voce, firma e KB operativa!");
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
              {AGENT_AVATARS.map((av) => {
                const voice = AGENT_DEFAULT_VOICES[av.gender];
                return (
                  <button
                    key={av.id}
                    type="button"
                    onClick={() => setSelectedAvatar(av.id)}
                    title={`${av.label} (${av.gender === "male" ? "M" : "F"}) — Voce: ${voice.voiceName}`}
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
                );
              })}
            </div>
            {(() => {
              const av = AGENT_AVATARS.find(a => a.id === selectedAvatar);
              const voice = av ? AGENT_DEFAULT_VOICES[av.gender] : null;
              return voice ? (
                <p className="text-[10px] text-muted-foreground mt-1">
                  Voce ElevenLabs: {voice.voiceName} ({av?.gender === "male" ? "maschile" : "femminile"})
                </p>
              ) : null;
            })()}
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
