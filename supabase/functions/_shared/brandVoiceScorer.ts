// === Brand Voice Scorer (LOVABLE — Brand Voice System) ===
// Calcolo DETERMINISTICO dell'aderenza alla voce TMWE. Nessuna chiamata LLM.
// Penalità cumulative su segnali misurabili: lessico vietato, lunghezza, emoji,
// punteggiatura, signature. La rubrica vive nella KB (doctrine/brand-voice/*),
// qui replichiamo i valori più stabili come fallback offline.

import type { ReviewChannel } from "./journalistTypes.ts";

const FORBIDDEN_LEXICON = [
  "soluzioni", "valore aggiunto", "sinergie", "innovativo",
  "leader del settore", "leader globale",
  "win-win", "best-in-class", "cutting-edge", "game-changer",
  "spero ti trovi bene", "spero vi trovi bene", "spero la trovi bene",
  "scusate il disturbo", "vi disturbo per",
  "non vediamo l'ora", "saremmo onorati", "grandissima opportunità",
  "ultima opportunità", "imperdibile",
];

const LENGTH_RANGES: Record<ReviewChannel, { min: number; max: number; unit: "words" | "chars" }> = {
  email: { min: 40, max: 180, unit: "words" },
  whatsapp: { min: 5, max: 60, unit: "words" },
  linkedin: { min: 50, max: 300, unit: "chars" },
  voice_script: { min: 15, max: 80, unit: "words" },
};

const EMOJI_LIMITS: Record<ReviewChannel, number> = {
  email: 1,
  whatsapp: 2,
  linkedin: 0,
  voice_script: 0,
};

const EMOJI_REGEX =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/gu;

export interface BrandVoiceSignals {
  word_count: number;
  char_count: number;
  emoji_count: number;
  exclamation_count: number;
  ellipsis_count: number;
  forbidden_hits: string[];
  signature_present: boolean;
}

export interface BrandVoiceScoreResult {
  score: number; // 0-100
  deviations: Array<{ type: string; description: string }>;
  signals: BrandVoiceSignals;
}

function detectSignature(text: string, channel: ReviewChannel): boolean {
  const lower = text.toLowerCase();
  if (channel === "linkedin") return true; // profilo = firma
  if (channel === "voice_script") return /sono\s+\w+,?\s+di\s+tmwe/i.test(text);
  if (channel === "whatsapp") return /—\s*\w+.*tmwe/i.test(text) || /tmwe/i.test(text);
  // email: cerca tmwe / signature block
  return lower.includes("tmwe") || /firmat[oa]/i.test(lower);
}

export function scoreBrandVoice(
  text: string,
  channel: ReviewChannel,
): BrandVoiceScoreResult {
  const deviations: Array<{ type: string; description: string }> = [];
  const cleaned = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const words = cleaned ? cleaned.split(/\s+/) : [];
  const word_count = words.length;
  const char_count = cleaned.length;
  const emoji_count = (text.match(EMOJI_REGEX) || []).length;
  const exclamation_count = (text.match(/!/g) || []).length;
  const ellipsis_count = (text.match(/\.{3,}|…/g) || []).length;

  const lower = cleaned.toLowerCase();
  const forbidden_hits = FORBIDDEN_LEXICON.filter((w) => lower.includes(w));
  const signature_present = detectSignature(text, channel);

  let score = 100;

  // Lessico vietato: -12 per hit, max -36
  if (forbidden_hits.length > 0) {
    const penalty = Math.min(36, forbidden_hits.length * 12);
    score -= penalty;
    deviations.push({
      type: "forbidden_lexicon",
      description: `Parole vietate: ${forbidden_hits.slice(0, 3).join(", ")}`,
    });
  }

  // Lunghezza
  const range = LENGTH_RANGES[channel];
  const value = range.unit === "words" ? word_count : char_count;
  if (value < range.min) {
    score -= 10;
    deviations.push({
      type: "length_under",
      description: `Troppo corto: ${value} ${range.unit} (min ${range.min})`,
    });
  } else if (value > range.max * 1.5) {
    score -= 20;
    deviations.push({
      type: "length_over",
      description: `Troppo lungo: ${value} ${range.unit} (max ${range.max})`,
    });
  } else if (value > range.max) {
    score -= 8;
    deviations.push({
      type: "length_over_soft",
      description: `Sopra il max consigliato: ${value} ${range.unit} (max ${range.max})`,
    });
  }

  // Emoji
  const emojiMax = EMOJI_LIMITS[channel];
  if (emoji_count > emojiMax) {
    score -= Math.min(15, (emoji_count - emojiMax) * 5);
    deviations.push({
      type: "emoji_over",
      description: `${emoji_count} emoji (max ${emojiMax} per ${channel})`,
    });
  }

  // Punteggiatura
  if (exclamation_count > 1) {
    score -= Math.min(10, (exclamation_count - 1) * 3);
    deviations.push({
      type: "exclamation_over",
      description: `${exclamation_count} punti esclamativi (max 1)`,
    });
  }
  if (channel !== "voice_script" && ellipsis_count > 0) {
    score -= 5;
    deviations.push({
      type: "ellipsis_used",
      description: `Puntini di sospensione vietati su ${channel}`,
    });
  }

  // Signature
  if (!signature_present) {
    score -= 8;
    deviations.push({
      type: "signature_missing",
      description: `Signature non rilevata per canale ${channel}`,
    });
  }

  score = Math.max(0, Math.min(100, score));

  return {
    score,
    deviations,
    signals: {
      word_count,
      char_count,
      emoji_count,
      exclamation_count,
      ellipsis_count,
      forbidden_hits,
      signature_present,
    },
  };
}

/** Persiste un audit Brand Voice in modo non-bloccante. */
// deno-lint-ignore no-explicit-any
export async function persistBrandVoiceAudit(
  supabase: any,
  params: {
    user_id?: string | null;
    partner_id?: string | null;
    channel: ReviewChannel;
    journalist_role?: string | null;
    result: BrandVoiceScoreResult;
    message_excerpt?: string;
  },
): Promise<void> {
  try {
    await supabase.from("brand_voice_audits").insert({
      user_id: params.user_id ?? null,
      partner_id: params.partner_id ?? null,
      channel: params.channel,
      journalist_role: params.journalist_role ?? null,
      brand_voice_score: params.result.score,
      deviations: params.result.deviations,
      signals: params.result.signals,
      message_excerpt: (params.message_excerpt || "").slice(0, 280),
    });
  } catch (err) {
    console.error("[brandVoiceScorer] persist error:", err);
  }
}