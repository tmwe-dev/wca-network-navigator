import { useState, useEffect, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Volume2, Play, Check, Settings2, Loader2, RefreshCw, Square, AlertCircle, CheckCircle2 } from "lucide-react";
import { useUpdateSetting } from "@/hooks/useAppSettings";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Voice {
  voice_id: string;
  name: string;
  category: string;
  labels: Record<string, string>;
  preview_url: string | null;
  description: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  cloned: "Clonate",
  generated: "Generate",
  premade: "Premade",
  professional: "Professional",
  high_quality: "Alta Qualità",
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
  const agentId = settings?.elevenlabs_agent_id || "";

  // Load voices on mount
  useEffect(() => {
    loadVoices();
  }, []);

  const loadVoices = async () => {
    setLoadingVoices(true);
    try {
      const { data, error } = await supabase.functions.invoke("list-elevenlabs-voices");
      if (error) throw error;
      setApiStatus(data.status || "error");
      if (data.voices && data.voices.length > 0) {
        setVoices(data.voices);
      }
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

  const playPreview = (voice: Voice) => {
    if (playingId === voice.voice_id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    if (audioRef.current) audioRef.current.pause();

    const url = voice.preview_url;
    if (!url) {
      toast({ title: "Anteprima non disponibile", description: "Questa voce non ha un'anteprima audio.", variant: "destructive" });
      return;
    }
    const audio = new Audio(url);
    audioRef.current = audio;
    setPlayingId(voice.voice_id);
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

  const handleSaveAgentId = (val: string) => {
    updateSetting.mutate({ key: "elevenlabs_agent_id", value: val });
  };

  // Group voices by category
  const grouped = voices.reduce<Record<string, Voice[]>>((acc, v) => {
    const cat = v.category || "premade";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(v);
    return acc;
  }, {});

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
        <TabsTrigger value="voce" className="gap-1.5 text-xs"><Volume2 className="w-3.5 h-3.5" /> Libreria Voci</TabsTrigger>
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

        {/* Voice Library */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Voci ElevenLabs ({voices.length})</CardTitle>
              <Button size="sm" variant="outline" onClick={loadVoices} disabled={loadingVoices} className="text-xs gap-1.5">
                {loadingVoices ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                Aggiorna
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(grouped).map(([category, catVoices]) => (
              <div key={category}>
                <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                  {CATEGORY_LABELS[category] || category} ({catVoices.length})
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {catVoices.map((v) => {
                    const isSelected = selectedVoiceId === v.voice_id;
                    const isPlaying = playingId === v.voice_id;
                    const gender = v.labels?.gender || "";
                    const accent = v.labels?.accent || "";
                    return (
                      <div
                        key={v.voice_id}
                        className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 cursor-pointer transition-all text-xs ${
                          isSelected
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:border-primary/40 hover:bg-secondary/30"
                        }`}
                        onClick={() => handleSelectVoice(v.voice_id)}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {isSelected && <Check className="w-3 h-3 shrink-0" />}
                          <span className="font-medium truncate">{v.name}</span>
                          {gender && <Badge variant="outline" className="text-[9px] px-1 py-0">{gender === "female" ? "F" : gender === "male" ? "M" : "N"}</Badge>}
                          {accent && <span className="text-[9px] text-muted-foreground truncate">{accent}</span>}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={(e) => { e.stopPropagation(); playPreview(v); }}
                        >
                          {isPlaying ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
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
              <Input value={agentId} onChange={(e) => handleSaveAgentId(e.target.value)} placeholder="Agent ID opzionale" className="text-xs" />
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
