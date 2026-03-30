import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Volume2, Play, Check, Mic, Settings2, Loader2 } from "lucide-react";
import { useAppSettings, useUpdateSetting } from "@/hooks/useAppSettings";
import { toast } from "@/hooks/use-toast";

const VOICE_PRESETS = [
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", lang: "EN", gender: "F" },
  { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura", lang: "EN", gender: "F" },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily", lang: "EN", gender: "F" },
  { id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice", lang: "EN", gender: "F" },
  { id: "cgSgspJ2msm6clMCkdW9", name: "Jessica", lang: "EN", gender: "F" },
  { id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda", lang: "EN", gender: "F" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", lang: "EN", gender: "M" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", lang: "EN", gender: "M" },
  { id: "CwhRBWXzGAHq8TQ4Fs17", name: "Roger", lang: "EN", gender: "M" },
  { id: "nPczCjzI2devNBz1zQrb", name: "Brian", lang: "EN", gender: "M" },
  { id: "cjVigY5qzO86Huf0OWal", name: "Eric", lang: "EN", gender: "M" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam", lang: "EN", gender: "M" },
  { id: "iP95p4xoKVk53GoZ742B", name: "Chris", lang: "EN", gender: "M" },
  { id: "bIHbv24MWmeRgasZH58o", name: "Will", lang: "EN", gender: "M" },
  { id: "IKne3meq5aSn9XLyUdCD", name: "Charlie", lang: "EN", gender: "M" },
  { id: "SAz9YHcvj6GT2YYXdXww", name: "River", lang: "EN", gender: "N" },
  { id: "N2lVS1w4EtoT3dr4eOWO", name: "Callum", lang: "EN", gender: "M" },
  { id: "pqHfZKP75CvOlQylNhV4", name: "Bill", lang: "EN", gender: "M" },
];

interface ElevenLabsSettingsProps {
  settings: Record<string, string> | undefined;
  updateSetting: ReturnType<typeof useUpdateSetting>;
}

export function ElevenLabsSettings({ settings, updateSetting }: ElevenLabsSettingsProps) {
  const [testingVoice, setTestingVoice] = useState<string | null>(null);
  const [customVoiceId, setCustomVoiceId] = useState(settings?.elevenlabs_custom_voice_id || "");

  const selectedVoiceId = settings?.elevenlabs_default_voice_id || "";
  const ttsEnabled = settings?.elevenlabs_tts_enabled === "true";
  const agentId = settings?.elevenlabs_agent_id || "";

  const handleSelectVoice = (voiceId: string) => {
    updateSetting.mutate({ key: "elevenlabs_default_voice_id", value: voiceId });
  };

  const handleToggleTTS = (enabled: boolean) => {
    updateSetting.mutate({ key: "elevenlabs_tts_enabled", value: enabled ? "true" : "false" });
  };

  const handleTestVoice = async (voiceId: string) => {
    setTestingVoice(voiceId);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            text: "Ciao, sono la tua assistente vocale. Come posso aiutarti oggi?",
            voiceId,
          }),
        }
      );
      if (!response.ok) throw new Error("TTS failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
    } catch (e) {
      toast({ title: "Errore", description: "Impossibile riprodurre la voce. Verifica la API Key.", variant: "destructive" });
    } finally {
      setTestingVoice(null);
    }
  };

  const handleSaveCustomVoice = () => {
    if (!customVoiceId.trim()) return;
    updateSetting.mutate({ key: "elevenlabs_custom_voice_id", value: customVoiceId.trim() });
    handleSelectVoice(customVoiceId.trim());
    toast({ title: "Voice ID salvato" });
  };

  const handleSaveAgentId = (val: string) => {
    updateSetting.mutate({ key: "elevenlabs_agent_id", value: val });
  };

  return (
    <Tabs defaultValue="voce" className="space-y-4">
      <TabsList className="w-full justify-start">
        <TabsTrigger value="voce" className="gap-1.5 text-xs">
          <Volume2 className="w-3.5 h-3.5" /> Voce
        </TabsTrigger>
        <TabsTrigger value="avanzate" className="gap-1.5 text-xs">
          <Settings2 className="w-3.5 h-3.5" /> Avanzate
        </TabsTrigger>
      </TabsList>

      <TabsContent value="voce" className="m-0 space-y-4">
        {/* TTS Toggle */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Risposte vocali nell'assistente</p>
                <p className="text-xs text-muted-foreground">L'assistente AI leggerà le risposte ad alta voce</p>
              </div>
              <Switch checked={ttsEnabled} onCheckedChange={handleToggleTTS} />
            </div>
          </CardContent>
        </Card>

        {/* Voice presets */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Voci disponibili</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {VOICE_PRESETS.map((v) => {
                const isSelected = selectedVoiceId === v.id;
                const isTesting = testingVoice === v.id;
                return (
                  <div
                    key={v.id}
                    className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 cursor-pointer transition-all text-xs ${
                      isSelected
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/40 hover:bg-secondary/30"
                    }`}
                    onClick={() => handleSelectVoice(v.id)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isSelected && <Check className="w-3 h-3 shrink-0" />}
                      <span className="font-medium truncate">{v.name}</span>
                      <Badge variant="outline" className="text-[9px] px-1 py-0">{v.gender}</Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={(e) => { e.stopPropagation(); handleTestVoice(v.id); }}
                      disabled={!!testingVoice}
                    >
                      {isTesting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Custom voice ID */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Voice ID personalizzato</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">Inserisci un Voice ID dalla Voice Library di ElevenLabs</p>
            <div className="flex gap-2">
              <Input
                value={customVoiceId}
                onChange={(e) => setCustomVoiceId(e.target.value)}
                placeholder="es. JBFqnCBsd6RMkjVDRZzb"
                className="text-xs"
              />
              <Button size="sm" onClick={handleSaveCustomVoice} disabled={!customVoiceId.trim()}>Salva</Button>
              {customVoiceId.trim() && (
                <Button size="sm" variant="outline" onClick={() => handleTestVoice(customVoiceId.trim())} disabled={!!testingVoice}>
                  {testingVoice === customVoiceId.trim() ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="avanzate" className="m-0 space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Stato connessione</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">API Key ElevenLabs:</span>
              <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-400 border-green-500/30">Configurata</Badge>
            </div>
            <p className="text-[10px] text-muted-foreground">
              La API Key è gestita nei secret del backend. Per modificarla, aggiorna il secret ELEVENLABS_API_KEY.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Agent ID (Conversational AI)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">ID dell'agente ElevenLabs per conversazioni vocali in tempo reale</p>
            <div className="flex gap-2">
              <Input
                value={agentId}
                onChange={(e) => handleSaveAgentId(e.target.value)}
                placeholder="Agent ID opzionale"
                className="text-xs"
              />
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
