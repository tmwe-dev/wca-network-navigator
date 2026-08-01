// === EmailTypeDetector (LOVABLE-82) ===
// Riconcilia tipo, descrizione, history e stato del partner. Produce un
// ResolvedEmailType che il generatore DEVE usare. È il "guardrail unico" che
// mancava: un solo posto dove tipo+descrizione+history+stato vengono verificati
// insieme, PRIMA della generazione.

import type { EmailContract, ResolvedEmailType, TypeConflict } from "./emailContract.ts";

const FIRST_CONTACT_TYPES = [
  "primo_contatto",
  "primo contatto",
  "first_contact",
  "cold_outreach",
  "introduction",
];
const FOLLOWUP_TYPES = ["follow_up", "follow-up", "followup", "ricontatto", "reminder"];
const RELATIONSHIP_TYPES = [
  "proposta",
  "proposal",
  "negoziazione",
  "offerta",
  "quotation",
  "onboarding",
];
const CLOSING_TYPES = [
  "proposta",
  "chiusura",
  "contratto",
  "proposal",
  "closing",
  "quotation",
];
const PHASE_ORDER = [
  "new",
  "first_touch_sent",
  "holding",
  "engaged",
  "qualified",
  "negotiation",
  "converted",
];
const RELATIONSHIP_SIGNALS = [
  "come discusso",
  "in seguito a",
  "riferimento al nostro",
  "come concordato",
  "as discussed",
  "following up",
  "as we discussed",
];
const FIRST_CONTACT_SIGNALS = [
  "presentarmi",
  "conoscere",
  "introduce",
  "vorrei presentare",
  "first time",
  "mi presento",
];

function includesAny(haystack: string, needles: string[]): string | null {
  for (const n of needles) if (haystack.includes(n)) return n;
  return null;
}

export function detectEmailType(contract: EmailContract): ResolvedEmailType {
  const conflicts: TypeConflict[] = [];
  const selectedType = (contract.email_type.selected_type || "").toLowerCase().trim();
  const description = (contract.email_type.user_description || "").toLowerCase().trim();
  const leadStatus = contract.recipient.lead_status;
  const touchCount = contract.relationship.touch_count;
  const hasReplied = contract.relationship.has_replied;
  const daysSinceOutbound = contract.relationship.days_since_last_outbound;

  let resolvedType = selectedType;
  let wasOverridden = false;

  // CHECK 1: Primo contatto ma history dice altrimenti
  if (FIRST_CONTACT_TYPES.some((t) => selectedType.includes(t))) {
    if (touchCount > 0) {
      conflicts.push({
        type: "type_history_mismatch",
        description: `Tipo "${selectedType}" ma esistono già ${touchCount} comunicazioni precedenti`,
        severity: touchCount >= 3 ? "blocking" : "warning",
        suggestion: hasReplied
          ? "Usa 'follow-up' o 'approfondimento'"
          : "Usa 'follow-up primo contatto' o 're-engagement'",
      });
      if (touchCount >= 3) {
        resolvedType = hasReplied ? "follow_up" : "re_engagement";
        wasOverridden = true;
      }
    }
  }

  // CHECK 2: Follow-up ma partner mai contattato
  if (FOLLOWUP_TYPES.some((t) => selectedType.includes(t))) {
    if (leadStatus === "new" && touchCount === 0) {
      conflicts.push({
        type: "type_status_mismatch",
        description: `Tipo "${selectedType}" ma il partner è "new" con 0 comunicazioni — non c'è nulla da follow-uppare`,
        severity: "blocking",
        suggestion: "Usa 'primo contatto' o 'introduction'",
      });
      resolvedType = "primo_contatto";
      wasOverridden = true;
    }
  }

  // CHECK 3: Tipo richiede relazione ma partner ancora non avviato
  if (RELATIONSHIP_TYPES.some((t) => selectedType.includes(t))) {
    if (leadStatus === "new" || leadStatus === "first_touch_sent") {
      conflicts.push({
        type: "type_status_mismatch",
        description: `Tipo "${selectedType}" richiede relazione avviata, ma il partner è "${leadStatus}"`,
        severity: "warning",
        suggestion: `Prima avanza la relazione almeno a "engaged" prima di inviare ${selectedType}`,
      });
    }
  }

  // CHECK 4: Holding pattern — minimo 7gg
  if (leadStatus === "holding") {
    if (daysSinceOutbound !== undefined && daysSinceOutbound < 7) {
      conflicts.push({
        type: "status_channel_mismatch",
        description: `Partner in "holding" (circuito di attesa). Ultimo contatto ${daysSinceOutbound} giorni fa, minimo 7`,
        severity: "blocking",
        suggestion:
          "Aspetta almeno 7 giorni dal circuito di attesa, oppure cambia stato se il partner ha risposto",
      });
    }
  }

  // CHECK 5: Descrizione contraddice il tipo
  if (description) {
    if (FIRST_CONTACT_TYPES.some((t) => selectedType.includes(t))) {
      const sig = includesAny(description, RELATIONSHIP_SIGNALS);
      if (sig) {
        conflicts.push({
          type: "description_type_mismatch",
          description: `Tipo "${selectedType}" ma la descrizione contiene segnali di relazione esistente ("${sig}")`,
          severity: "warning",
          suggestion: "Verifica il tipo: sembra un follow-up, non un primo contatto",
        });
      }
    }
    if (FOLLOWUP_TYPES.some((t) => selectedType.includes(t))) {
      const sig = includesAny(description, FIRST_CONTACT_SIGNALS);
      if (sig) {
        conflicts.push({
          type: "description_type_mismatch",
          description: `Tipo "${selectedType}" ma la descrizione contiene segnali di primo contatto ("${sig}")`,
          severity: "warning",
          suggestion: "Verifica il tipo: sembra un primo contatto, non un follow-up",
        });
      }
    }
  }

  // CHECK 6: Email recente sullo stesso canale
  if (
    daysSinceOutbound !== undefined &&
    daysSinceOutbound < 2 &&
    contract.relationship.last_channel === "email"
  ) {
    conflicts.push({
      type: "duplicate_recent",
      description: `Email inviata ${daysSinceOutbound} giorni fa allo stesso partner. Possibile duplicato.`,
      severity: "warning",
      suggestion: "Verifica di non star inviando un duplicato. Considera di aspettare una risposta.",
    });
  }

  // CHECK 7: Salto di fase troppo grande
  if (CLOSING_TYPES.some((t) => selectedType.includes(t))) {
    const currentPhaseIdx = PHASE_ORDER.indexOf(leadStatus);
    if (currentPhaseIdx >= 0 && currentPhaseIdx < 3) {
      conflicts.push({
        type: "phase_skip",
        description: `Tipo "${selectedType}" (fase avanzata) su partner in "${leadStatus}" (fase iniziale). Salto di almeno ${
          3 - currentPhaseIdx
        } fasi.`,
        severity: "blocking",
        suggestion: "Porta il partner almeno a 'qualified' prima di proporre chiusura/offerta",
      });
    }
  }

  const blockingConflicts = conflicts.filter((c) => c.severity === "blocking");
  const warningConflicts = conflicts.filter((c) => c.severity === "warning");

  let confidence = 1.0;
  confidence -= blockingConflicts.length * 0.3;
  confidence -= warningConflicts.length * 0.1;
  confidence = Math.max(0, Math.min(1, confidence));

  const proceed = blockingConflicts.length === 0;

  return {
    original_type: contract.email_type.selected_type,
    resolved_type: resolvedType,
    was_overridden: wasOverridden,
    confidence,
    reasoning:
      conflicts.length === 0
        ? `Tipo "${selectedType}" coerente con stato "${leadStatus}" e history (${touchCount} comunicazioni)`
        : `${conflicts.length} conflitti rilevati: ${conflicts.map((c) => c.type).join(", ")}`,
    conflicts,
    proceed,
  };
}