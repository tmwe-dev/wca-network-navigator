/**
 * cadenceEngine.ts — Regole di cadenza multi-canale e sequencing attività.
 * Definisce QUANDO e CON QUALE CANALE contattare, basandosi sullo stato commerciale.
 */

// ── Cadenza per stato commerciale ──
// Ogni stato ha: canali permessi (in ordine di priorità), intervallo minimo tra contatti,
// numero massimo di contatti per finestra temporale.
export interface CadenceRule {
  allowedChannels: ("email" | "linkedin" | "whatsapp")[];
  minDaysBetweenContacts: number;
  maxContactsPerWeek: number;
  escalationAfterDays: number; // giorni senza risposta prima di escalare al canale successivo
  notes: string;
}

export const CADENCE_BY_STATE: Record<string, CadenceRule> = {
  new: {
    allowedChannels: ["email"],
    minDaysBetweenContacts: 0, // primo contatto, nessun vincolo
    maxContactsPerWeek: 1,
    escalationAfterDays: 5,
    notes: "Solo email per primo contatto. MAI WhatsApp o LinkedIn come primo touch.",
  },
  first_touch_sent: {
    allowedChannels: ["email", "linkedin"],
    minDaysBetweenContacts: 3,
    maxContactsPerWeek: 2,
    escalationAfterDays: 5,
    notes: "Dopo 3 giorni senza risposta: follow-up email. Dopo 5 giorni: LinkedIn connection.",
  },
  holding: {
    allowedChannels: ["email", "linkedin"],
    minDaysBetweenContacts: 5,
    maxContactsPerWeek: 1,
    escalationAfterDays: 14,
    notes: "Nurturing lento. Alternare email e LinkedIn. Un contatto ogni 5-7 giorni.",
  },
  engaged: {
    allowedChannels: ["email", "linkedin", "whatsapp"],
    minDaysBetweenContacts: 2,
    maxContactsPerWeek: 3,
    escalationAfterDays: 7,
    notes: "Il contatto risponde. Tutti i canali aperti. WhatsApp solo se il contatto l'ha usato prima.",
  },
  qualified: {
    allowedChannels: ["email", "linkedin", "whatsapp"],
    minDaysBetweenContacts: 1,
    maxContactsPerWeek: 5,
    escalationAfterDays: 3,
    notes: "Lead qualificato. Contatti frequenti. Focus su call/meeting scheduling.",
  },
  negotiation: {
    allowedChannels: ["email", "whatsapp"],
    minDaysBetweenContacts: 1,
    maxContactsPerWeek: 7,
    escalationAfterDays: 2,
    notes: "Trattativa attiva. Risposte rapide. WhatsApp per follow-up veloci.",
  },
  converted: {
    allowedChannels: ["email", "whatsapp", "linkedin"],
    minDaysBetweenContacts: 7,
    maxContactsPerWeek: 1,
    escalationAfterDays: 30,
    notes: "Cliente acquisito. Contatto di mantenimento. Auguri, aggiornamenti, cross-sell.",
  },
  archived: {
    allowedChannels: [],
    minDaysBetweenContacts: 90,
    maxContactsPerWeek: 0,
    escalationAfterDays: 999,
    notes: "Contatto archiviato. Nessun contatto automatico. Solo riattivazione manuale.",
  },
};

// ── Sequenza contatto per primo engagement ──
// Definisce l'ordine ESATTO dei touchpoint per un nuovo contatto
export interface TouchpointStep {
  day: number; // giorno relativo al primo contatto (0 = giorno del primo invio)
  channel: "email" | "linkedin" | "whatsapp";
  action: string;
  condition?: string; // condizione per eseguire questo step
}

export const FIRST_ENGAGEMENT_SEQUENCE: TouchpointStep[] = [
  { day: 0, channel: "email", action: "cold_outreach", condition: undefined },
  { day: 3, channel: "email", action: "follow_up_1", condition: "no_reply" },
  { day: 5, channel: "linkedin", action: "connection_request", condition: "no_reply" },
  { day: 7, channel: "email", action: "follow_up_2_value_add", condition: "no_reply" },
  { day: 10, channel: "linkedin", action: "linkedin_message", condition: "no_reply AND linkedin_connected" },
  { day: 14, channel: "email", action: "breakup_email", condition: "no_reply" },
  // Se dopo 14 giorni nessuna risposta → stato passa a "holding"
];

// ── Funzione di verifica cadenza ──
export interface CadenceCheckResult {
  allowed: boolean;
  reason?: string;
  suggestedChannel?: "email" | "linkedin" | "whatsapp";
  nextAllowedDate?: string;
  currentStep?: number; // step nella sequenza di primo engagement
}

export function checkCadence(
  commercialState: string,
  lastContactDate: string | null, // ISO date
  lastChannel: string | null,
  totalTouchesThisWeek: number,
  channel: "email" | "linkedin" | "whatsapp",
  hasWhatsAppConsent: boolean,
): CadenceCheckResult {
  const rule = CADENCE_BY_STATE[commercialState] || CADENCE_BY_STATE.holding;

  // 1. Canale permesso?
  if (!rule.allowedChannels.includes(channel)) {
    return {
      allowed: false,
      reason: `Canale ${channel} non permesso in stato "${commercialState}". Canali ammessi: ${rule.allowedChannels.join(", ") || "nessuno"}`,
      suggestedChannel: rule.allowedChannels[0] || undefined,
    };
  }

  // 2. WhatsApp check consenso
  if (channel === "whatsapp" && !hasWhatsAppConsent && commercialState !== "negotiation") {
    return {
      allowed: false,
      reason: "WhatsApp richiede consenso esplicito del contatto (numero fornito o contatto iniziato da lui)",
      suggestedChannel: "email",
    };
  }

  // 3. Frequenza settimanale
  if (totalTouchesThisWeek >= rule.maxContactsPerWeek) {
    return {
      allowed: false,
      reason: `Limite settimanale raggiunto: ${totalTouchesThisWeek}/${rule.maxContactsPerWeek} contatti questa settimana`,
    };
  }

  // 4. Intervallo minimo
  if (lastContactDate) {
    const lastDate = new Date(lastContactDate);
    const daysSince = Math.floor((Date.now() - lastDate.getTime()) / 86400000);
    if (daysSince < rule.minDaysBetweenContacts) {
      const nextDate = new Date(lastDate.getTime() + rule.minDaysBetweenContacts * 86400000);
      return {
        allowed: false,
        reason: `Troppo presto: ultimo contatto ${daysSince} giorni fa, minimo ${rule.minDaysBetweenContacts} giorni`,
        nextAllowedDate: nextDate.toISOString().split("T")[0],
        suggestedChannel: channel, // stesso canale ma dopo
      };
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
  if (hasReply) return null; // Sequenza interrotta: il contatto ha risposto

  for (let i = 0; i < FIRST_ENGAGEMENT_SEQUENCE.length; i++) {
    const step = FIRST_ENGAGEMENT_SEQUENCE[i];
    if (completedSteps.includes(i)) continue;
    if (daysSinceFirstTouch < step.day) continue;

    // Verifica condizioni
    if (step.condition) {
      if (step.condition.includes("no_reply") && hasReply) continue;
      if (step.condition.includes("linkedin_connected") && !hasLinkedInConnection) continue;
    }

    return step;
  }
  return null; // Sequenza completata
}
