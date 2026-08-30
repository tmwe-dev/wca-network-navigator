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
import { FN_TABLES, FN_CALLS, PAGE_CALLS } from "./synapses.generated";

export type GalaxyKind = "core" | "hub" | "brain" | "orchestrator" | "source" | "surface" | "store" | "external";


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

/** Descrizioni curate per gli store più noti (le altre tabelle sono derivate dal codice). */
const STORE_DETAIL: Readonly<Record<string, string>> = {
  partners: "Anagrafica partner della rete.",
  partner_contacts: "Persone collegate ai partner.",
  imported_contacts: "Contatti importati in staging/dedup.",
  prospects: "Lead in prospezione.",
  business_cards: "Biglietti da visita digitalizzati.",
  channel_messages: "Messaggi multicanale (email/WA/LI).",
  kb_entries: "Knowledge base che nutre gli agenti.",
  operative_prompts: "Prompt operativi versionati.",
  agents: "Registro degli agenti AI.",
  outreach_queue: "Coda invii e cadenze.",
  ai_pending_actions: "Azioni AI in attesa di approvazione umana.",
  supervisor_audit_log: "Tracciamento governance delle azioni AI.",
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

/** Origine → funzioni reali che la leggono (prefissi dei nomi funzione). */
const SOURCE_FN_MATCH: Readonly<Record<string, readonly string[]>> = {
  "src-wca": ["wca", "sync-wca", "save-wca"],
  "src-ra": ["save-ra", "get-ra", "save-ra-cookie"],
  "src-imap": ["email-imap", "check-inbox", "imap-", "email-sync", "email-cron", "mark-imap", "manage-email-folders"],
  "src-linkedin": ["linkedin", "send-linkedin", "get-linkedin", "save-linkedin"],
  "src-whatsapp": ["whatsapp", "send-whatsapp"],
  "src-ocr": ["parse-business-card", "sync-business-cards", "ai-match-business-cards"],
  "src-csv": ["process-ai-import", "analyze-import-structure"],
  "src-web": ["scrape-website", "enrich-partner-website", "browser-action"],
  "src-tmwe": ["tmwe"],
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
    readonly orchestrators: number;
  };
}

const CORE_ID = "core";
/** Una funzione che ne invoca almeno 3 altre è considerata orchestratore. */
const ORCHESTRATOR_THRESHOLD = 3;

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
  const linkSeen = new Set<string>();
  const addLink = (from: string, to: string, relation: GalaxyLink["relation"]) => {
    const key = `${from}|${to}|${relation}`;
    if (from === to || linkSeen.has(key)) return;
    linkSeen.add(key);
    links.push({ from, to, relation });
  };

  for (const d of GALAXY_DOMAINS) {
    nodes.push({
      id: `hub-${d.id}`,
      label: d.label,
      kind: "hub",
      domain: d.id,
      detail: d.description,
      weight: 2,
    });
    addLink(CORE_ID, `hub-${d.id}`, "appartiene");
  }

  // ---- Funzioni server (nodi) + dominio di appartenenza ------------------
  const domainOf = new Map<string, string>();
  for (const [domain, fns] of Object.entries(EDGE_FUNCTIONS_BY_DOMAIN)) {
    for (const name of fns) domainOf.set(name, domain);
  }

  const callers = new Map<string, string[]>();
  for (const [fn, targets] of Object.entries(FN_CALLS)) {
    for (const t of targets) callers.set(t, [...(callers.get(t) ?? []), fn]);
  }

  for (const [name, domain] of domainOf) {
    const tables = FN_TABLES[name] ?? [];
    const calls = FN_CALLS[name] ?? [];
    const called = callers.get(name) ?? [];
    const isOrchestrator = calls.length >= ORCHESTRATOR_THRESHOLD;
    const id = `fn-${name}`;
    nodes.push({
      id,
      label: name,
      kind: isOrchestrator ? "orchestrator" : domain === "intelligenza" || domain === "voce" ? "brain" : "external",
      domain,
      detail: [
        isOrchestrator ? `Orchestratore: invoca ${calls.length} funzioni.` : `Funzione server del dominio ${domain}.`,
        tables.length ? `Tabelle toccate (${tables.length}): ${tables.join(", ")}.` : "Nessuna tabella letta/scritta direttamente.",
        calls.length ? `Invoca: ${calls.join(", ")}.` : null,
        called.length ? `Invocata da: ${called.join(", ")}.` : null,
      ]
        .filter(Boolean)
        .join(" "),
      weight: isOrchestrator ? 2.2 : 1 + Math.min(tables.length, 6) * 0.12,
    });
    addLink(`hub-${domain}`, id, "appartiene");
  }

  // ---- Sinapsi reali: funzione → funzione --------------------------------
  for (const [fn, targets] of Object.entries(FN_CALLS)) {
    if (!domainOf.has(fn)) continue;
    for (const t of targets) if (domainOf.has(t)) addLink(`fn-${fn}`, `fn-${t}`, "invoca");
  }

  // ---- Store reali derivati dalle tabelle usate dal codice ---------------
  const tableUsage = new Map<string, string[]>();
  for (const [fn, tables] of Object.entries(FN_TABLES)) {
    if (!domainOf.has(fn)) continue;
    for (const t of tables) tableUsage.set(t, [...(tableUsage.get(t) ?? []), fn]);
  }
  const storeTables = [...tableUsage.entries()]
    .filter(([, users]) => users.length >= 2)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 60);

  for (const [table, users] of storeTables) {
    const id = `db-${table}`;
    nodes.push({
      id,
      label: table,
      kind: "store",
      domain: "dati",
      detail: `${STORE_DETAIL[table] ?? "Tabella del database."} Usata da ${users.length} funzioni server.`,
      weight: 1.2 + Math.min(users.length, 20) * 0.06,
    });
    addLink("hub-dati", id, "appartiene");
    for (const fn of users) addLink(`fn-${fn}`, id, "legge/scrive");
  }

  // ---- Origini dati ------------------------------------------------------
  for (const s of EXTERNAL_SOURCES) {
    const domain = SOURCE_DOMAIN[s.id] ?? "acquisizione";
    const matches = (SOURCE_FN_MATCH[s.id] ?? []).flatMap((prefix) =>
      [...domainOf.keys()].filter((fn) => fn.includes(prefix)),
    );
    const uniq = [...new Set(matches)];
    nodes.push({
      id: s.id,
      label: s.label,
      kind: "source",
      domain,
      detail: `${s.detail} Entra nel sistema tramite ${uniq.length} funzioni.`,
      weight: 1.8,
    });
    addLink(s.id, `hub-${domain}`, "appartiene");
    for (const fn of uniq) addLink(s.id, `fn-${fn}`, "alimenta");
  }

  // ---- Superfici (pagine reali) + funzioni realmente invocate ------------
  for (const p of APP_MAP) {
    const id = `page-${p.path}`;
    const calls = (PAGE_CALLS[p.path] ?? []).filter((fn) => domainOf.has(fn));
    nodes.push({
      id,
      label: p.label,
      kind: "surface",
      domain: "superfici",
      detail: [
        p.purpose ?? `Pagina del gruppo ${p.group}.`,
        calls.length ? `Invoca ${calls.length} funzioni server: ${calls.join(", ")}.` : "Nessuna invocazione diretta rilevata nel codice della pagina.",
      ].join(" "),
      path: p.path,
      weight: 1.2 + Math.min(calls.length, 8) * 0.08,
    });
    addLink("hub-superfici", id, "appartiene");
    for (const fn of calls) addLink(id, `fn-${fn}`, "invoca");
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
      orchestrators: count("orchestrator"),
    },
  };
}

