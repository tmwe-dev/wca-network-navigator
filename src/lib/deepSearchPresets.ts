/**
 * deepSearchPresets — Policy unica: Quality (Fast/Standard/Premium) determina
 * automaticamente quali fonti vengono lette dal Deep Search.
 *
 * Mappa concordata:
 *  - Fast      → Google + sito home (verifica esistenza + favicon + quality score)
 *  - Standard  → + LinkedIn contatti/azienda + pagina About del sito
 *  - Premium   → + post LinkedIn (ultimi 3-5) + Google News azienda (30gg)
 */

export type DeepSearchQuality = "fast" | "standard" | "premium";

/** Set completo di sorgenti che il Deep Search può consultare. */
export interface DeepSearchSources {
  /** Cascade Google SERP per trovare link verificati. */
  googleSerp: boolean;
  /** Scrape della homepage del sito aziendale (favicon + quality score). */
  websiteHome: boolean;
  /** Scrape pagina /about del sito aziendale per value proposition. */
  websiteAbout: boolean;
  /** Cerca profili LinkedIn dei contatti (snippet SERP). */
  linkedinContacts: boolean;
  /** Cerca pagina LinkedIn azienda (snippet SERP). */
  linkedinCompany: boolean;
  /** Estrae ultimi post LinkedIn (richiede estensione loggata). */
  linkedinPosts: boolean;
  /** Verifica numero WhatsApp (mobile→wa.me). */
  whatsapp: boolean;
  /** Cerca news Google ultimi 30 giorni sull'azienda. */
  googleNews30d: boolean;
  /** Numero massimo di query Google nella cascade per contatto. */
  maxQueriesPerContact: number;
}

export interface DeepSearchPresetMeta {
  quality: DeepSearchQuality;
  label: string;
  description: string;
  /** Etichette user-friendly delle fonti incluse, per il badge. */
  includedLabels: string[];
  /** Stima durata indicativa per partner. */
  estimatedSecondsPerRecord: number;
}

const PRESETS: Record<DeepSearchQuality, DeepSearchSources> = {
  fast: {
    googleSerp: true,
    websiteHome: true,
    websiteAbout: false,
    linkedinContacts: false,
    linkedinCompany: false,
    linkedinPosts: false,
    whatsapp: false,
    googleNews30d: false,
    maxQueriesPerContact: 2,
  },
  standard: {
    googleSerp: true,
    websiteHome: true,
    websiteAbout: true,
    linkedinContacts: true,
    linkedinCompany: true,
    linkedinPosts: false,
    whatsapp: true,
    googleNews30d: false,
    maxQueriesPerContact: 4,
  },
  premium: {
    googleSerp: true,
    websiteHome: true,
    websiteAbout: true,
    linkedinContacts: true,
    linkedinCompany: true,
    linkedinPosts: true,
    whatsapp: true,
    googleNews30d: true,
    maxQueriesPerContact: 5,
  },
};

const META: Record<DeepSearchQuality, DeepSearchPresetMeta> = {
  fast: {
    quality: "fast",
    label: "Fast",
    description: "Verifica veloce: solo Google + homepage del sito.",
    includedLabels: ["Google SERP", "Sito home"],
    estimatedSecondsPerRecord: 8,
  },
  standard: {
    quality: "standard",
    label: "Standard",
    description: "Bilanciato: aggiunge LinkedIn contatti/azienda, pagina About e WhatsApp.",
    includedLabels: ["Google SERP", "Sito home + About", "LinkedIn contatti", "LinkedIn azienda", "WhatsApp"],
    estimatedSecondsPerRecord: 18,
  },
  premium: {
    quality: "premium",
    label: "Premium",
    description: "Massima profondità: include post LinkedIn recenti e Google News ultimi 30 giorni.",
    includedLabels: [
      "Google SERP",
      "Sito home + About",
      "LinkedIn contatti",
      "LinkedIn azienda",
      "Post LinkedIn (3-5 recenti)",
      "WhatsApp",
      "Google News 30gg",
    ],
    estimatedSecondsPerRecord: 35,
  },
};

export function getDeepSearchSources(quality: DeepSearchQuality): DeepSearchSources {
  return PRESETS[quality];
}

export function getDeepSearchMeta(quality: DeepSearchQuality): DeepSearchPresetMeta {
  return META[quality];
}

/**
 * Adatta il preset al formato legacy DeepSearchConfig usato dallo store v2.
 */
export function presetToForgeConfig(quality: DeepSearchQuality, priorityDomain = ""): {
  scrapeWebsite: boolean;
  linkedinContacts: boolean;
  linkedinCompany: boolean;
  whatsapp: boolean;
  maxQueriesPerContact: number;
  priorityDomain: string;
} {
  const s = PRESETS[quality];
  return {
    scrapeWebsite: s.websiteHome || s.websiteAbout,
    linkedinContacts: s.linkedinContacts,
    linkedinCompany: s.linkedinCompany,
    whatsapp: s.whatsapp,
    maxQueriesPerContact: s.maxQueriesPerContact,
    priorityDomain,
  };
}

/**
 * Adatta il preset al formato Mission (DeepSearchStep).
 */
export function presetToMissionConfig(quality: DeepSearchQuality): {
  enabled: boolean;
  scrapeWebsite: boolean;
  scrapeLinkedIn: boolean;
  verifyWhatsApp: boolean;
  aiAnalysis: boolean;
} {
  const s = PRESETS[quality];
  return {
    enabled: true,
    scrapeWebsite: s.websiteHome,
    scrapeLinkedIn: s.linkedinContacts || s.linkedinCompany,
    verifyWhatsApp: s.whatsapp,
    aiAnalysis: s.linkedinPosts || s.googleNews30d || quality !== "fast",
  };
}

/**
 * Adatta il preset al formato Cockpit DeepSearchOptionsDialog.
 */
export function presetToCockpitConfig(quality: DeepSearchQuality): {
  scrapeWebsite: boolean;
  scrapeLinkedin: boolean;
  verifyWhatsapp: boolean;
  aiAnalysis: boolean;
} {
  const s = PRESETS[quality];
  return {
    scrapeWebsite: s.websiteHome,
    scrapeLinkedin: s.linkedinContacts || s.linkedinCompany,
    verifyWhatsapp: s.whatsapp,
    aiAnalysis: s.linkedinPosts || s.googleNews30d || quality === "premium",
  };
}

export const ALL_QUALITIES: DeepSearchQuality[] = ["fast", "standard", "premium"];
