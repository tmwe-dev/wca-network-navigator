/**
 * Pipeline pre-configurate per il deep search dei contatti/partner.
 *
 * Ogni pipeline è una sequenza di step `agent-sequence` eseguibile dall'estensione
 * Partner Connect. Lo step set sfrutta `background: true, reuseTab: true` quando
 * disponibile, in modo da riusare un singolo tab nascosto.
 *
 * NB: i template usano la sintassi `{{var}}` che viene espansa al momento dell'esecuzione.
 */

export interface DeepSearchPipeline {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  /** Variabili obbligatorie da passare a runDeepSearchPipeline. */
  readonly requiredVars: ReadonlyArray<string>;
  /** Steps in formato `agent-sequence` di Partner Connect. */
  readonly steps: ReadonlyArray<Record<string, unknown>>;
}

const COMMON = { background: true, reuseTab: true } as const;

export const PIPELINE_GOOGLE_MAPS: DeepSearchPipeline = {
  id: "deep-google-maps",
  label: "Google Maps / Place",
  description: "Cerca l'azienda su Google Maps e estrae scheda Place (indirizzo, telefono, sito, ore, recensioni).",
  requiredVars: ["companyName", "city"],
  steps: [
    { action: "nav", url: "https://www.google.com/maps/search/{{companyName}}+{{city}}", ...COMMON },
    { action: "wait", ms: 2500 },
    { action: "scrape", format: "markdown", ...COMMON },
  ],
};

export const PIPELINE_WEBSITE_MULTI_PAGE: DeepSearchPipeline = {
  id: "deep-website-multipage",
  label: "Sito web multi-pagina",
  description: "Map del sito ufficiale + scrape parallelo di home, about, team, contact.",
  requiredVars: ["websiteUrl"],
  steps: [
    { action: "nav", url: "{{websiteUrl}}", ...COMMON },
    { action: "wait", ms: 1500 },
    { action: "scrape", format: "markdown", ...COMMON },
    { action: "nav", url: "{{websiteUrl}}/about", ...COMMON },
    { action: "wait", ms: 1500 },
    { action: "scrape", format: "markdown", ...COMMON },
    { action: "nav", url: "{{websiteUrl}}/team", ...COMMON },
    { action: "wait", ms: 1500 },
    { action: "scrape", format: "markdown", ...COMMON },
    { action: "nav", url: "{{websiteUrl}}/contact", ...COMMON },
    { action: "wait", ms: 1500 },
    { action: "scrape", format: "markdown", ...COMMON },
  ],
};

export const PIPELINE_REPUTATION: DeepSearchPipeline = {
  id: "deep-reputation",
  label: "Reputation & news",
  description: "Cerca menzioni, recensioni e news dell'azienda su Google (filtro ultimi 12 mesi).",
  requiredVars: ["companyName"],
  steps: [
    { action: "nav", url: "https://www.google.com/search?q=%22{{companyName}}%22+(reviews+OR+news+OR+complaints)&tbs=qdr:y", ...COMMON },
    { action: "wait", ms: 2000 },
    { action: "scrape", format: "markdown", ...COMMON },
  ],
};

export const PIPELINE_GOOGLE_GENERAL: DeepSearchPipeline = {
  id: "deep-google-general",
  label: "Google generale (presenza web)",
  description: "Ricerca Google generica per scoprire altre presenze web dell'azienda/persona.",
  requiredVars: ["query"],
  steps: [
    { action: "nav", url: "https://www.google.com/search?q={{query}}", ...COMMON },
    { action: "wait", ms: 2000 },
    { action: "scrape", format: "markdown", ...COMMON },
  ],
};

export const ALL_PIPELINES = {
  googleMaps: PIPELINE_GOOGLE_MAPS,
  websiteMultiPage: PIPELINE_WEBSITE_MULTI_PAGE,
  reputation: PIPELINE_REPUTATION,
  googleGeneral: PIPELINE_GOOGLE_GENERAL,
} as const satisfies Record<string, DeepSearchPipeline>;

export type PipelineKey = keyof typeof ALL_PIPELINES;

/** Espande i `{{var}}` nei valori string di uno step. */
function expandStep(
  step: Record<string, unknown>,
  vars: Record<string, string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(step)) {
    if (typeof v === "string") {
      out[k] = v.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
        const value = vars[key];
        if (value === undefined) return "";
        return encodeURIComponent(value);
      });
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Risolve i template di una pipeline restituendo gli step pronti per `agent-sequence`.
 * NON esegue la pipeline — quella è responsabilità di chi importa il bridge.
 */
export function resolvePipelineSteps(
  pipeline: DeepSearchPipeline,
  vars: Record<string, string>,
): Array<Record<string, unknown>> {
  const missing = pipeline.requiredVars.filter((v) => !vars[v]);
  if (missing.length > 0) {
    throw new Error(
      `Pipeline "${pipeline.id}" richiede le variabili: ${missing.join(", ")}`,
    );
  }
  return pipeline.steps.map((step) => expandStep(step, vars));
}
