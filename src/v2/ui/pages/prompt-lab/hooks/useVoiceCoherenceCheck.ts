/**
 * useVoiceCoherenceCheck — heuristic locale tra persona interna e voice prompt.
 */
import { useMemo } from "react";

export type CoherenceStatus = "ok" | "warn" | "fail";

export interface CoherenceItem {
  field: string;
  status: CoherenceStatus;
  message: string;
}

interface PersonaSummary {
  language?: string | null;
  tone?: string | null;
  vocabulary_do?: ReadonlyArray<string> | null;
  vocabulary_dont?: ReadonlyArray<string> | null;
}

const TONE_KEYWORDS: Record<string, string[]> = {
  formale: ["lei", "cordialmente", "distinti"],
  professionale: ["professional", "competen", "preciso"],
  amichevole: ["ciao", "amico", "rilass"],
  diretto: ["dritto", "punto", "senza giri"],
};

export function useVoiceCoherenceCheck(persona: PersonaSummary | null, voicePrompt: string): CoherenceItem[] {
  return useMemo(() => {
    if (!persona || !voicePrompt) return [];
    const items: CoherenceItem[] = [];
    const text = voicePrompt.toLowerCase();

    // Lingua
    if (persona.language) {
      const lang = persona.language.toLowerCase();
      const hasLang =
        text.includes(lang) ||
        (lang.startsWith("it") && /\b(italiano|italian)\b/.test(text)) ||
        (lang.startsWith("en") && /\b(english|inglese)\b/.test(text));
      items.push({
        field: "Lingua",
        status: hasLang ? "ok" : "warn",
        message: hasLang
          ? `Lingua "${persona.language}" coerente`
          : `Lingua "${persona.language}" non esplicita nel voice prompt`,
      });
    }

    // Tono
    if (persona.tone) {
      const tone = persona.tone.toLowerCase();
      const kws = TONE_KEYWORDS[tone] ?? [tone];
      const hits = kws.filter((k) => text.includes(k));
      items.push({
        field: "Tono",
        status: hits.length > 0 ? "ok" : "warn",
        message: hits.length > 0
          ? `Tono "${persona.tone}" rilevato`
          : `Tono "${persona.tone}" non rilevato chiaramente`,
      });
    }

    // Vocabulary do
    if (persona.vocabulary_do && persona.vocabulary_do.length > 0) {
      const present = persona.vocabulary_do.filter((w) => text.includes(w.toLowerCase()));
      const ratio = present.length / persona.vocabulary_do.length;
      items.push({
        field: "Vocabolario DO",
        status: ratio >= 0.5 ? "ok" : ratio > 0 ? "warn" : "fail",
        message: `${present.length}/${persona.vocabulary_do.length} termini presenti`,
      });
    }

    // Vocabulary dont
    if (persona.vocabulary_dont && persona.vocabulary_dont.length > 0) {
      const violations = persona.vocabulary_dont.filter((w) => text.includes(w.toLowerCase()));
      items.push({
        field: "Vocabolario DON'T",
        status: violations.length === 0 ? "ok" : "fail",
        message: violations.length === 0
          ? "Nessuna violazione"
          : `Violazioni: ${violations.join(", ")}`,
      });
    }

    return items;
  }, [persona, voicePrompt]);
}