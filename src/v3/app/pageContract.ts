/**
 * Contratto di pagina V3 — registro unico delle maschere.
 *
 * Regola: una pagina esiste in V3 solo se dichiarata qui. Il router non
 * registra nulla che non abbia una voce in `V3_PAGES`.
 *
 * Riferimenti: docs/v3/contratto-pagina.md, docs/v3/mappa-innesto.md
 */

/** Tre soli tipi di maschera. Un quarto tipo si aggiunge solo modificando il contratto. */
export type V3PageKind = "list" | "detail" | "operational";

/** I sette moduli del nucleo, più il livello trasversale. */
export type V3ModuleId =
  | "identita"
  | "contatti"
  | "messaggi"
  | "comprensione"
  | "risposta"
  | "programmazione"
  | "tracciamento"
  | "trasversale";

export interface V3PageDefinition {
  /** Percorso unico. Nessun alias: gli indirizzi V2 diventano redirect verso questo. */
  readonly path: string;
  readonly module: V3ModuleId;
  readonly kind: V3PageKind;
  /** Titolo mostrato nella top bar e nell'header di maschera. */
  readonly title: string;
  /** La singola domanda a cui la pagina risponde. Guida cosa mostrare e cosa no. */
  readonly question: string;
  /** Filtri ammessi nel rail sinistro. Vuoto = rail non montato. */
  readonly filters: readonly string[];
  /** Azioni ammesse nel rail destro. Vuoto = rail non montato. */
  readonly workflow: readonly string[];
  /** `false` finché il modulo non è innestato: la rotta non viene registrata. */
  readonly implemented: boolean;
  /** Pagine pubbliche: nessun guard di autenticazione. */
  readonly publicRoute?: boolean;
}

export const V3_MODULE_LABELS: Record<V3ModuleId, string> = {
  identita: "Identità e accesso",
  contatti: "Contatti",
  messaggi: "Messaggi",
  comprensione: "Comprensione",
  risposta: "Risposta",
  programmazione: "Programmazione",
  tracciamento: "Tracciamento",
  trasversale: "Trasversale",
};

export const V3_BASE_PATH = "/v3";

/**
 * Le 22 pagine della V3, dichiarate in anticipo (Fase 0.C).
 * `implemented: false` = pianificata, non ancora innestata.
 */
export const V3_PAGES = {
  // ── Modulo 1 — Identità e accesso ────────────────────────────────
  login: {
    path: "/v3/login",
    module: "identita",
    kind: "operational",
    title: "Accesso",
    question: "Chi sei?",
    filters: [],
    workflow: [],
    implemented: true,
    publicRoute: true,
  },
  operatori: {
    path: "/v3/operatori",
    module: "identita",
    kind: "list",
    title: "Operatori",
    question: "Chi può fare cosa?",
    filters: ["ricerca", "ruolo", "stato"],
    workflow: ["invita", "ruoli", "revoca"],
    implemented: true,
  },

  // ── Modulo 2 — Contatti ──────────────────────────────────────────
  contatti: {
    path: "/v3/contatti",
    module: "contatti",
    kind: "list",
    title: "Contatti",
    question: "Chi devo contattare?",
    filters: ["ricerca", "paese", "gruppo", "stato", "tag"],
    workflow: ["nuovo", "import", "azioni-massive"],
    implemented: true,
  },
  contatto: {
    path: "/v3/contatti/:id",
    module: "contatti",
    kind: "detail",
    title: "Scheda contatto",
    question: "Chi è e cosa ci siamo detti?",
    filters: [],
    workflow: ["scrivi", "programma", "unisci", "archivia"],
    implemented: true,
  },
  importazione: {
    path: "/v3/import",
    module: "contatti",
    kind: "operational",
    title: "Import",
    question: "Cosa sto caricando?",
    filters: [],
    workflow: ["carica", "mappa-campi", "conferma"],
    implemented: true,
  },
  duplicati: {
    path: "/v3/duplicati",
    module: "contatti",
    kind: "list",
    title: "Duplicati",
    question: "Cosa devo unire?",
    filters: ["soglia", "tipo"],
    workflow: ["unisci", "ignora"],
    implemented: true,
  },
  cestino: {
    path: "/v3/cestino",
    module: "contatti",
    kind: "list",
    title: "Cestino",
    question: "Cosa ho eliminato?",
    filters: ["tipo", "periodo"],
    workflow: ["ripristina"],
    implemented: true,
  },

  // ── Modulo 3 — Messaggi ──────────────────────────────────────────
  inbox: {
    path: "/v3/inbox",
    module: "messaggi",
    kind: "operational",
    title: "Inbox",
    question: "Cosa è arrivato e cosa richiede risposta?",
    filters: ["casella", "gruppo", "stato", "periodo", "non-letti"],
    workflow: ["rispondi", "assegna", "archivia", "regole"],
    implemented: true,
  },
  conversazione: {
    path: "/v3/inbox/:id",
    module: "messaggi",
    kind: "detail",
    title: "Conversazione",
    question: "Cosa dice questo messaggio e cosa faccio?",
    filters: [],
    workflow: ["rispondi", "programma", "classifica", "escala"],
    implemented: true,
  },
  canali: {
    path: "/v3/canali",
    module: "messaggi",
    kind: "list",
    title: "Canali",
    question: "Cosa arriva da WhatsApp e LinkedIn?",
    filters: ["canale", "contatto", "periodo"],
    workflow: ["apri-conversazione"],
    implemented: true,
  },

  // ── Modulo 4 — Comprensione ──────────────────────────────────────
  regole: {
    path: "/v3/regole",
    module: "comprensione",
    kind: "list",
    title: "Regole e gruppi",
    question: "Come viene smistato ciò che arriva?",
    filters: ["tipo-regola", "gruppo", "stato"],
    workflow: ["nuova-regola", "testa", "correggi"],
    implemented: true,
  },
  classificazione: {
    path: "/v3/classificazione",
    module: "comprensione",
    kind: "list",
    title: "Qualità classificazione",
    question: "Sta classificando bene?",
    filters: ["periodo", "esito", "gruppo"],
    workflow: ["correggi", "promuovi-a-regola"],
    implemented: true,
  },

  // ── Modulo 5 — Risposta ──────────────────────────────────────────
  scrivi: {
    path: "/v3/scrivi",
    module: "risposta",
    kind: "operational",
    title: "Scrivi",
    question: "Cosa mando e a chi?",
    filters: ["destinatari", "canale", "template"],
    workflow: ["genera", "revisiona", "allega", "invia"],
    implemented: true,
  },
  approvazioni: {
    path: "/v3/approvazioni",
    module: "risposta",
    kind: "list",
    title: "Approvazioni",
    question: "Cosa devo approvare prima che parta?",
    filters: ["canale", "rischio", "richiedente"],
    workflow: ["approva", "correggi", "rifiuta"],
    implemented: true,
  },
  modelli: {
    path: "/v3/modelli",
    module: "risposta",
    kind: "list",
    title: "Modelli",
    question: "Con che tono e struttura scriviamo?",
    filters: ["canale", "lingua", "uso"],
    workflow: ["nuovo", "duplica", "prova"],
    implemented: true,
  },

  // ── Modulo 6 — Programmazione ────────────────────────────────────
  agenda: {
    path: "/v3/agenda",
    module: "programmazione",
    kind: "operational",
    title: "Agenda",
    question: "Cosa devo fare oggi?",
    filters: ["tipo", "operatore", "priorita", "giorno"],
    workflow: ["completa", "rimanda", "crea"],
    implemented: true,
  },
  campagne: {
    path: "/v3/campagne",
    module: "programmazione",
    kind: "list",
    title: "Campagne",
    question: "Cosa sta partendo e quando?",
    filters: ["stato", "canale", "periodo"],
    workflow: ["avvia", "sospendi", "modifica-cadenza"],
    implemented: true,
  },
  coda: {
    path: "/v3/coda",
    module: "programmazione",
    kind: "list",
    title: "Coda di invio",
    question: "Cosa è in coda e cosa si è bloccato?",
    filters: ["stato", "canale", "errore"],
    workflow: ["riprova", "sblocca", "annulla"],
    implemented: true,
  },

  // ── Modulo 7 — Tracciamento ──────────────────────────────────────
  pipeline: {
    path: "/v3/pipeline",
    module: "tracciamento",
    kind: "operational",
    title: "Pipeline",
    question: "A che punto sono le trattative?",
    filters: ["fase", "operatore", "valore", "periodo"],
    workflow: ["sposta-fase", "crea-attivita"],
    implemented: true,
  },
  andamento: {
    path: "/v3/andamento",
    module: "tracciamento",
    kind: "list",
    title: "Andamento",
    question: "Sta funzionando?",
    filters: ["periodo", "canale", "operatore"],
    workflow: ["esporta"],
    implemented: true,
  },
  registro: {
    path: "/v3/registro",
    module: "tracciamento",
    kind: "list",
    title: "Registro AI",
    question: "Cosa ha deciso l'AI e perché?",
    filters: ["funzione", "esito", "periodo"],
    workflow: ["apri-traccia", "esporta"],
    implemented: true,
  },

  // ── Trasversale ──────────────────────────────────────────────────
  command: {
    path: "/v3/command",
    module: "trasversale",
    kind: "operational",
    title: "Command",
    question: "Chiedi qualsiasi cosa al sistema",
    filters: ["conversazioni-recenti"],
    workflow: ["strumenti-usati", "fonti", "azioni-proposte"],
    implemented: true,
  },
  impostazioni: {
    path: "/v3/impostazioni",
    module: "trasversale",
    kind: "detail",
    title: "Impostazioni",
    question: "Come è configurato il sistema?",
    filters: [],
    workflow: ["caselle", "ai", "alert", "marchio"],
    implemented: true,
  },
} as const satisfies Record<string, V3PageDefinition>;

export type V3PageId = keyof typeof V3_PAGES;

export function getV3Page(id: V3PageId): V3PageDefinition {
  return V3_PAGES[id];
}

export const V3_IMPLEMENTED_PAGES: readonly (readonly [V3PageId, V3PageDefinition])[] = (
  Object.entries(V3_PAGES) as [V3PageId, V3PageDefinition][]
).filter(([, page]) => page.implemented);

/** Prima pagina disponibile: destinazione dopo il login e fallback del router. */
export const V3_HOME_PATH: string = V3_PAGES.contatti.path;
