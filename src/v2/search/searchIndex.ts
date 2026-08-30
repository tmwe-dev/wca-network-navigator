/**
 * Indice statico per la ricerca globale: pagine (menu principale +
 * registry secondario) e azioni/funzioni di sistema.
 * Nessuna query DB: puro catalogo derivato dalla SSOT di navigazione.
 */
import { FULL_NAV_ITEMS } from "@/v2/ui/templates/navConfig";
import { SECONDARY_NAV } from "@/v2/navigation/registry";

export interface SearchPageEntry {
  readonly label: string;
  readonly path: string;
  readonly group: string;
}

export interface SearchActionEntry {
  readonly label: string;
  readonly path: string;
  readonly keywords: string;
  readonly hint: string;
}

function humanize(labelKey: string): string {
  return labelKey
    .replace(/^nav\./, "")
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Tutte le pagine raggiungibili, deduplicate per path. */
export const SEARCH_PAGES: readonly SearchPageEntry[] = (() => {
  const seen = new Set<string>();
  const out: SearchPageEntry[] = [];
  for (const i of FULL_NAV_ITEMS) {
    if (seen.has(i.path)) continue;
    seen.add(i.path);
    out.push({ label: humanize(i.labelKey), path: i.path, group: "Menu principale" });
  }
  for (const g of SECONDARY_NAV) {
    const push = (items: readonly { label: string; path: string; hidden?: boolean }[], group: string) => {
      for (const it of items) {
        if (it.hidden || seen.has(it.path)) continue;
        seen.add(it.path);
        out.push({ label: it.label, path: it.path, group });
      }
    };
    push(g.items ?? [], g.title);
    for (const sg of g.subGroups ?? []) push(sg.items, `${g.title} › ${sg.title}`);
  }
  return out;
})();

/** Funzioni operative: cosa si può FARE, non solo dove andare. */
export const SEARCH_ACTIONS: readonly SearchActionEntry[] = [
  {
    label: "Autorizza e invia messaggi in coda",
    path: "/v2/cestinone",
    keywords: "cestinone approvazione invio email whatsapp linkedin conferma",
    hint: "Cestinone",
  },
  {
    label: "Aggiungi Cc / Ccn a un invio",
    path: "/v2/cestinone",
    keywords: "cc ccn copia conoscenza destinatari rubrica",
    hint: "Cestinone → dettaglio",
  },
  {
    label: "Approvazioni invii (pending actions)",
    path: "/v2/approvazioni",
    keywords: "approvazioni pending actions dispatch",
    hint: "Pipeline",
  },
  {
    label: "Configura profilo mittente e firma / piè di pagina",
    path: "/v2/email-forge",
    keywords: "firma signature footer pie di pagina mittente alias identita",
    hint: "Email Forge",
  },
  {
    label: "Impostazioni SMTP e caselle email",
    path: "/v2/settings",
    keywords: "smtp imap casella mailbox credenziali email impostazioni",
    hint: "Impostazioni",
  },
  {
    label: "Componi una nuova email",
    path: "/v2/communicate/compose",
    keywords: "scrivi compose nuova email messaggio",
    hint: "Comunica",
  },
  {
    label: "Leggi la posta in arrivo",
    path: "/v2/inbox",
    keywords: "leggi inbox posta ricevuta messaggi",
    hint: "Comunica",
  },
  {
    label: "Cockpit outreach (bozze e canali)",
    path: "/v2/cockpit",
    keywords: "cockpit outreach bozze drag campagna canali",
    hint: "Pipeline",
  },
  {
    label: "Biglietti da visita (OCR)",
    path: "/v2/business-cards",
    keywords: "biglietti business card ocr scansione contatti",
    hint: "Esplora",
  },
  {
    label: "Rete partner e ricerca WCA",
    path: "/v2/explore/network",
    keywords: "partner network wca rete aziende paesi",
    hint: "Esplora",
  },
  {
    label: "Knowledge Base (KB)",
    path: "/v2/kb",
    keywords: "kb knowledge base conoscenza documenti fonti",
    hint: "Cervello",
  },
  {
    label: "Prompt Lab e versioni prompt",
    path: "/v2/prompt-lab",
    keywords: "prompt lab versioni test regressione ai",
    hint: "Cervello",
  },
  {
    label: "Agenti e missioni autopilot",
    path: "/v2/agents/autopilot",
    keywords: "agenti missioni autopilot automazione",
    hint: "Comando",
  },
  {
    label: "Blacklist e regole invio",
    path: "/v2/blacklist",
    keywords: "blacklist bounce esclusioni regole invio",
    hint: "Config",
  },
  {
    label: "Costi e consumo token AI",
    path: "/v2/ai-control",
    keywords: "costi token budget openai consumo ai control",
    hint: "Config",
  },
];
