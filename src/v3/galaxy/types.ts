/** Tipi della Galassia V3 — solo presentazione, nessun side-effect. */

export type V3GalaxyKind = "pagina" | "hook" | "logica" | "dal" | "ui" | "app" | "rpc" | "tabella";

export interface V3GalaxyNode {
  readonly id: string;
  readonly label: string;
  readonly kind: V3GalaxyKind;
  /** Modulo V3, oppure `dati` / `backend` / `design`. */
  readonly module: string;
  readonly detail: string;
  readonly weight: number;
  readonly path?: string;
}

export type V3GalaxyRelation = "usa" | "invoca" | "legge/scrive";

export interface V3GalaxyLink {
  readonly from: string;
  readonly to: string;
  readonly relation: V3GalaxyRelation;
}

export interface V3GalaxyDomain {
  readonly id: string;
  readonly label: string;
  /** HSL "h s% l%". */
  readonly hsl: string;
}

/** Bracci della galassia: i 7 moduli + trasversale + design + dati + backend. */
export const V3_GALAXY_DOMAINS: readonly V3GalaxyDomain[] = [
  { id: "identita", label: "Identità", hsl: "205 90% 62%" },
  { id: "contatti", label: "Contatti", hsl: "212 90% 66%" },
  { id: "messaggi", label: "Messaggi", hsl: "195 85% 60%" },
  { id: "comprensione", label: "Comprensione", hsl: "182 70% 58%" },
  { id: "risposta", label: "Risposta", hsl: "28 75% 58%" },
  { id: "programmazione", label: "Programmazione", hsl: "20 70% 55%" },
  { id: "tracciamento", label: "Tracciamento", hsl: "38 78% 60%" },
  { id: "trasversale", label: "Trasversale", hsl: "225 60% 66%" },
  { id: "design", label: "Design system", hsl: "268 55% 68%" },
  { id: "dati", label: "Livello dati", hsl: "160 55% 55%" },
  { id: "backend", label: "Backend", hsl: "16 55% 52%" },
];

export interface V3Graph {
  readonly nodes: readonly V3GalaxyNode[];
  readonly links: readonly V3GalaxyLink[];
  readonly stats: {
    readonly pagine: number;
    readonly hook: number;
    readonly dal: number;
    readonly ui: number;
    readonly rpc: number;
    readonly tabelle: number;
    readonly sinapsi: number;
  };
}
