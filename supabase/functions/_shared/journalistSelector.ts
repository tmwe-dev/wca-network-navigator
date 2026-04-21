// === Giornalisti AI — Selettore + Config Loader (LOVABLE-80 v2) ===
import type {
  JournalistRole,
  JournalistSelection,
  JournalistConfig,
} from "./journalistTypes.ts";

const STATUS_TO_JOURNALIST: Record<string, JournalistRole | "contextual" | null> = {
  new: "rompighiaccio",
  first_touch_sent: "rompighiaccio",
  holding: "risvegliatore",
  engaged: "contextual",
  qualified: "chiusore",
  negotiation: "chiusore",
  converted: "accompagnatore",
  archived: "risvegliatore",
  blacklisted: null,
};

export const JOURNALIST_LABELS: Record<JournalistRole, string> = {
  rompighiaccio: "Rompighiaccio",
  risvegliatore: "Risvegliatore",
  chiusore: "Chiusore / Archiviatore",
  accompagnatore: "Accompagnatore",
};

export interface SelectionContext {
  touch_count?: number;
  last_outcome?: string;
  daysSinceLastInbound?: number;
  hasActiveConversation?: boolean;
}

/** Auto-selezione primaria. Restituisce null se blacklisted (= blocco totale). */
export function selectJournalist(
  leadStatus: string,
  context?: SelectionContext,
): JournalistSelection | null {
  if (leadStatus === "blacklisted") return null;

  const mapping = STATUS_TO_JOURNALIST[leadStatus];

  if (mapping === "contextual") {
    const days = context?.daysSinceLastInbound ?? 999;
    const outcome = context?.last_outcome;
    const hasConvo = context?.hasActiveConversation ?? false;
    const positive = outcome && ["interested", "question", "meeting_request"].includes(outcome);

    if (hasConvo || (positive && days < 5)) {
      return {
        role: "accompagnatore",
        label: JOURNALIST_LABELS.accompagnatore,
        reasoning: `Engaged con risposta positiva recente (${days}gg) → Accompagnatore`,
        auto: true,
      };
    }
    if (days > 5 || !outcome) {
      return {
        role: "risvegliatore",
        label: JOURNALIST_LABELS.risvegliatore,
        reasoning: `Engaged ma silenzio da ${days}gg → Risvegliatore`,
        auto: true,
      };
    }
    return {
      role: "accompagnatore",
      label: JOURNALIST_LABELS.accompagnatore,
      reasoning: "Engaged attivo → Accompagnatore default",
      auto: true,
    };
  }

  const role = (mapping as JournalistRole) || "rompighiaccio";
  return {
    role,
    label: JOURNALIST_LABELS[role],
    reasoning: `Stato "${leadStatus}" → ${JOURNALIST_LABELS[role]}`,
    auto: true,
  };
}

/** Valida un override manuale: se molto incoerente, restituisce un warning leggibile. */
export function validateOverride(
  overrideRole: JournalistRole,
  leadStatus: string,
  autoSelected: JournalistSelection,
): { valid: boolean; warning?: string } {
  const incoherent: Record<string, JournalistRole[]> = {
    new: ["chiusore", "accompagnatore"],
    first_touch_sent: ["chiusore"],
    converted: ["rompighiaccio"],
    negotiation: ["rompighiaccio"],
  };
  if (incoherent[leadStatus]?.includes(overrideRole)) {
    return {
      valid: true,
      warning: `Override ${JOURNALIST_LABELS[overrideRole]} su partner "${leadStatus}" è insolito. Auto era ${autoSelected.label}.`,
    };
  }
  return { valid: true };
}

/** Defaults per configurazione giornalista. */
export function getDefaultConfig(
  role: JournalistRole,
): Omit<JournalistConfig, "role" | "label"> {
  switch (role) {
    case "rompighiaccio":
      return {
        prompt:
          "Sei il Rompighiaccio. Apri il primo contatto senza vendere. Usi empatia tattica (Chris Voss): labeling, mirroring, domande calibrate, tecnica del no. Porta a riflettere su differenze concrete: meno complessità, più controllo, meno tempo perso. Mai presentarti come venditore. Mai elencare servizi.",
        tone: "Curioso, elegante, fermo, mai aggressivo",
        rules:
          "Non vendere prima del tempo. Usa labeling, mirroring, domande calibrate, tecnica del no. Porta a riflettere su differenze concrete.",
        kb_sources:
          "sales_doctrine, system_doctrine/Progressione_Relazionale, procedures/email-single, procedures/cold-outreach",
        donts:
          "Non vendere. Non elencare servizi. Non usare urgenza finta. Non adulare. Non promettere ciò che non è in KB.",
      };
    case "risvegliatore":
      return {
        prompt:
          "Sei il Risvegliatore. Intervieni dopo silenzio o risposta parziale. Non rincorri: trasformi il silenzio in scelta consapevole. Offri nuova prospettiva. Proponi micro-decisione: approfondire, rimandare con data, chiudere serenamente. Mai 'volevo solo fare follow-up'. Mai supplicare.",
        tone: "Breve, intelligente, rispettoso, stimolante",
        rules:
          "Non rincorrere MAI. Trasforma silenzio in scelta. Offri nuova prospettiva. Proponi micro-decisione.",
        kb_sources:
          "sales_doctrine, system_doctrine/Holding_Pattern, procedures/multi-channel-sequence, sales_doctrine/Chris_Voss",
        donts:
          "Non rincorrere. Non supplicare. Mai 'volevo solo fare follow-up'. Mai tono ansioso o colpevolizzante.",
      };
    case "chiusore":
      return {
        prompt:
          "Sei il Chiusore. Porti a decisione chiara. Proteggi tempo e autorevolezza. Chiarisci il valore. Esplicita che entrambe le scelte vanno bene. Proponi passo netto. L'archiviazione elegante è un risultato valido.",
        tone: "Pragmatico, competente, solido, diretto",
        rules:
          "Chiarisci il valore. Esplicita che entrambe le scelte vanno bene. Proponi passo netto. Archiviazione elegante è ok.",
        kb_sources:
          "sales_doctrine/Tecniche_chiusura, sales_doctrine/Gestione_obiezioni, system_doctrine/Dottrina_Uscite, procedures/lead-qualification-v2",
        donts:
          "Non manipolare. Non creare urgenza finta. Non forzare una risposta. Non sminuire la scelta di non procedere.",
      };
    case "accompagnatore":
      return {
        prompt:
          "Sei l'Accompagnatore. Continui la relazione dopo l'avvio. Proponi passi progressivi e operativi. Trasmetti presenza, competenza e continuità. Non sei assistente generico: sei consulente operativo che riduce complessità.",
        tone: "Utile, costante, consulenziale, operativo",
        rules:
          "Proponi passi progressivi. Trasmetti presenza e competenza. Riduci complessità. Costruisci continuità.",
        kb_sources:
          "sales_doctrine/Follow-up_pipeline, procedures/post-send-checklist, system_doctrine/Progressione_Relazionale",
        donts:
          "Non essere generico. Non ripetere ciò che il partner già sa. Non proporre troppo in una volta. Non perdere concretezza.",
      };
  }
}

/** Carica config giornalista da app_settings con fallback ai default. */
// deno-lint-ignore no-explicit-any
export async function loadJournalistConfig(
  supabase: any,
  userId: string,
  role: JournalistRole,
): Promise<JournalistConfig> {
  const prefix = `journalist_${role}`;
  const keys = [
    `${prefix}_prompt`,
    `${prefix}_tone`,
    `${prefix}_rules`,
    `${prefix}_kb_sources`,
    `${prefix}_donts`,
  ];

  const { data: settings } = await supabase
    .from("app_settings")
    .select("key, value")
    .eq("user_id", userId)
    .in("key", keys);

  const map = new Map<string, string>(
    (settings || []).map((s: { key: string; value: string | null }) => [s.key, s.value || ""]),
  );
  const defaults = getDefaultConfig(role);

  const get = (k: string, fallback: string): string => {
    const v = map.get(k);
    return v && v.trim().length > 0 ? v : fallback;
  };

  return {
    role,
    label: JOURNALIST_LABELS[role],
    prompt: get(`${prefix}_prompt`, defaults.prompt),
    tone: get(`${prefix}_tone`, defaults.tone),
    rules: get(`${prefix}_rules`, defaults.rules),
    kb_sources: get(`${prefix}_kb_sources`, defaults.kb_sources),
    donts: get(`${prefix}_donts`, defaults.donts),
  };
}

/** Carica impostazioni Optimus globali (toggle + mode + strictness). */
// deno-lint-ignore no-explicit-any
export async function loadOptimusSettings(
  supabase: any,
  userId: string,
): Promise<{ enabled: boolean; mode: "review_and_correct" | "review_only" | "silent_audit"; strictness: number }> {
  const { data } = await supabase
    .from("app_settings")
    .select("key, value")
    .eq("user_id", userId)
    .in("key", [
      "journalist_optimus_enabled",
      "journalist_optimus_mode",
      "journalist_optimus_strictness",
    ]);
  const map = new Map<string, string>(
    (data || []).map((s: { key: string; value: string | null }) => [s.key, s.value || ""]),
  );
  const enabledRaw = map.get("journalist_optimus_enabled") || "";
  const enabled = enabledRaw === "true" || enabledRaw === "1";
  const modeRaw = map.get("journalist_optimus_mode") || "review_and_correct";
  const mode = (["review_and_correct", "review_only", "silent_audit"].includes(modeRaw)
    ? modeRaw
    : "review_and_correct") as "review_and_correct" | "review_only" | "silent_audit";
  const strictness = Math.max(1, Math.min(10, parseInt(map.get("journalist_optimus_strictness") || "7", 10) || 7));
  return { enabled, mode, strictness };
}