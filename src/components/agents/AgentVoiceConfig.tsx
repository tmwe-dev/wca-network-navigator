import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Save, Mic, Volume2 } from "lucide-react";
import { useAgents, type Agent } from "@/hooks/useAgents";
import { toast } from "sonner";
import { createLogger } from "@/lib/log";

const log = createLogger("AgentVoiceConfig");

const VOICE_PRESETS = [
  { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura 🇮🇹", lang: "IT" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah 🇺🇸", lang: "EN" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel 🇬🇧", lang: "EN" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George 🇬🇧", lang: "EN" },
  { id: "CwhRBWXzGAHq8TQ4Fs17", name: "Roger 🇺🇸", lang: "EN" },
];

interface Props {
  agent: Agent;
}

export function AgentVoiceConfig({ agent }: Props) {
  const [voiceId, setVoiceId] = useState(agent.elevenlabs_voice_id || "");
  const [agentId, setAgentId] = useState(agent.elevenlabs_agent_id || "");
  const { updateAgent } = useAgents();

  useEffect(() => {
    setVoiceId(agent.elevenlabs_voice_id || "");
    setAgentId(agent.elevenlabs_agent_id || "");
  }, [agent.id]);

  const save = () => {
    updateAgent.mutate(
      { id: agent.id, elevenlabs_voice_id: voiceId || null, elevenlabs_agent_id: agentId || null },
      { onSuccess: () => toast.success("Configurazione voce salvata") }
    );
  };

  const testVoice = async () => {
    if (!voiceId) return;
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ text: `Ciao, sono ${agent.name}. Pronto a lavorare!`, voiceId }),
        }
      );
      if (!res.ok) throw new Error("TTS failed");
      const blob = await res.blob();
      const audio = new Audio(URL.createObjectURL(blob));
      await audio.play();
    } catch (e) {
      log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) });
      toast.error("Errore nel test voce");
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Mic className="w-4 h-4" /> Configurazione Voce ElevenLabs
      </h3>
      <div>
        <Label className="text-xs">Voice ID (TTS)</Label>
        <div className="flex gap-2 mt-1">
          <Input value={voiceId} onChange={(e) => setVoiceId(e.target.value)} placeholder="ID voce ElevenLabs" className="text-sm" />
          <Button size="icon" variant="outline" onClick={testVoice} disabled={!voiceId} title="Test voce" aria-label="Test voce">
            <Volume2 className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {VOICE_PRESETS.map((v) => (
            <button
              key={v.id}
              onClick={() => setVoiceId(v.id)}
              className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                voiceId === v.id ? "bg-primary/20 border-primary/40" : "border-border/50 hover:bg-accent/30"
              }`}
            >
              {v.name}
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label className="text-xs">Agent ID (Conversational AI — opzionale)</Label>
        <Input value={agentId} onChange={(e) => setAgentId(e.target.value)} placeholder="ID agente ElevenLabs" className="text-sm mt-1" />
        <p className="text-[10px] text-muted-foreground mt-1">
          Se configurato, abilita la chat vocale bidirezionale con l'agente
        </p>
      </div>
      <Button size="sm" onClick={save}>
        <Save className="w-3.5 h-3.5 mr-1" /> Salva Configurazione
      </Button>
    </div>
  );
}
