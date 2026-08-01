/**
 * VoiceLanguageSelector — Dropdown per selezione lingua vocale STT/TTS.
 */
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const VOICE_LANGUAGE_MAP: Record<string, { label: string; flag: string; sttCode: string; voiceId: string; voiceName: string }> = {
  it: { label: "Italiano", flag: "🇮🇹", sttCode: "it-IT", voiceId: "FGY2WhTYpPnrIDTdsKH5", voiceName: "Laura" },
  en: { label: "English", flag: "🇺🇸", sttCode: "en-US", voiceId: "JBFqnCBsd6RMkjVDRZzb", voiceName: "George" },
  de: { label: "Deutsch", flag: "🇩🇪", sttCode: "de-DE", voiceId: "onwK4e9ZLuTAKqWW03F9", voiceName: "Daniel" },
  es: { label: "Español", flag: "🇪🇸", sttCode: "es-ES", voiceId: "EXAVITQu4vr4xnSDxMaL", voiceName: "Sarah" },
  fr: { label: "Français", flag: "🇫🇷", sttCode: "fr-FR", voiceId: "pFZP5JQG7iQjIQuC4Bku", voiceName: "Lily" },
  pt: { label: "Português", flag: "🇧🇷", sttCode: "pt-BR", voiceId: "TX3LPaxmHKxFdv7VOQHJ", voiceName: "Liam" },
};

export const VOICE_LANG_KEYS = Object.keys(VOICE_LANGUAGE_MAP);

interface VoiceLanguageSelectorProps {
  value: string;
  onChange: (lang: string) => void;
  compact?: boolean;
}

export default function VoiceLanguageSelector({ value, onChange, compact }: VoiceLanguageSelectorProps) {
  const current = VOICE_LANGUAGE_MAP[value] || VOICE_LANGUAGE_MAP.it;

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={compact ? "w-10 px-0 justify-center text-sm" : "w-full text-xs"}>
        <SelectValue>
          {compact ? current.flag : `${current.flag} ${current.label}`}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {VOICE_LANG_KEYS.map((key) => {
          const lang = VOICE_LANGUAGE_MAP[key];
          return (
            <SelectItem key={key} value={key} className="text-xs">
              {lang.flag} {lang.label} ({lang.voiceName})
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
