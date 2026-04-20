/**
 * Pipeline pre-configurate per il deep search dei contatti/partner.
 *
 * Modello semplificato (allineato all'API reale di Partner Connect v3.4.0):
 * ogni pipeline produce una lista di URL da leggere. L'esecutore (DeepSearchCanvas)
 * per ogni URL invoca:
 *   1) agent-action { action:"navigate", url, background:true, reuseTab:true }
 *   2) attesa client-side (settleMs)
 *   3) action:"scrape" — legge il BackgroundTab già aperto
 *
 * Questo è l'unico flusso supportato dall'estensione (vedi background.js
 * handleAgentAction fast-path navigate+background, e handleScrape che preferisce
 * BackgroundTab.tabId quando aperto).
 */

export interface DeepSearchPipeline {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly requiredVars: ReadonlyArray<string>;
  /** Costruisce la lista di URL da leggere a partire dalle variabili. */
  buildUrls(vars: Record<string, string>): string[];
  /** ms di attesa client-side dopo il navigate, prima dello scrape. Default 2500. */
  readonly settleMs?: number;
}

function enc(s: string): string {
  return encodeURIComponent(s ?? "");
}

export const PIPELINE_GOOGLE_MAPS: DeepSearchPipeline = {
  id: "deep-google-maps",
  label: "Google Maps / Place",
  description: "Cerca l'azienda su Google Maps: scheda Place (indirizzo, telefono, sito, ore).",
  requiredVars: ["companyName"],
  settleMs: 3000,
  buildUrls: (v) => [
    `https://www.google.com/maps/search/${enc(v.companyName)}+${enc(v.city ?? "")}`,
  ],
};

export const PIPELINE_WEBSITE_MULTI_PAGE: DeepSearchPipeline = {
  id: "deep-website-multipage",
  label: "Sito web multi-pagina",
  description: "Home + about + team + contact del sito ufficiale.",
  requiredVars: ["websiteUrl"],
  settleMs: 1800,
  buildUrls: (v) => {
    const base = (v.websiteUrl ?? "").replace(/\/+$/, "");
    return [base, `${base}/about`, `${base}/team`, `${base}/contact`];
  },
};

export const PIPELINE_REPUTATION: DeepSearchPipeline = {
  id: "deep-reputation",
  label: "Reputation & news",
  description: "Menzioni, recensioni e news dell'azienda su Google (ultimo anno).",
  requiredVars: ["companyName"],
  settleMs: 2500,
  buildUrls: (v) => [
    `https://www.google.com/search?q=%22${enc(v.companyName)}%22+(reviews+OR+news+OR+complaints)&tbs=qdr:y`,
  ],
};

export const PIPELINE_GOOGLE_GENERAL: DeepSearchPipeline = {
  id: "deep-google-general",
  label: "Google generale (presenza web)",
  description: "Ricerca Google generica per scoprire presenze web dell'azienda.",
  requiredVars: ["query"],
  settleMs: 2500,
  buildUrls: (v) => [
    `https://www.google.com/search?q=${enc(v.query)}`,
  ],
};

export const ALL_PIPELINES = {
  googleMaps: PIPELINE_GOOGLE_MAPS,
  websiteMultiPage: PIPELINE_WEBSITE_MULTI_PAGE,
  reputation: PIPELINE_REPUTATION,
  googleGeneral: PIPELINE_GOOGLE_GENERAL,
} as const satisfies Record<string, DeepSearchPipeline>;

export type PipelineKey = keyof typeof ALL_PIPELINES;

/** Risolve una pipeline → lista URL pronti, validando le variabili obbligatorie. */
export function resolvePipelineUrls(
  pipeline: DeepSearchPipeline,
  vars: Record<string, string>,
): { urls: string[]; settleMs: number } {
  const missing = pipeline.requiredVars.filter((v) => !vars[v]);
  if (missing.length > 0) {
    throw new Error(`Pipeline "${pipeline.id}" richiede: ${missing.join(", ")}`);
  }
  const urls = pipeline.buildUrls(vars).filter((u) => /^https?:\/\//i.test(u));
  if (urls.length === 0) {
    throw new Error(`Pipeline "${pipeline.id}" non ha prodotto URL validi`);
  }
  return { urls, settleMs: pipeline.settleMs ?? 2500 };
}
