/**
 * VoiceAISettingsTab — ElevenLabs configuration
 */
import * as React from "react";
import { useSettingsV2, useUpdateSettingV2 } from "@/v2/hooks/useSettingsV2";
import { FormSection } from "../../organisms/FormSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Volume2, CheckCircle2, XCircle } from "lucide-react";
import { useState } from "react";
import VoiceLanguageSelector from "@/components/voice/VoiceLanguageSelector";

export function VoiceAISettingsTab(): React.ReactElement {
  const { data: settings } = useSettingsV2();
  const updateSetting = useUpdateSettingV2();
  const [voiceId, setVoiceId] = useState("");

  const hasApiKey = !!settings?.["elevenlabs_api_key"];
  const currentVoiceId = settings?.["elevenlabs_voice_id"] ?? "";
  const currentLang = settings?.["elevenlabs_language"] ?? "it";

  const handleSaveVoiceId = () => {
    if (voiceId) {
      updateSetting.mutate({ key: "elevenlabs_voice_id", value: voiceId });
    }
  };

  return (
    <div className="space-y-6">
      <FormSection title="Lingua vocale" description="Lingua usata per Speech-to-Text e Text-to-Speech degli agenti.">
        <div className="max-w-xs">
          <VoiceLanguageSelector
            value={currentLang}
            onChange={(lang) => updateSetting.mutate({ key: "elevenlabs_language", value: lang })}
          />
          <p className="text-xs text-muted-foreground mt-2">
            Spostato qui dalla top bar — preferenza globale.
          </p>
        </div>
      </FormSection>

      <FormSection title="ElevenLabs — Voce AI" description="Configurazione del motore vocale per gli agenti AI.">
        <div className="space-y-4">
          {/* API Key Status */}
          <div className="flex items-center gap-3 p-3 rounded-md border bg-muted/20">
            <Volume2 className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">API Key ElevenLabs</p>
              <p className="text-xs text-muted-foreground">
                {hasApiKey ? "Configurata e attiva" : "Non configurata — vai su Connessioni per aggiungerla"}
              </p>
            </div>
            {hasApiKey
              ? <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              : <XCircle className="h-5 w-5 text-destructive" />}
          </div>

          {/* Voice ID */}
          <div className="space-y-2">
            <Label className="text-sm">Voice ID</Label>
            <div className="flex gap-2">
              <Input
                value={voiceId || currentVoiceId}
                onChange={(e) => setVoiceId(e.target.value)}
                placeholder="Es: EXAVITQu4vr4xnSDxMaL"
                className="text-sm"
              />
              <Button size="sm" onClick={handleSaveVoiceId} disabled={updateSetting.isPending}>
                Salva
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">ID della voce ElevenLabs da usare per TTS.</p>
          </div>

          {/* Language */}
          <div className="space-y-2">
            <Label className="text-sm">Lingua</Label>
            <select
              value={currentLang}
              onChange={(e) => updateSetting.mutate({ key: "elevenlabs_language", value: e.target.value })}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="it">Italiano</option>
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="de">Deutsch</option>
              <option value="fr">Français</option>
            </select>
          </div>
        </div>
      </FormSection>
    </div>
  );
}
