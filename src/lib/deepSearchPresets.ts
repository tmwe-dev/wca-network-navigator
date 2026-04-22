/**
 * deepSearchPresets — Policy unica: Quality (Fast/Standard/Premium) determina
 * automaticamente quali fonti vengono lette dal Deep Search.
 *
 * V2 (2026-04): aggiunte 4 nuove fonti opzionali, attivabili anche granularmente
 * dalla sidebar (non più solo via preset shortcut):
 *  - googleGeneral: ricerca Google senza site:linkedin per trovare menzioni varie
 *  - googleMaps: scrape pannello Google Maps (indirizzo, tel, orari, rating)
 *  - websiteMultiPage: naviga /about /team /contacts e estrae team con AI
 *  - reputation: Trustpilot + Google News + Wikipedia
 */

export type DeepSearchQuality = "fast" | "standard" | "premium";

/** Set completo di sorgenti che il Deep Search può consultare. */
export interface DeepSearchSources {
  googleSerp: boolean;
  websiteHome: boolean;
  websiteAbout: boolean;
  linkedinContacts: boolean;
  linkedinCompany: boolean;
  linkedinPosts: boolean;
  whatsapp: boolean;
  googleNews30d: boolean;
  /** Nuove fonti V2 */
  googleGeneral: boolean;
  googleMaps: boolean;
  websiteMultiPage: boolean;
  reputation: boolean;
  maxQueriesPerContact: number;
}

interface DeepSearchPresetMeta {
  quality: DeepSearchQuality;
  label: string;
  description: string;
  includedLabels: string[];
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
    googleGeneral: false,
    googleMaps: false,
    websiteMultiPage: false,
    reputation: false,
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
    googleGeneral: false,
    googleMaps: true,
    websiteMultiPage: false,
    reputation: false,
    maxQueriesPerContact: 4,
  },
  premium: {
    googleSerp: true,
    websiteHome: true,
    websiteAbout: true,
    linkedinContacts: true,
    linkedinCompany: true,
    linkedinPosts: false, // disattivato come da scelta utente: no scraping deep LinkedIn
    whatsapp: true,
    googleNews30d: true,
    googleGeneral: true,
    googleMaps: true,
    websiteMultiPage: true,
    reputation: true,
    maxQueriesPerContact: 5,
  },
};

const META: Record<DeepSearchQuality, DeepSearchPresetMeta> = {
  fast: {
    quality: "fast",
    label: "Fast",
    description: "Verifica veloce: Google + homepage del sito.",
    includedLabels: ["Google SERP", "Sito home"],
    estimatedSecondsPerRecord: 8,
  },
  standard: {
    quality: "standard",
    label: "Standard",
    description: "Bilanciato: aggiunge LinkedIn, About, WhatsApp, Google Maps.",
    includedLabels: ["Google SERP", "Sito home + About", "LinkedIn", "WhatsApp", "Google Maps"],
    estimatedSecondsPerRecord: 25,
  },
  premium: {
    quality: "premium",
    label: "Premium",
    description: "Massima profondità: tutte le fonti incluso sito multi-pagina, reputation e news.",
    includedLabels: [
      "Google SERP + generale",
      "Sito multi-pagina (about/team/contacts)",
      "LinkedIn contatti + azienda",
      "WhatsApp",
      "Google Maps / Place",
      "Reputation (Trustpilot + News + Wikipedia)",
    ],
    estimatedSecondsPerRecord: 90,
  },
};

export function getDeepSearchSources(quality: DeepSearchQuality): DeepSearchSources {
  return PRESETS[quality];
}

export function getDeepSearchMeta(quality: DeepSearchQuality): DeepSearchPresetMeta {
  return META[quality];
}

/**
 * Definizione human-friendly di ogni fonte, per la checklist granulare.
 */
interface SourceDescriptor {
  key: keyof DeepSearchSources;
  label: string;
  description: string;
  icon: "search" | "globe" | "users" | "linkedin" | "whatsapp" | "map" | "star" | "newspaper";
  group: "google" | "site" | "social" | "extra";
}

const SOURCE_DESCRIPTORS: SourceDescriptor[] = [
  { key: "googleSerp", label: "Google SERP cascade", description: "Cerca link verificati con cascade di query", icon: "search", group: "google" },
  { key: "googleGeneral", label: "Google generale (no LinkedIn)", description: "Menzioni sui media e directory settoriali", icon: "search", group: "google" },
  { key: "googleNews30d", label: "Google News (30gg)", description: "Notizie recenti sull'azienda", icon: "newspaper", group: "google" },
  { key: "websiteHome", label: "Sito web — homepage", description: "Favicon, qualità grafica e contenuto", icon: "globe", group: "site" },
  { key: "websiteAbout", label: "Sito web — pagina About", description: "Value proposition e mission", icon: "globe", group: "site" },
  { key: "websiteMultiPage", label: "Sito web — multi-pagina (team/contatti)", description: "Naviga /team /contacts /chi-siamo per scoprire team e indirizzi", icon: "users", group: "site" },
  { key: "linkedinContacts", label: "LinkedIn contatti (URL)", description: "Trova URL profili personali via Google", icon: "linkedin", group: "social" },
  { key: "linkedinCompany", label: "LinkedIn azienda (URL)", description: "Trova URL pagina /company", icon: "linkedin", group: "social" },
  { key: "whatsapp", label: "WhatsApp (wa.me)", description: "Costruisce link chat dal numero mobile", icon: "whatsapp", group: "social" },
  { key: "googleMaps", label: "Google Maps / Place", description: "Indirizzo, tel, orari, rating, recensioni count", icon: "map", group: "extra" },
  { key: "reputation", label: "Reputation (Trustpilot + Wikipedia)", description: "Rating Trustpilot e voce Wikipedia se esistono", icon: "star", group: "extra" },
];

/**
 * Adatta il preset al formato legacy DeepSearchConfig usato dallo store v2.
 */
export function presetToForgeConfig(quality: DeepSearchQuality, priorityDomain = ""): {
  scrapeWebsite: boolean;
  linkedinContacts: boolean;
  linkedinCompany: boolean;
  whatsapp: boolean;
  googleGeneral: boolean;
  googleMaps: boolean;
  websiteMultiPage: boolean;
  reputation: boolean;
  maxQueriesPerContact: number;
  priorityDomain: string;
} {
  const s = PRESETS[quality];
  return {
    scrapeWebsite: s.websiteHome || s.websiteAbout,
    linkedinContacts: s.linkedinContacts,
    linkedinCompany: s.linkedinCompany,
    whatsapp: s.whatsapp,
    googleGeneral: s.googleGeneral,
    googleMaps: s.googleMaps,
    websiteMultiPage: s.websiteMultiPage,
    reputation: s.reputation,
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
