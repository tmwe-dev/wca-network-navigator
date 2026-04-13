import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Brain, Sliders, Eye, EyeOff } from "lucide-react";
import type { useUpdateSetting } from "@/hooks/useAppSettings";

interface AIProviderSettingsProps {
  settings: Record<string, string> | undefined;
  updateSetting: ReturnType<typeof useUpdateSetting>;
}

const AI_PROVIDERS = [
  { value: "lovable", label: "Lovable (default)" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "openai", label: "OpenAI diretto" },
  { value: "anthropic", label: "Anthropic (Claude)" },
  { value: "google", label: "Google AI (Gemini)" },
  { value: "grok", label: "Grok (xAI)" },
  { value: "qwen", label: "Qwen (Alibaba)" },
];

const TTS_MODELS = [
  { value: "eleven_multilingual_v2", label: "Multilingual v2" },
  { value: "eleven_turbo_v2", label: "Turbo v2" },
  { value: "eleven_turbo_v2_5", label: "Turbo v2.5" },
  { value: "eleven_flash_v2", label: "Flash v2" },
  { value: "eleven_flash_v2_5", label: "Flash v2.5" },
  { value: "eleven_monolingual_v1", label: "Monolingual v1" },
];

const OUTPUT_FORMATS = [
  { value: "mp3_44100_128", label: "MP3 44.1kHz 128kbps" },
  { value: "mp3_22050_32", label: "MP3 22kHz 32kbps" },
  { value: "pcm_16000", label: "PCM 16kHz" },
  { value: "pcm_44100", label: "PCM 44.1kHz" },
  { value: "ulaw_8000", label: "μ-law 8kHz" },
];

export function AIProviderSettings({ settings, updateSetting }: AIProviderSettingsProps) {
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyDraft, setApiKeyDraft] = useState("");

  useEffect(() => {
    if (settings) {
      setApiKeyDraft(settings["ai_api_key"] || "");
    }
  }, [settings]);

  const currentProvider = settings?.["ai_provider"] || "lovable";
  const currentTtsModel = settings?.["elevenlabs_tts_model"] || "eleven_multilingual_v2";
  const currentStability = parseFloat(settings?.["elevenlabs_stability"] || "0.5");
  const currentSimilarity = parseFloat(settings?.["elevenlabs_similarity"] || "0.75");
  const currentStyle = parseFloat(settings?.["elevenlabs_style"] || "0.3");
  const currentSpeakerBoost = settings?.["elevenlabs_speaker_boost"] !== "false";
  const currentOutputFormat = settings?.["elevenlabs_output_format"] || "mp3_44100_128";

  const handleSave = (key: string, value: string) => {
    updateSetting.mutate({ key, value });
  };

  return (
    <div className="space-y-4">
      {/* Section 1: AI Provider */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" />
            Provider AI
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Provider</Label>
            <Select
              value={currentProvider}
              onValueChange={(v) => handleSave("ai_provider", v)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AI_PROVIDERS.map((p) => (
                  <SelectItem key={p.value} value={p.value} className="text-xs">
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">API Key provider</Label>
            <div className="relative">
              <Input
                type={showApiKey ? "text" : "password"}
                value={apiKeyDraft}
                onChange={(e) => setApiKeyDraft(e.target.value)}
                onBlur={() => handleSave("ai_api_key", apiKeyDraft)}
                placeholder="sk-..."
                className="h-8 text-xs pr-8"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground leading-tight">
              Lascia vuoto per usare la chiave di default del sistema (Lovable). Inserisci la tua chiave per usare il provider selezionato direttamente.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: ElevenLabs Advanced */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sliders className="w-4 h-4 text-primary" />
            ElevenLabs — Voce Avanzate
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* TTS Model */}
          <div className="space-y-1.5">
            <Label className="text-xs">Modello TTS</Label>
            <Select
              value={currentTtsModel}
              onValueChange={(v) => handleSave("elevenlabs_tts_model", v)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TTS_MODELS.map((m) => (
                  <SelectItem key={m.value} value={m.value} className="text-xs">
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Stability */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Stability</Label>
              <span className="text-[10px] text-muted-foreground tabular-nums">{currentStability.toFixed(2)}</span>
            </div>
            <Slider
              value={[currentStability]}
              min={0}
              max={1}
              step={0.05}
              onValueCommit={([v]) => handleSave("elevenlabs_stability", v.toString())}
              className="py-1"
            />
          </div>

          {/* Similarity */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Similarity</Label>
              <span className="text-[10px] text-muted-foreground tabular-nums">{currentSimilarity.toFixed(2)}</span>
            </div>
            <Slider
              value={[currentSimilarity]}
              min={0}
              max={1}
              step={0.05}
              onValueCommit={([v]) => handleSave("elevenlabs_similarity", v.toString())}
              className="py-1"
            />
          </div>

          {/* Style */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Style</Label>
              <span className="text-[10px] text-muted-foreground tabular-nums">{currentStyle.toFixed(2)}</span>
            </div>
            <Slider
              value={[currentStyle]}
              min={0}
              max={1}
              step={0.05}
              onValueCommit={([v]) => handleSave("elevenlabs_style", v.toString())}
              className="py-1"
            />
          </div>

          {/* Speaker Boost */}
          <div className="flex items-center justify-between">
            <Label className="text-xs">Speaker Boost</Label>
            <Switch
              checked={currentSpeakerBoost}
              onCheckedChange={(v) => handleSave("elevenlabs_speaker_boost", v.toString())}
            />
          </div>

          {/* Output Format */}
          <div className="space-y-1.5">
            <Label className="text-xs">Output Format</Label>
            <Select
              value={currentOutputFormat}
              onValueChange={(v) => handleSave("elevenlabs_output_format", v)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OUTPUT_FORMATS.map((f) => (
                  <SelectItem key={f.value} value={f.value} className="text-xs">
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default AIProviderSettings;
