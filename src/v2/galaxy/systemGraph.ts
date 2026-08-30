/**
 * systemGraph — modello dati della "Galassia di Sistema".
 *
 * Sorgenti reali:
 *  - `edgeFunctions.generated.ts` (inventario delle edge function del progetto)
 *  - `APP_MAP` (mappa pagine/campi/funzioni già usata da Command e KB)
 *  - inventario curato di origini dati e store persistenti
 *
 * Solo presentazione/lettura: nessun side-effect, nessuna scrittura.
 */
import { APP_MAP } from "@/v2/search/appMap";
import { EDGE_FUNCTIONS_BY_DOMAIN, EDGE_FUNCTION_COUNT } from "./edgeFunctions.generated";

export type GalaxyKind = "core" | "hub" | "brain" | "source" | "surface" | "store" | "external";

export interface GalaxyDomain {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  /** HSL "h s% l%" — usato sia da three.js sia dai badge UI. */
  readonly hsl: string;
}

export interface GalaxyNode {
  readonly id: string;
  readonly label: string;
  readonly kind: GalaxyKind;
  readonly domain: string;
  readonly detail: string;
  /** Rotta interna aprbile (solo per le superfici). */
  readonly path?: string;
  /** Peso visivo (raggio del punto). */
  readonly weight: number;
}

export interface GalaxyLink {
  readonly from: string;
  readonly to: string;
}

export const GALAXY_DOMAINS: readonly GalaxyDomain[] = [
  {
    id: "intelligenza",
    label: "Intelligenza",
    description: "Cervelli AI: assistenti, planner, agenti autonomi, knowledge base, memoria.",
    hsl: "265 90% 68%",
  },
  {
    id: "voce",
    label: "Voce",
    description: "Agenti vocali realtime, sintesi e ponte voce↔cervello.",
    hsl: "320 90% 66%",
  },
  {
    id: "acquisizione",
    label: "Acquisizione",
    description: "Origini dei dati: scraping, import, OCR, sincronizzazioni esterne.",
    hsl: "150 80% 55%",
  },
  {
    id: "comunicazione",
    label: "Comunicazione",
    description: "Email, WhatsApp, LinkedIn: ingresso, classificazione, invio.",
    hsl: "205 100% 62%",
  },
  {
    id: "outreach",
    label: "Outreach",
    description: "Cadenze, missioni, scheduling e dispatch dei messaggi.",
    hsl: "35 100% 60%",
  },
  {
    id: "governance",
    label: "Governance",
    description: "Qualità, dedup, audit, scoring, monitoraggio e sicurezza.",
    hsl: "0 85% 63%",
  },
  {
    id: "integrazioni",
    label: "Integrazioni",
    description: "Ponti verso sistemi esterni: TMWE, MCP, Finder API.",
    hsl: "185 85% 55%",
  },
  {
    id: "superfici",
    label: "Superfici",
    description: "Le pagine dell'applicazione: dove l'operatore tocca il sistema.",
    hsl: "45 90% 70%",
  },
  {
    id: "dati",
    label: "Dati",
    description: "Store persistenti: le tabelle su cui vive tutto il resto.",
    hsl: "220 25% 72%",
  },
];

/** Origini dati esterne (punti di partenza reali del sistema). */
const EXTERNAL_SOURCES: readonly { id: string; label: string; detail: string }[] = [
  { id: "src-wca", label: "WCA Network", detail: "Directory partner WCA importata via bridge/cookie." },
  { id: "src-ra", label: "ReportAziende", detail: "Scraping anagrafiche aziende italiane." },
  { id: "src-imap", label: "Caselle IMAP", detail: "Sincronizzazione posta in ingresso multi-mailbox." },
  { id: "src-linkedin", label: "LinkedIn", detail: "Estensione stealth: profili, messaggi, rubrica." },
  { id: "src-whatsapp", label: "WhatsApp", detail: "Estensione stealth: conversazioni e rubrica." },
  { id: "src-ocr", label: "Biglietti da visita", detail: "OCR e normalizzazione contatti da immagine." },
  { id: "src-csv", label: "Import CSV/Excel", detail: "Import massivi con analisi struttura AI." },
  { id: "src-web", label: "Siti web", detail: "Scraping e arricchimento da sito del partner." },
  { id: "src-tmwe", label: "TMWE ERP", detail: "OAuth + proxy verso l'ERP: clienti, quotazioni, revenue." },
];

/** Store persistenti principali. */
const STORES: readonly { id: string; label: string; detail: string }[] = [
  { id: "db-partners", label: "partners", detail: "Anagrafica partner della rete." },
  { id: "db-contacts", label: "partner_contacts", detail: "Persone collegate ai partner." },
  { id: "db-imported", label: "imported_contacts", detail: "Contatti importati in staging/dedup." },
  { id: "db-prospects", label: "prospects", detail: "Lead in prospezione." },
  { id: "db-cards", label: "business_cards", detail: "Biglietti da visita digitalizzati." },
  { id: "db-messages", label: "channel_messages", detail: "Messaggi multicanale (email/WA/LI)." },
  { id: "db-kb", label: "kb_entries", detail: "Knowledge base che nutre gli agenti." },
  { id: "db-prompts", label: "operative_prompts", detail: "Prompt operativi versionati." },
  { id: "db-agents", label: "agents", detail: "Registro degli agenti AI." },
  { id: "db-queue", label: "outreach_queue", detail: "Coda invii e cadenze." },
  { id: "db-pending", label: "ai_pending_actions", detail: "Azioni AI in attesa di approvazione umana." },
  { id: "db-audit", label: "supervisor_audit_log", detail: "Tracciamento governance delle azioni AI." },
];

/** Dominio → store toccati (connessioni "fili leggeri" tra bracci). */
const DOMAIN_STORES: Readonly<Record<string, readonly string[]>> = {
  intelligenza: ["db-kb", "db-prompts", "db-agents", "db-pending", "db-audit"],
  voce: ["db-kb", "db-agents"],
  acquisizione: ["db-partners", "db-contacts", "db-imported", "db-prospects", "db-cards"],
  comunicazione: ["db-messages", "db-contacts", "db-partners"],
  outreach: ["db-queue", "db-pending", "db-messages"],
  governance: ["db-audit", "db-partners", "db-imported"],
  integrazioni: ["db-partners", "db-audit"],
};

/** Origine → dominio che la consuma. */
const SOURCE_DOMAIN: Readonly<Record<string, string>> = {
  "src-wca": "acquisizione",
  "src-ra": "acquisizione",
  "src-imap": "comunicazione",
  "src-linkedin": "comunicazione",
  "src-whatsapp": "comunicazione",
  "src-ocr": "acquisizione",
  "src-csv": "acquisizione",
  "src-web": "acquisizione",
  "src-tmwe": "integrazioni",
};

export interface SystemGraph {
  readonly nodes: readonly GalaxyNode[];
  readonly links: readonly GalaxyLink[];
  readonly stats: {
    readonly brains: number;
    readonly sources: number;
    readonly surfaces: number;
    readonly stores: number;
    readonly links: number;
    readonly edgeFunctions: number;
  };
}

const CORE_ID = "core";

export function buildSystemGraph(): SystemGraph {
  const nodes: GalaxyNode[] = [
    {
      id: CORE_ID,
      label: "Navigator Core",
      kind: "core",
      domain: "core",
      detail: "Nucleo: contratti, DAL, RLS e bus di eventi. Tutto passa da qui.",
      weight: 3,
    },
  ];
  const links: GalaxyLink[] = [];

  for (const d of GALAXY_DOMAINS) {
    nodes.push({
      id: `hub-${d.id}`,
      label: d.label,
      kind: "hub",
      domain: d.id,
      detail: d.description,
      weight: 2,
    });
    links.push({ from: CORE_ID, to: `hub-${d.id}` });
  }

  // Cervelli / funzioni server per dominio
  for (const [domain, fns] of Object.entries(EDGE_FUNCTIONS_BY_DOMAIN)) {
    for (const name of fns) {
      const id = `fn-${name}`;
      nodes.push({
        id,
        label: name,
        kind: domain === "intelligenza" || domain === "voce" ? "brain" : "external",
        domain,
        detail: `Funzione server \`${name}\` del dominio ${domain}.`,
        weight: 1,
      });
      links.push({ from: `hub-${domain}`, to: id });
    }
  }

  // Origini dati
  for (const s of EXTERNAL_SOURCES) {
    nodes.push({ id: s.id, label: s.label, kind: "source", domain: SOURCE_DOMAIN[s.id] ?? "acquisizione", detail: s.detail, weight: 1.8 });
    links.push({ from: s.id, to: `hub-${SOURCE_DOMAIN[s.id] ?? "acquisizione"}` });
  }

  // Store
  for (const t of STORES) {
    nodes.push({ id: t.id, label: t.label, kind: "store", domain: "dati", detail: t.detail, weight: 1.6 });
    links.push({ from: "hub-dati", to: t.id });
  }

  // Superfici (pagine reali)
  for (const p of APP_MAP) {
    nodes.push({
      id: `page-${p.path}`,
      label: p.label,
      kind: "surface",
      domain: "superfici",
      detail: p.purpose ?? `Pagina del gruppo ${p.group}.`,
      path: p.path,
      weight: 1.2,
    });
    links.push({ from: "hub-superfici", to: `page-${p.path}` });
  }

  // Fili trasversali dominio → store
  for (const [domain, stores] of Object.entries(DOMAIN_STORES)) {
    for (const s of stores) links.push({ from: `hub-${domain}`, to: s });
  }

  const count = (k: GalaxyKind) => nodes.filter((n) => n.kind === k).length;

  return {
    nodes,
    links,
    stats: {
      brains: count("brain"),
      sources: count("source"),
      surfaces: count("surface"),
      stores: count("store"),
      links: links.length,
      edgeFunctions: EDGE_FUNCTION_COUNT,
    },
  };
}
