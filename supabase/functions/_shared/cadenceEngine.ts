/**
 * cadenceEngine.ts — Regole di cadenza multi-canale e sequencing attività.
 * Definisce QUANDO e CON QUALE CANALE contattare, basandosi sullo stato commerciale.
 *
 * TASSONOMIA STATI: usa SOLO i lead_status canonici del prodotto:
 *   new | contacted | in_progress | negotiation | converted | lost
 * (più "archived" come alias tollerato di "lost" per retro-compat).
 */

// ── Cadenza per stato commerciale ──
export interface CadenceRule {
  allowedChannels: ("email" | "linkedin" | "whatsapp")[];
  minDaysBetweenContacts: number;
  maxContactsPerWeek: number;
  escalationAfterDays: number;
  notes: string;
}

export const CADENCE_BY_STATE: Record<string, CadenceRule> = {
  // Mai contattato — solo email come primo touch
  new: {
    allowedChannels: ["email"],
    minDaysBetweenContacts: 0,
    maxContactsPerWeek: 1,
    escalationAfterDays: 5,
    notes: "Solo email per primo contatto. MAI WhatsApp o LinkedIn come primo touch.",
  },
  // Primo touch inviato, in attesa di risposta — follow-up email + LinkedIn
  contacted: {
    allowedChannels: ["email", "linkedin"],
    minDaysBetweenContacts: 3,
    maxContactsPerWeek: 2,
    escalationAfterDays: 5,
    notes: "Dopo 3 giorni senza risposta: follow-up email. Dopo 5 giorni: LinkedIn connection.",
  },
  // Dialogo attivo / qualificazione in corso — tutti i canali con consenso
  in_progress: {
    allowedChannels: ["email", "linkedin", "whatsapp"],
    minDaysBetweenContacts: 2,
    maxContactsPerWeek: 3,
    escalationAfterDays: 7,
    notes: "Dialogo attivo. Tutti i canali aperti. WhatsApp solo con consenso esplicito.",
  },
  // Trattativa attiva — risposte rapide
  negotiation: {
    allowedChannels: ["email", "whatsapp"],
    minDaysBetweenContacts: 1,
    maxContactsPerWeek: 7,
    escalationAfterDays: 2,
    notes: "Trattativa attiva. Risposte rapide. WhatsApp per follow-up veloci.",
  },
  // Cliente acquisito — mantenimento
  converted: {
    allowedChannels: ["email", "whatsapp", "linkedin"],
    minDaysBetweenContacts: 7,
    maxContactsPerWeek: 1,
    escalationAfterDays: 30,
    notes: "Cliente acquisito. Contatto di mantenimento. Auguri, aggiornamenti, cross-sell.",
  },
  // Perso / archiviato — nessun contatto automatico
  lost: {
    allowedChannels: [],
    minDaysBetweenContacts: 90,
    maxContactsPerWeek: 0,
    escalationAfterDays: 999,
    notes: "Lead perso/archiviato. Nessun contatto automatico. Solo riattivazione manuale.",
  },
  // Alias retro-compat
  archived: {
    allowedChannels: [],
    minDaysBetweenContacts: 90,
    maxContactsPerWeek: 0,
    escalationAfterDays: 999,
    notes: "Alias di 'lost'. Nessun contatto automatico.",
  },
};

// ── Sequenza contatto per primo engagement ──
export interface TouchpointStep {
  day: number;
  channel: "email" | "linkedin" | "whatsapp";
  action: string;
  condition?: string;
}

export const FIRST_ENGAGEMENT_SEQUENCE: TouchpointStep[] = [
  { day: 0, channel: "email", action: "cold_outreach", condition: undefined },
  { day: 3, channel: "email", action: "follow_up_1", condition: "no_reply" },
  { day: 5, channel: "linkedin", action: "connection_request", condition: "no_reply" },
  { day: 7, channel: "email", action: "follow_up_2_value_add", condition: "no_reply" },
  { day: 10, channel: "linkedin", action: "linkedin_message", condition: "no_reply AND linkedin_connected" },
  { day: 14, channel: "email", action: "breakup_email", condition: "no_reply" },
  // Dopo 14 giorni nessuna risposta → stato resta "contacted" ma esce dalla sequenza attiva
];

// ── Funzione di verifica cadenza ──
export interface CadenceCheckResult {
  allowed: boolean;
  reason?: string;
  reasonCode?: "channel_blocked" | "no_consent" | "weekly_limit" | "too_soon" | "ok";
  suggestedChannel?: "email" | "linkedin" | "whatsapp";
  nextAllowedDate?: string;
  currentStep?: number;
}

export function checkCadence(
  commercialState: string,
  lastContactDate: string | null,
  lastChannel: string | null,
  totalTouchesThisWeek: number,
  channel: "email" | "linkedin" | "whatsapp",
  hasWhatsAppConsent: boolean,
): CadenceCheckResult {
  const rule = CADENCE_BY_STATE[commercialState] || CADENCE_BY_STATE.contacted;

  // 1. Canale permesso?
  if (!rule.allowedChannels.includes(channel)) {
    const result: CadenceCheckResult = {
      allowed: false,
      reasonCode: "channel_blocked",
      reason: `Canale ${channel} non permesso in stato "${commercialState}". Canali ammessi: ${rule.allowedChannels.join(", ") || "nessuno"}`,
      suggestedChannel: rule.allowedChannels[0] || undefined,
    };
    console.warn("[CadenceEngine] BLOCK", JSON.stringify(result));
    return result;
  }

  // 2. WhatsApp check consenso
  if (channel === "whatsapp" && !hasWhatsAppConsent && commercialState !== "negotiation") {
    const result: CadenceCheckResult = {
      allowed: false,
      reasonCode: "no_consent",
      reason: "WhatsApp richiede consenso esplicito del contatto (numero fornito o contatto iniziato da lui)",
      suggestedChannel: "email",
    };
    console.warn("[CadenceEngine] BLOCK", JSON.stringify(result));
    return result;
  }

  // 3. Frequenza settimanale
  if (totalTouchesThisWeek >= rule.maxContactsPerWeek) {
    const result: CadenceCheckResult = {
      allowed: false,
      reasonCode: "weekly_limit",
      reason: `Limite settimanale raggiunto: ${totalTouchesThisWeek}/${rule.maxContactsPerWeek} contatti questa settimana`,
    };
    console.warn("[CadenceEngine] BLOCK", JSON.stringify(result));
    return result;
  }

  // 4. Intervallo minimo
  if (lastContactDate) {
    const lastDate = new Date(lastContactDate);
    const daysSince = Math.floor((Date.now() - lastDate.getTime()) / 86400000);
    if (daysSince < rule.minDaysBetweenContacts) {
      const nextDate = new Date(lastDate.getTime() + rule.minDaysBetweenContacts * 86400000);
      const result: CadenceCheckResult = {
        allowed: false,
        reasonCode: "too_soon",
        reason: `Troppo presto: ultimo contatto ${daysSince} giorni fa, minimo ${rule.minDaysBetweenContacts} giorni`,
        nextAllowedDate: nextDate.toISOString().split("T")[0],
        suggestedChannel: channel,
      };
      console.warn("[CadenceEngine] BLOCK", JSON.stringify(result));
      return result;
    }
  }

  // 5. Evitare ripetizione canale consecutiva (se possibile)
  let suggestedChannel: "email" | "linkedin" | "whatsapp" | undefined = channel;
  if (lastChannel === channel && rule.allowedChannels.length > 1) {
    const alternatives = rule.allowedChannels.filter(c => c !== channel && (c !== "whatsapp" || hasWhatsAppConsent));
    if (alternatives.length > 0) {
      suggestedChannel = alternatives[0];
    }
  }

  return {
    allowed: true,
    reasonCode: "ok",
    suggestedChannel: suggestedChannel !== channel ? suggestedChannel : undefined,
  };
}

// ── Determina il prossimo step nella sequenza di engagement ──
export function getNextEngagementStep(
  daysSinceFirstTouch: number,
  completedSteps: number[],
  hasLinkedInConnection: boolean,
  hasReply: boolean,
): TouchpointStep | null {
  if (hasReply) return null;

  for (let i = 0; i < FIRST_ENGAGEMENT_SEQUENCE.length; i++) {
    const step = FIRST_ENGAGEMENT_SEQUENCE[i];
    if (completedSteps.includes(i)) continue;
    if (daysSinceFirstTouch < step.day) continue;

    if (step.condition) {
      if (step.condition.includes("no_reply") && hasReply) continue;
      if (step.condition.includes("linkedin_connected") && !hasLinkedInConnection) continue;
    }

    return step;
  }
  return null;
}
