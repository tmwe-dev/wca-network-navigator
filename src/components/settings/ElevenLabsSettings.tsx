import { useState, useEffect, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Volume2, Play, Settings2, Loader2, RefreshCw, Square, AlertCircle, CheckCircle2 } from "lucide-react";
import { useUpdateSetting } from "@/hooks/useAppSettings";
import { useAgents } from "@/hooks/useAgents";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdge } from "@/lib/api/invokeEdge";

interface Voice {
  voice_id: string;
  name: string;
  category: string;
  labels: Record<string, string>;
  preview_url: string | null;
  description: string | null;
}

const ACCENT_FLAGS: Record<string, string> = {
  american: "🇺🇸",
  british: "🇬🇧",
  italian: "🇮🇹",
  french: "🇫🇷",
  german: "🇩🇪",
  spanish: "🇪🇸",
  australian: "🇦🇺",
  indian: "🇮🇳",
  irish: "🇮🇪",
  swedish: "🇸🇪",
  portuguese: "🇵🇹",
  korean: "🇰🇷",
  chinese: "🇨🇳",
  japanese: "🇯🇵",
  dutch: "🇳🇱",
  turkish: "🇹🇷",
  polish: "🇵🇱",
  arabic: "🇸🇦",
};

const CATEGORY_SHORT: Record<string, string> = {
  cloned: "Clone",
  generated: "Gen",
  premade: "Pre",
  professional: "Pro",
  high_quality: "HQ",
};

const FALLBACK_VOICES: Voice[] = [
  { voice_id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", category: "premade", labels: { gender: "female", accent: "american" }, preview_url: null, description: null },
  { voice_id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura", category: "premade", labels: { gender: "female" }, preview_url: null, description: null },
  { voice_id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", category: "premade", labels: { gender: "male", accent: "british" }, preview_url: null, description: null },
  { voice_id: "JBFqnCBsd6RMkjVDRZzb", name: "George", category: "premade", labels: { gender: "male", accent: "british" }, preview_url: null, description: null },
  { voice_id: "CwhRBWXzGAHq8TQ4Fs17", name: "Roger", category: "premade", labels: { gender: "male", accent: "american" }, preview_url: null, description: null },
];

interface ElevenLabsSettingsProps {
  settings: Record<string, string> | undefined;
  updateSetting: ReturnType<typeof useUpdateSetting>;
}

export function ElevenLabsSettings({ settings, updateSetting }: ElevenLabsSettingsProps) {
  const [voices, setVoices] = useState<Voice[]>(FALLBACK_VOICES);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [apiStatus, setApiStatus] = useState<"checking" | "ok" | "invalid_key" | "missing_key" | "error">("checking");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [customVoiceId, setCustomVoiceId] = useState(settings?.elevenlabs_custom_voice_id || "");

  const selectedVoiceId = settings?.elevenlabs_default_voice_id || "";
  const ttsEnabled = settings?.elevenlabs_tts_enabled === "true";
  const selectedAgentDbId = settings?.elevenlabs_default_agent_id || "";

  const { agents } = useAgents();

  useEffect(() => { loadVoices(); }, []);

  const loadVoices = async () => {
    setLoadingVoices(true);
    try {
      const data = await invokeEdge<any>("list-elevenlabs-voices", { context: "ElevenLabsSettings.list_elevenlabs_voices" });
      setApiStatus(data.status || "error");
      if (data.voices?.length > 0) setVoices(data.voices);
    } catch {
      setApiStatus("error");
    } finally {
      setLoadingVoices(false);
    }
  };

  const handleSelectVoice = (voiceId: string) => {
    updateSetting.mutate({ key: "elevenlabs_default_voice_id", value: voiceId });
  };

  const handleToggleTTS = (enabled: boolean) => {
    updateSetting.mutate({ key: "elevenlabs_tts_enabled", value: enabled ? "true" : "false" });
  };

  const handleSelectAgent = (agentDbId: string) => {
    updateSetting.mutate({ key: "elevenlabs_default_agent_id", value: agentDbId });
  };

  const playPreview = (voiceId: string) => {
    const voice = voices.find(v => v.voice_id === voiceId);
    if (!voice) return;
    if (playingId === voiceId) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    if (audioRef.current) audioRef.current.pause();
    if (!voice.preview_url) {
      toast({ title: "Anteprima non disponibile", variant: "destructive" });
      return;
    }
    const audio = new Audio(voice.preview_url);
    audioRef.current = audio;
    setPlayingId(voiceId);
    audio.onended = () => setPlayingId(null);
    audio.onerror = () => { setPlayingId(null); toast({ title: "Errore riproduzione", variant: "destructive" }); };
    audio.play();
  };

  const handleSaveCustomVoice = () => {
    if (!customVoiceId.trim()) return;
    updateSetting.mutate({ key: "elevenlabs_custom_voice_id", value: customVoiceId.trim() });
    handleSelectVoice(customVoiceId.trim());
    toast({ title: "Voice ID salvato" });
  };

  // Group by gender
  const maleVoices = voices.filter(v => v.labels?.gender === "male");
  const femaleVoices = voices.filter(v => v.labels?.gender === "female");
  const otherVoices = voices.filter(v => !v.labels?.gender || !["male", "female"].includes(v.labels.gender));

  const voiceLabel = (v: Voice) => {
    const flag = ACCENT_FLAGS[v.labels?.accent || ""] || "🌍";
    const cat = CATEGORY_SHORT[v.category] || v.category;
    return `${flag} ${v.name} · ${cat}`;
  };

  const selectedVoice = voices.find(v => v.voice_id === selectedVoiceId);

  const statusBadge = () => {
    switch (apiStatus) {
      case "checking": return <Badge variant="outline" className="text-[10px] bg-yellow-500/10 text-yellow-400 border-yellow-500/30"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Verifica...</Badge>;
      case "ok": return <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-400 border-green-500/30"><CheckCircle2 className="w-3 h-3 mr-1" />Connessa</Badge>;
      case "invalid_key": return <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-400 border-red-500/30"><AlertCircle className="w-3 h-3 mr-1" />Chiave non valida</Badge>;
      case "missing_key": return <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-400 border-red-500/30"><AlertCircle className="w-3 h-3 mr-1" />Non configurata</Badge>;
      default: return <Badge variant="outline" className="text-[10px] bg-orange-500/10 text-orange-400 border-orange-500/30"><AlertCircle className="w-3 h-3 mr-1" />Errore</Badge>;
    }
  };

  return (
    <Tabs defaultValue="voce" className="space-y-4">
      <TabsList className="w-full justify-start">
        <TabsTrigger value="voce" className="gap-1.5 text-xs"><Volume2 className="w-3.5 h-3.5" /> Voce & Agente</TabsTrigger>
        <TabsTrigger value="avanzate" className="gap-1.5 text-xs"><Settings2 className="w-3.5 h-3.5" /> Avanzate</TabsTrigger>
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

        {/* Voice Select */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Voce predefinita ({voices.length} disponibili)</CardTitle>
              <Button size="sm" variant="outline" onClick={loadVoices} disabled={loadingVoices} className="text-xs gap-1.5">
                {loadingVoices ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                Aggiorna
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2 items-center">
              <Select value={selectedVoiceId} onValueChange={handleSelectVoice}>
                <SelectTrigger className="flex-1 text-xs">
                  <SelectValue placeholder="Seleziona una voce..." />
                </SelectTrigger>
                <SelectContent>
                  {maleVoices.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>👨 Maschile</SelectLabel>
                      {maleVoices.map(v => (
                        <SelectItem key={v.voice_id} value={v.voice_id} className="text-xs">
                          {voiceLabel(v)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  {femaleVoices.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>👩 Femminile</SelectLabel>
                      {femaleVoices.map(v => (
                        <SelectItem key={v.voice_id} value={v.voice_id} className="text-xs">
                          {voiceLabel(v)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  {otherVoices.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>🎭 Altro</SelectLabel>
                      {otherVoices.map(v => (
                        <SelectItem key={v.voice_id} value={v.voice_id} className="text-xs">
                          {voiceLabel(v)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                className="shrink-0 h-10 w-10"
                disabled={!selectedVoiceId}
                onClick={() => selectedVoiceId && playPreview(selectedVoiceId)}
              >
                {playingId === selectedVoiceId ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </Button>
            </div>
            {selectedVoice && (
              <p className="text-[10px] text-muted-foreground">
                {ACCENT_FLAGS[selectedVoice.labels?.accent || ""] || "🌍"} {selectedVoice.name} — {selectedVoice.labels?.accent || "n/a"} · {selectedVoice.category}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Agent Select */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Agente AI predefinito</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">Scegli l'agente AI che utilizzerà la voce selezionata</p>
            <Select value={selectedAgentDbId} onValueChange={handleSelectAgent}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Seleziona un agente..." />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Agenti attivi</SelectLabel>
                  {(agents || []).filter(a => a.is_active).map(a => (
                    <SelectItem key={a.id} value={a.id} className="text-xs">
                      {a.avatar_emoji} {a.name} — {a.role}
                    </SelectItem>
                  ))}
                </SelectGroup>
                {(agents || []).some(a => !a.is_active) && (
                  <SelectGroup>
                    <SelectLabel>Inattivi</SelectLabel>
                    {(agents || []).filter(a => !a.is_active).map(a => (
                      <SelectItem key={a.id} value={a.id} className="text-xs">
                        {a.avatar_emoji} {a.name} — {a.role}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
              </SelectContent>
            </Select>
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
              <Input value={customVoiceId} onChange={(e) => setCustomVoiceId(e.target.value)} placeholder="es. JBFqnCBsd6RMkjVDRZzb" className="text-xs" />
              <Button size="sm" onClick={handleSaveCustomVoice} disabled={!customVoiceId.trim()}>Salva</Button>
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
              {statusBadge()}
            </div>
            <p className="text-[10px] text-muted-foreground">
              La API Key è gestita dal connettore ElevenLabs. Per aggiornarla, riconnetti il connettore dalle impostazioni del workspace.
            </p>
            {apiStatus === "invalid_key" && (
              <p className="text-[10px] text-red-400">
                La chiave attuale non è valida (errore 401). Riconnetti il connettore ElevenLabs per aggiornare la chiave.
              </p>
            )}
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
                value={settings?.elevenlabs_agent_id || ""}
                onChange={(e) => updateSetting.mutate({ key: "elevenlabs_agent_id", value: e.target.value })}
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
