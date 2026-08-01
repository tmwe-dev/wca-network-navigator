/**
 * Oracle coherence — detect mismatch between email type and user description
 */

const FOLLOWUP_KEYWORDS = [
  "follow", "follow-up", "follow up", "ricordare", "ricordo", "ricord",
  "abbiamo parlato", "abbiamo già", "abbiamo gia", "ti avevo scritto",
  "ti scrivo di nuovo", "ripren", "riprendo", "ripresa", "come da",
  "tornare", "rispondo a", "risposta a", "in seguito", "dopo la nostra",
  "dopo il nostro", "come anticipato", "come anticipava",
];

const FIRST_CONTACT_KEYWORDS = [
  "presentar", "mi presento", "ci presentiamo", "primo contatto",
  "prima volta", "non ci conosciamo", "vi scrivo per la prima",
];

const PROPOSAL_KEYWORDS = [
  "proposta", "offerta", "preventivo", "quotazione", "tariff",
];

export interface CoherenceCheck {
  ok: boolean;
  warning: string | null;
  suggestion: string | null;
}

export function checkOracleCoherence(
  emailTypeId: string | null,
  customGoal: string,
): CoherenceCheck {
  const goal = (customGoal || "").toLowerCase();
  if (!emailTypeId || !goal.trim()) return { ok: true, warning: null, suggestion: null };

  if (emailTypeId === "primo_contatto") {
    const hasFollowupHints = FOLLOWUP_KEYWORDS.some((k) => goal.includes(k));
    if (hasFollowupHints) {
      return {
        ok: false,
        warning: 'La descrizione suggerisce un follow-up ma il tipo selezionato è "Primo contatto".',
        suggestion: "Cambia tipo in 'Follow-up' o riformula la descrizione.",
      };
    }
  }

  if (emailTypeId === "follow_up") {
    const hasFirstContactHints = FIRST_CONTACT_KEYWORDS.some((k) => goal.includes(k));
    if (hasFirstContactHints) {
      return {
        ok: false,
        warning: 'La descrizione sembra un primo contatto ma il tipo selezionato è "Follow-up".',
        suggestion: "Cambia tipo in 'Primo contatto' o riformula.",
      };
    }
  }

  if (emailTypeId === "richiesta_info" || emailTypeId === "partnership") {
    const hasProposalHints = PROPOSAL_KEYWORDS.some((k) => goal.includes(k));
    if (hasProposalHints) {
      return {
        ok: false,
        warning: 'La descrizione contiene termini commerciali da "Proposta".',
        suggestion: "Considera di cambiare tipo in 'Proposta'.",
      };
    }
  }

  return { ok: true, warning: null, suggestion: null };
}

export function getCustomGoalPlaceholder(emailTypeId: string | null): string {
  switch (emailTypeId) {
    case "primo_contatto":
      return "Es. Presentazione iniziale per esplorare collaborazione su tratta Italia-USA…";
    case "follow_up":
      return "Es. Riprendere conversazione del 15 marzo dopo fiera Monaco…";
    case "richiesta_info":
      return "Es. Richiedere capacità mensile e tariffe air freight per Cina…";
    case "proposta":
      return "Es. Proposta tariffaria FCL Genova-Singapore valida 30 giorni…";
    case "partnership":
      return "Es. Proporre partnership operativa esclusiva sul corridoio nordeuropeo…";
    case "network_espresso":
      return "Es. Saluti rapidi network WCA con aggiornamento servizi 2026…";
    default:
      return "Descrivi l'obiettivo della email…";
  }
}
