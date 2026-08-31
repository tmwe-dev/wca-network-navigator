/**
 * Contratto di pagina V3 — registro unico delle maschere.
 *
 * Regola: una pagina esiste in V3 solo se dichiarata qui. Il router non
 * registra nulla che non abbia una voce in `V3_PAGES`.
 *
 * Perimetro: il nucleo commerciale (contatti, messaggi multicanale, regole di
 * catalogazione, scrittura assistita, approvazioni, coda, agenda, tracciamento).
 * Tutto il resto vive in V2 e si apre dal Laboratorio: vedi `V3_RINVII_V2`.
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

/** Riga compatta: path, modulo, tipo, titolo, domanda, filtri, azioni. */
type Riga = readonly [
  path: string,
  module: V3ModuleId,
  kind: V3PageKind,
  title: string,
  question: string,
  filters: readonly string[],
  workflow: readonly string[],
];

function pagina([path, module, kind, title, question, filters, workflow]: Riga): V3PageDefinition {
  return { path, module, kind, title, question, filters, workflow, implemented: true };
}

/** Le maschere della V3. Nessuna riga qui che non serva al ciclo commerciale. */
export const V3_PAGES = {
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
  } satisfies V3PageDefinition,

  operatori: pagina(["/v3/operatori", "identita", "list", "Operatori", "Chi può fare cosa?", ["ricerca", "ruolo", "stato"], ["invita", "ruoli", "revoca"]]),

  contatti: pagina(["/v3/contatti", "contatti", "list", "Contatti", "Chi devo contattare?", ["ricerca", "paese", "gruppo", "stato", "tag"], ["nuovo", "azioni-massive"]]),
  contatto: pagina(["/v3/contatti/:id", "contatti", "detail", "Scheda contatto", "Chi è e cosa ci siamo detti?", [], ["scrivi", "programma", "archivia"]]),

  inbox: pagina(["/v3/inbox", "messaggi", "operational", "Inbox", "Cosa è arrivato e cosa richiede risposta?", ["casella", "gruppo", "stato", "periodo", "non-letti"], ["rispondi", "assegna", "archivia", "regole"]]),
  conversazione: pagina(["/v3/inbox/:id", "messaggi", "detail", "Conversazione", "Cosa dice questo messaggio e cosa faccio?", [], ["rispondi", "programma", "classifica", "escala"]]),
  canali: pagina(["/v3/canali", "messaggi", "list", "Canali", "Cosa arriva da WhatsApp e LinkedIn?", ["canale", "contatto", "periodo"], ["apri-conversazione"]]),

  regole: pagina(["/v3/regole", "comprensione", "list", "Regole e gruppi", "Come viene smistato ciò che arriva?", ["tipo-regola", "gruppo", "stato"], ["nuova-regola", "testa", "correggi"]]),

  scrivi: pagina(["/v3/scrivi", "risposta", "operational", "Scrivi", "Cosa mando e a chi?", ["destinatari", "canale", "template"], ["genera", "revisiona", "allega", "invia"]]),
  approvazioni: pagina(["/v3/approvazioni", "risposta", "list", "Approvazioni", "Cosa devo approvare prima che parta?", ["canale", "rischio", "richiedente"], ["approva", "correggi", "rifiuta"]]),

  dafare: pagina(["/v3/da-fare", "programmazione", "operational", "Da fare", "Cosa devo decidere io oggi?", [], ["approva", "completa", "sblocca"]]),
  agenda: pagina(["/v3/agenda", "programmazione", "operational", "Agenda", "Cosa devo fare oggi?", ["tipo", "operatore", "priorita", "giorno"], ["completa", "rimanda", "crea"]]),
  coda: pagina(["/v3/coda", "programmazione", "list", "Coda di invio", "Cosa è in coda e cosa si è bloccato?", ["stato", "canale", "errore"], ["riprova", "sblocca", "annulla"]]),

  andamento: pagina(["/v3/andamento", "tracciamento", "list", "Andamento", "Sta funzionando?", ["periodo", "canale", "operatore"], ["esporta"]]),
  registro: pagina(["/v3/registro", "tracciamento", "list", "Registro AI", "Cosa ha deciso l'AI e perché?", ["funzione", "esito", "periodo"], ["apri-traccia", "esporta"]]),

  command: pagina(["/v3/command", "trasversale", "operational", "Command", "Chiedi qualsiasi cosa al sistema", ["conversazioni-recenti"], ["strumenti-usati", "fonti", "azioni-proposte"]]),
  impostazioni: pagina(["/v3/impostazioni", "trasversale", "detail", "Impostazioni", "Come è configurato il sistema?", [], ["caselle", "ai", "alert", "marchio"]]),
  laboratorio: pagina(["/v3/laboratorio", "trasversale", "operational", "Laboratorio", "Dove sono acquisizione, laboratorio AI e diagnostica?", [], ["acquisizione", "laboratorio", "osservabilita"]]),
  galassia: pagina(["/v3/galassia", "trasversale", "detail", "Galassia", "Che aspetto ha lo standard e quanto è cresciuta la V3?", [], []]),
  galassia3d: pagina(["/v3/galassia-3d", "trasversale", "operational", "Galassia 3D", "Com'è fatto l'albero della V3 e come sono collegati i pezzi?", [], []]),
} as const satisfies Record<string, V3PageDefinition>;

export type V3PageId = keyof typeof V3_PAGES;

/**
 * Maschere fuori perimetro: non esistono in V3, il vecchio percorso rimanda alla
 * superficie V2 corrispondente. Serve a non lasciare link morti.
 */
export const V3_RINVII_V2: readonly { readonly path: string; readonly titolo: string; readonly destinazione: string }[] = [
  { path: "/v3/import", titolo: "Import contatti", destinazione: "/v2/explore/contacts" },
  { path: "/v3/duplicati", titolo: "Duplicati", destinazione: "/v2/agenda/duplicati" },
  { path: "/v3/cestino", titolo: "Cestino", destinazione: "/v2/cestinone" },
  { path: "/v3/classificazione", titolo: "Qualità classificazione", destinazione: "/v2/email-intelligence" },
  { path: "/v3/modelli", titolo: "Modelli di testo", destinazione: "/v2/settings/prompt-lab" },
  { path: "/v3/campagne", titolo: "Campagne", destinazione: "/v2/explore/campaigns" },
  { path: "/v3/pipeline", titolo: "Pipeline trattative", destinazione: "/v2/agenda/pipeline" },
];

export function getV3Page(id: V3PageId): V3PageDefinition {
  return V3_PAGES[id];
}

export const V3_IMPLEMENTED_PAGES: readonly (readonly [V3PageId, V3PageDefinition])[] = (
  Object.entries(V3_PAGES) as [V3PageId, V3PageDefinition][]
).filter(([, page]) => page.implemented);

/** Prima pagina disponibile: destinazione dopo il login e fallback del router. */
export const V3_HOME_PATH: string = V3_PAGES.contatti.path;
