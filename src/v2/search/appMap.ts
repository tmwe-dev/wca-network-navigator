/**
 * appMap — Mappa del software (SSOT per agente AI e KB).
 *
 * Deriva l'elenco pagine dalla navigazione (SEARCH_PAGES) e lo arricchisce
 * con dettagli curati per pagina: a cosa serve, campi/dati principali,
 * funzionalità disponibili.
 *
 * Uso:
 *  - tool `navigate-to` (routing dell'agente verso pagine/funzioni)
 *  - tool `app-map` (rende la mappa e la sincronizza nella KB)
 */
import { SEARCH_PAGES, SEARCH_ACTIONS } from "@/v2/search/searchIndex";

export interface AppMapPage {
  readonly path: string;
  readonly label: string;
  readonly group: string;
  /** A cosa serve la pagina, in una riga. */
  readonly purpose?: string;
  /** Campi / colonne / dati principali visibili o editabili. */
  readonly fields?: readonly string[];
  /** Cosa si può fare nella pagina. */
  readonly features?: readonly string[];
}

/** Dettagli curati per le pagine operative principali. */
const PAGE_DETAILS: Record<string, Omit<AppMapPage, "path" | "label" | "group">> = {
  "/v2/command": {
    purpose: "Console AI in linguaggio naturale: query sul DB, azioni operative, voce realtime.",
    fields: ["prompt", "cronologia conversazione", "risultati (tabella/card/report)", "audit fonti e tool"],
    features: ["query dati", "esecuzione tool", "composizione email", "navigazione verso pagine", "modalità voce"],
  },
  "/v2/explore/network": {
    purpose: "Rete partner WCA: ricerca, filtri geografici e profili.",
    fields: [
      "partners.company_name",
      "partners.country_code",
      "partners.city",
      "partners.email",
      "partners.website",
      "partners.profile_description",
      "partners.lead_status",
      "partners.quality_score",
    ],
    features: ["ricerca full-text", "filtri paese/città", "apertura scheda partner", "enrichment", "invio in cockpit"],
  },
  "/v2/business-cards": {
    purpose: "Biglietti da visita digitalizzati via OCR e loro conversione in contatti.",
    fields: ["business_cards.full_name", "company", "email", "phone", "country", "status"],
    features: ["upload/OCR", "modifica campi", "sincronizza in rubrica", "invio email al contatto"],
  },
  "/v2/cockpit": {
    purpose: "Pipeline outreach: selezione destinatari, canali e generazione bozze.",
    fields: ["cockpit_queue.contact_id", "canale (email/whatsapp/linkedin)", "stato bozza", "operatore"],
    features: ["drag & drop contatti", "generazione bozze AI", "eliminazione massiva", "invio in approvazione"],
  },
  "/v2/cestinone": {
    purpose: "Autorizzazione e invio dei messaggi in coda (email/WhatsApp/LinkedIn).",
    fields: ["destinatario", "oggetto", "corpo", "Cc/Ccn", "casella mittente", "stato"],
    features: ["modifica testo", "aggiunta Cc/Ccn da rubrica", "approvazione e invio reale", "scarto"],
  },
  "/v2/approvazioni": {
    purpose: "Elenco delle ai_pending_actions in attesa di approvazione umana.",
    fields: ["ai_pending_actions.action_type", "payload", "status", "created_at"],
    features: ["approva", "rifiuta", "dispatch"],
  },
  "/v2/inbox": {
    purpose: "Posta in arrivo multicanale sincronizzata (IMAP + canali).",
    fields: ["channel_messages.from", "subject", "body", "direction", "folder", "gruppo mittente"],
    features: ["lettura", "classificazione AI", "regole cartelle", "risposta", "marcatura"],
  },
  "/v2/communicate/compose": {
    purpose: "Composizione manuale di una nuova email con assistenza AI.",
    fields: ["destinatario", "oggetto", "corpo", "tono", "firma"],
    features: ["generazione AI", "revisione editoriale", "invio o accodamento"],
  },
  "/v2/email/forge": {
    purpose: "Email Forge: profilo mittente, firma / piè di pagina, prompt e KB email.",
    fields: ["app_settings.default_sender_name", "alias", "blocco firma", "prompt email", "kb_entries email"],
    features: ["configura identità mittente", "modifica firma/piè di pagina", "test prompt", "edit KB email"],
  },
  "/v2/kb": {
    purpose: "Knowledge Base: dottrina, procedure, mappe e manuali usati dagli agenti.",
    fields: ["kb_entries.title", "category", "family", "content", "tags", "priority", "is_active"],
    features: ["crea/modifica voce", "attiva/disattiva", "ingest documenti", "ricerca full-text"],
  },
  "/v2/prompt-lab": {
    purpose: "Prompt Lab: versioni prompt, personas, test di regressione.",
    fields: ["prompt version", "persona", "scope", "risultati test"],
    features: ["edita prompt", "esegui test", "rollback versione"],
  },
  "/v2/agents/autopilot": {
    purpose: "Agenti AI e missioni autopilot con KPI e budget.",
    fields: ["agents.name", "enabled", "persona", "agent_tasks.status"],
    features: ["attiva/disattiva agente", "lancia missione", "monitor task"],
  },
  "/v2/blacklist": {
    purpose: "Blacklist indirizzi e regole di esclusione invio.",
    fields: ["email", "motivo", "created_at"],
    features: ["aggiungi", "rimuovi", "import bounce"],
  },
  "/v2/ai-control": {
    purpose: "Controllo AI: consumo token, costi, routing modelli.",
    fields: ["scope", "provider", "model", "token in/out", "costo"],
    features: ["monitor costi", "cambia routing modello", "limiti"],
  },
  "/v2/settings": {
    purpose: "Impostazioni: caselle email SMTP/IMAP, credenziali, preferenze.",
    fields: ["app_settings.smtp_host", "smtp_user", "imap_host", "mailbox attiva"],
    features: ["configura SMTP/IMAP", "test connessione", "preferenze operatore"],
  },
};

/** Mappa completa delle pagine raggiungibili. */
export const APP_MAP: readonly AppMapPage[] = SEARCH_PAGES.map((p) => ({
  path: p.path,
  label: p.label,
  group: p.group,
  ...(PAGE_DETAILS[p.path] ?? {}),
}));

export interface AppMapMatch {
  readonly path: string;
  readonly label: string;
  readonly hint: string;
  readonly score: number;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP = new Set([
  "vai",
  "a",
  "al",
  "alla",
  "allo",
  "ai",
  "apri",
  "aprimi",
  "portami",
  "mostrami",
  "dove",
  "trovo",
  "si",
  "la",
  "il",
  "lo",
  "le",
  "di",
  "del",
  "della",
  "pagina",
  "sezione",
  "come",
  "raggiungo",
  "in",
  "su",
  "per",
  "e",
]);

/** Ricerca fuzzy su pagine + azioni operative. Ritorna i migliori match. */
export function findDestinations(query: string, limit = 5): readonly AppMapMatch[] {
  const terms = normalize(query)
    .split(" ")
    .filter((t) => t.length > 2 && !STOP.has(t));
  if (terms.length === 0) return [];

  const candidates: AppMapMatch[] = [];

  for (const p of APP_MAP) {
    const hay = normalize(
      [p.label, p.group, p.path, p.purpose ?? "", (p.features ?? []).join(" "), (p.fields ?? []).join(" ")].join(" "),
    );
    const score = terms.reduce((acc, t) => acc + (hay.includes(t) ? (normalize(p.label).includes(t) ? 3 : 1) : 0), 0);
    if (score > 0) candidates.push({ path: p.path, label: p.label, hint: p.purpose ?? p.group, score });
  }

  for (const a of SEARCH_ACTIONS) {
    const hay = normalize([a.label, a.keywords, a.hint, a.path].join(" "));
    const score = terms.reduce((acc, t) => acc + (hay.includes(t) ? 2 : 0), 0);
    if (score > 0) candidates.push({ path: a.path, label: a.label, hint: a.hint, score: score + 1 });
  }

  const best = new Map<string, AppMapMatch>();
  for (const c of candidates.sort((x, y) => y.score - x.score)) {
    const prev = best.get(c.path);
    if (!prev || prev.score < c.score) best.set(c.path, c);
  }
  return [...best.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Rende la mappa in markdown, formato adatto alla KB e all'agente. */
export function renderAppMapMarkdown(): string {
  const byGroup = new Map<string, AppMapPage[]>();
  for (const p of APP_MAP) {
    const arr = byGroup.get(p.group) ?? [];
    arr.push(p);
    byGroup.set(p.group, arr);
  }

  const lines: string[] = [
    "# Mappa Applicazione — pagine, campi, funzionalità",
    "",
    "Documento generato dalla navigazione reale del software (SSOT).",
    "Usalo per rispondere a *dove trovo…*, *come faccio a…* e per instradare l'utente con il tool `navigate-to`.",
    "",
  ];

  for (const [group, pages] of byGroup) {
    lines.push(`## ${group}`, "");
    for (const p of pages) {
      lines.push(`### ${p.label} — \`${p.path}\``);
      if (p.purpose) lines.push(`- Scopo: ${p.purpose}`);
      if (p.fields?.length) lines.push(`- Campi/dati: ${p.fields.join(", ")}`);
      if (p.features?.length) lines.push(`- Funzioni: ${p.features.join(", ")}`);
      lines.push("");
    }
  }

  lines.push("## Funzioni operative (scorciatoie)", "");
  for (const a of SEARCH_ACTIONS) {
    lines.push(`- ${a.label} → \`${a.path}\` (${a.hint}) — sinonimi: ${a.keywords}`);
  }

  return lines.join("\n");
}
