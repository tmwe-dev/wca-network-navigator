import JSZip from "jszip";
import { ApiError } from "@/lib/api/apiError";
import {
  EMBEDDED_WHATSAPP_EXTENSION_ZIP_BASE64,
  EMBEDDED_WHATSAPP_EXTENSION_ZIP_VERSION,
} from "@/lib/embeddedWhatsAppExtensionZip";

export const WHATSAPP_EXTENSION_REQUIRED_VERSION = "5.10.17";
export const LINKEDIN_EXTENSION_REQUIRED_VERSION = "3.9.43";
export const PARTNER_CONNECT_EXTENSION_REQUIRED_VERSION = "3.4.3";
export const EMAIL_EXTENSION_REQUIRED_VERSION = "5.0.0";
export const RA_EXTENSION_REQUIRED_VERSION = "1.0";
export const WCA_EXTENSION_REQUIRED_VERSION = "3.0";

const WHATSAPP_EXTENSION_CURRENT_FILENAME = `whatsapp-extension-${WHATSAPP_EXTENSION_REQUIRED_VERSION}.zip`;
const LINKEDIN_EXTENSION_CURRENT_FILENAME = `linkedin-extension-${LINKEDIN_EXTENSION_REQUIRED_VERSION}.zip`;
const PARTNER_CONNECT_EXTENSION_CURRENT_FILENAME = `partner-connect-extension-${PARTNER_CONNECT_EXTENSION_REQUIRED_VERSION}.zip`;
const EMAIL_EXTENSION_CURRENT_FILENAME = `email-extension-${EMAIL_EXTENSION_REQUIRED_VERSION}.zip`;
const RA_EXTENSION_CURRENT_FILENAME = `ra-extension-${RA_EXTENSION_REQUIRED_VERSION}.zip`;
const WCA_EXTENSION_CURRENT_FILENAME = `wca-extension-${WCA_EXTENSION_REQUIRED_VERSION}.zip`;
const WHATSAPP_EXTENSION_CURRENT_PATH = `/chrome-extensions/whatsapp/${WHATSAPP_EXTENSION_CURRENT_FILENAME}`;
const LINKEDIN_EXTENSION_CURRENT_PATH = `/chrome-extensions/linkedin/${LINKEDIN_EXTENSION_CURRENT_FILENAME}`;
const PARTNER_CONNECT_EXTENSION_CURRENT_PATH = `/chrome-extensions/partner-connect/${PARTNER_CONNECT_EXTENSION_CURRENT_FILENAME}`;
const EMAIL_EXTENSION_CURRENT_PATH = `/chrome-extensions/email/${EMAIL_EXTENSION_CURRENT_FILENAME}`;
const RA_EXTENSION_CURRENT_PATH = `/chrome-extensions/ra/${RA_EXTENSION_CURRENT_FILENAME}`;
const WCA_EXTENSION_CURRENT_PATH = `/chrome-extensions/wca/${WCA_EXTENSION_CURRENT_FILENAME}`;
const WHATSAPP_EXTENSION_FALLBACK_PATH = "/whatsapp-extension.zip";
const LINKEDIN_EXTENSION_FALLBACK_PATH = "/linkedin-extension.zip";
const PARTNER_CONNECT_EXTENSION_FALLBACK_PATH = "/partner-connect-extension.zip";
const EMAIL_EXTENSION_FALLBACK_PATH = "/email-extension.zip";
const RA_EXTENSION_FALLBACK_PATH = "/ra-extension.zip";
const WCA_EXTENSION_FALLBACK_PATH = "/wca-extension.zip";
const EXTENSION_CATALOG_PATH = "/chrome-extensions/catalog.json";

export const DEFAULT_EXTENSION_CATALOG: ExtensionCatalog = {
  whatsapp: {
    title: "WhatsApp Direct Send",
    latestVersion: "5.10.17",
    items: [
      {
        version: "5.10.17",
        filename: "whatsapp-extension-5.10.17.zip",
        path: "/chrome-extensions/whatsapp/whatsapp-extension-5.10.17.zip",
        current: true,
        note: "URL fallback robusto: aspetta composer fino a 12s, riempie testo se WA non lo pre-carica, dismiss popup. Risolve invio fallito quando ?text= non viene applicato.",
      },
      {
        version: "5.10.16",
        filename: "whatsapp-extension-5.10.16.zip",
        path: "/chrome-extensions/whatsapp/whatsapp-extension-5.10.16.zip",
        current: false,
        note: "Verifica header chat dopo click search: blocca invio se non corrisponde al destinatario; match esatto preferito.",
      },
      {
        version: "5.10.15",
        filename: "whatsapp-extension-5.10.15.zip",
        path: "/chrome-extensions/whatsapp/whatsapp-extension-5.10.15.zip",
        current: false,
        note: "Hard guard destinatario: numero = sempre URL /send?phone=, mai riuso chat aperta",
      },
      {
        version: "5.10.13",
        filename: "whatsapp-extension-5.10.13.zip",
        path: "/chrome-extensions/whatsapp/whatsapp-extension-5.10.13.zip",
        current: false,
        note: "Fix duplicazione messaggio: trust execCommand insertText, niente fallback paste se l'insert è andato a buon fine",
      },
      {
        version: "5.10.12",
        filename: "whatsapp-extension-5.10.12.zip",
        path: "/chrome-extensions/whatsapp/whatsapp-extension-5.10.12.zip",
        current: false,
        note: "Fix finestre duplicate: niente automation window, riuso tab WhatsApp esistente, lock creazione tab",
      },
      {
        version: "5.10.11",
        filename: "whatsapp-extension-5.10.11.zip",
        path: "/chrome-extensions/whatsapp/whatsapp-extension-5.10.11.zip",
        current: false,
        note: "Fix invio: typing via execCommand (Lexical), poll send button, fallback Enter",
      },
      {
        version: "5.10.10",
        filename: "whatsapp-extension-5.10.10.zip",
        path: "/chrome-extensions/whatsapp/whatsapp-extension-5.10.10.zip",
        current: false,
        note: "Auto-dismiss popup 'Usa qui' (sessione altrove) durante verifySession",
      },
      {
        version: "5.10.9",
        filename: "whatsapp-extension-5.10.9.zip",
        path: "/chrome-extensions/whatsapp/whatsapp-extension-5.10.9.zip",
        current: false,
        note: "Tab inattive senza finestra bianca, riusa tab esistenti web.whatsapp.com",
      },
      {
        version: "5.10.4",
        filename: "whatsapp-extension-5.10.4.zip",
        path: "/chrome-extensions/whatsapp/whatsapp-extension-5.10.4.zip",
        current: false,
        note: "Fix: riusa la tab WhatsApp già autenticata invece di aprirne una nuova",
      },
      {
        version: "5.10.3",
        filename: "whatsapp-extension-5.10.3.zip",
        path: "/chrome-extensions/whatsapp/whatsapp-extension-5.10.3.zip",
        current: false,
        note: "Rimappa DOM invio manuale (Optimus send_form)",
      },
      {
        version: "5.10.2",
        filename: "whatsapp-extension-5.10.2.zip",
        path: "/chrome-extensions/whatsapp/whatsapp-extension-5.10.2.zip",
        current: false,
        note: "Fix selettore search box WA (chat-list-search-container)",
      },
      {
        version: "5.10.1",
        filename: "whatsapp-extension-5.10.1.zip",
        path: "/chrome-extensions/whatsapp/whatsapp-extension-5.10.1.zip",
        current: false,
        note: "Archivio — bridge AI iframe-aware (search box rotta su WA recente)",
      },
      {
        version: "5.10.0",
        filename: "whatsapp-extension-5.10.0.zip",
        path: "/chrome-extensions/whatsapp/whatsapp-extension-5.10.0.zip",
        current: false,
        note: "Archivio — focus isolation, no iframe bridge",
      },
      {
        version: "5.9.0",
        filename: "whatsapp-extension-5.9.0.zip",
        path: "/chrome-extensions/whatsapp/whatsapp-extension-5.9.0.zip",
        current: false,
        note: "Archivio — Optimus V2 (focus stealing bug)",
      },
    ],
  },
  linkedin: {
    title: "LinkedIn Cookie Sync",
    latestVersion: "3.9.43",
    items: [
      {
        version: "3.9.43",
        filename: "linkedin-extension-3.9.43.zip",
        path: "/chrome-extensions/linkedin/linkedin-extension-3.9.43.zip",
        current: true,
        note: "Composer-first fast test: Invia LI e i test isolati usano la tab con composer visibile, senza navigare e senza timeout 90s.",
      },
      {
        version: "3.9.42",
        filename: "linkedin-extension-3.9.42.zip",
        path: "/chrome-extensions/linkedin/linkedin-extension-3.9.42.zip",
        current: false,
        note: "Archivio — ultimo miglio con native click/requestSubmit; ancora lento sul path sendMessage standard.",
      },
      {
        version: "3.9.40",
        filename: "linkedin-extension-3.9.40.zip",
        path: "/chrome-extensions/linkedin/linkedin-extension-3.9.40.zip",
        current: false,
        note: "Manual test safe-path: niente navigazione/click Messaggia nei test diagnostici; ripristinato backup writer Selection API che scrive nel composer già aperto, poi solo ultimo miglio.",
      },
      {
        version: "3.9.39",
        filename: "linkedin-extension-3.9.39.zip",
        path: "/chrome-extensions/linkedin/linkedin-extension-3.9.39.zip",
        current: false,
        note: "Diagnostic fast-path: i pulsanti CDP/Ctrl+Enter/physical_click su /test-extensions partono istantaneamente sul composer LinkedIn già aperto (≤2s). Invio produttivo invariato.",
      },
      {
        version: "3.9.38",
        filename: "linkedin-extension-3.9.38.zip",
        path: "/chrome-extensions/linkedin/linkedin-extension-3.9.38.zip",
        current: false,
        note: "P23 — Single writer policy: AX/AI rimossi dal percorso di invio. Solo DOM writer deterministico (paste/execCommand/textContent) + cascata click. Nessun writer parallelo, fallimenti espliciti.",
      },
      {
        version: "3.9.37",
        filename: "linkedin-extension-3.9.37.zip",
        path: "/chrome-extensions/linkedin/linkedin-extension-3.9.37.zip",
        current: false,
        note: "P22 — clickMessage scoped al top-card profilo (no overlay multipli), readThread/backfill su profilo navigano sempre al target, AX typeMessage off in invio produzione.",
      },
      {
        version: "3.9.36",
        filename: "linkedin-extension-3.9.36.zip",
        path: "/chrome-extensions/linkedin/linkedin-extension-3.9.36.zip",
        current: false,
        note: "P20 — Form submit bounded/no-navigation: niente requestSubmit, niente tab nuove, niente timeout 90s.",
      },
      {
        version: "3.9.34",
        filename: "linkedin-extension-3.9.34.zip",
        path: "/chrome-extensions/linkedin/linkedin-extension-3.9.34.zip",
        current: false,
        note: "P19 — Tutte le azioni no-new-tab; invio con fallback CDP reali per click e Ctrl/Cmd+Enter.",
      },
      {
        version: "3.9.33",
        filename: "linkedin-extension-3.9.33.zip",
        path: "/chrome-extensions/linkedin/linkedin-extension-3.9.33.zip",
        current: false,
        note: "P18 — Invio non invasivo: non apre nuove tab Chrome e non attiva LinkedIn; usa solo una tab LinkedIn già esistente.",
      },
      {
        version: "3.9.32",
        filename: "linkedin-extension-3.9.32.zip",
        path: "/chrome-extensions/linkedin/linkedin-extension-3.9.32.zip",
        current: false,
        note: "P17 — Invio focus-safe: non attiva né porta davanti la tab LinkedIn durante l'invio; l'operatore resta sulla webapp.",
      },
      {
        version: "3.9.31",
        filename: "linkedin-extension-3.9.31.zip",
        path: "/chrome-extensions/linkedin/linkedin-extension-3.9.31.zip",
        current: false,
        note: "P16 — Thread test usa URL fisso/profilo; invio finale con physical click + form submit + Ctrl/Cmd Enter fallback.",
      },
      {
        version: "3.9.29",
        filename: "linkedin-extension-3.9.29.zip",
        path: "/chrome-extensions/linkedin/linkedin-extension-3.9.29.zip",
        current: false,
        note: "P1/P2 — ReadThread e backfill robusti, dedup stabile, ID reali e pannello qualità sync.",
      },
      {
        version: "3.9.28",
        filename: "linkedin-extension-3.9.28.zip",
        path: "/chrome-extensions/linkedin/linkedin-extension-3.9.28.zip",
        current: false,
        note: "P0 — Dedup chiave composita (mai solo nome), AX Tree honest, method/confidence su thread e messaggi.",
      },
      {
        version: "3.9.27",
        filename: "linkedin-extension-3.9.27.zip",
        path: "/chrome-extensions/linkedin/linkedin-extension-3.9.27.zip",
        current: false,
        note: "P15.2 — Fix avvio test: il diagnostico naviga al profilo richiesto prima di cercare il composer.",
      },
      {
        version: "3.9.26",
        filename: "linkedin-extension-3.9.26.zip",
        path: "/chrome-extensions/linkedin/linkedin-extension-3.9.26.zip",
        current: false,
        note: "P15.1 — Fix bridge: il content script ora inoltra `method` al background, sbloccando i 3 test diagnostici di click invio.",
      },
      {
        version: "3.9.25",
        filename: "linkedin-extension-3.9.25.zip",
        path: "/chrome-extensions/linkedin/linkedin-extension-3.9.25.zip",
        current: false,
        note: "P15 — Diagnostico: 3 pulsanti di test isolati per i metodi di click invio (physical_click / form_submit / keyboard_shortcut). Cascata produzione invariata.",
      },
      {
        version: "3.9.24",
        filename: "linkedin-extension-3.9.24.zip",
        path: "/chrome-extensions/linkedin/linkedin-extension-3.9.24.zip",
        current: false,
        note: "P14 — Riusa il composer LinkedIn già aperto: non naviga fuori pagina, non apre una seconda chat, non forza focus; conserva invio P13.",
      },
      {
        version: "3.9.21",
        filename: "linkedin-extension-3.9.21.zip",
        path: "/chrome-extensions/linkedin/linkedin-extension-3.9.21.zip",
        current: false,
        note: "Anti-mis-recipient: chiude overlay chat fluttuanti e verifica URL profilo prima di clickMessage/sendMessage",
      },
      {
        version: "3.9.19",
        filename: "linkedin-extension-3.9.19.zip",
        path: "/chrome-extensions/linkedin/linkedin-extension-3.9.19.zip",
        current: false,
        note: "Fix invio: timeout AX/AI controllati, bridge test a 90s, rimappa DOM su thread reale.",
      },
      {
        version: "3.9.18",
        filename: "linkedin-extension-3.9.18.zip",
        path: "/chrome-extensions/linkedin/linkedin-extension-3.9.18.zip",
        current: false,
        note: "Fix invio: textbox cercato in shadow DOM, attesa thread + readyState, polling esteso a 20s.",
      },
      {
        version: "3.9.17",
        filename: "linkedin-extension-3.9.17.zip",
        path: "/chrome-extensions/linkedin/linkedin-extension-3.9.17.zip",
        current: false,
        note: "Fix invio: guardia URL accetta /messaging/thread/ (LinkedIn redireziona la tab dopo click Messaggia per contatti 1° grado)",
      },
      {
        version: "3.9.16",
        filename: "linkedin-extension-3.9.16.zip",
        path: "/chrome-extensions/linkedin/linkedin-extension-3.9.16.zip",
        current: false,
        note: "Diagnostica invio: probe DOM read-only quando textbox non trovato (overlay/dialog/contenteditable counts).",
      },
      {
        version: "3.9.15",
        filename: "linkedin-extension-3.9.15.zip",
        path: "/chrome-extensions/linkedin/linkedin-extension-3.9.15.zip",
        current: false,
        note: "Fix invio: bottone Messaggia scoped al profilo (esclude top-nav inbox), guardia URL pre-invio + retry su drift",
      },
      {
        version: "3.9.14",
        filename: "linkedin-extension-3.9.14.zip",
        path: "/chrome-extensions/linkedin/linkedin-extension-3.9.14.zip",
        current: false,
        note: "Fix invio: textbox composer più robusto, supporto dialog e menu Altro/More",
      },
      {
        version: "3.9.13",
        filename: "linkedin-extension-3.9.13.zip",
        path: "/chrome-extensions/linkedin/linkedin-extension-3.9.13.zip",
        current: false,
        note: "Fix extractProfile: scoped a <main>, blacklist nav (no più 'Nome: 0 notifiche'), headline+location anche da AX tree",
      },
      {
        version: "3.9.12",
        filename: "linkedin-extension-3.9.12.zip",
        path: "/chrome-extensions/linkedin/linkedin-extension-3.9.12.zip",
        current: false,
        note: "Fix invio: poll textbox 8s + retry click Messaggia + attesa Send abilitato",
      },
      {
        version: "3.9.11",
        filename: "linkedin-extension-3.9.11.zip",
        path: "/chrome-extensions/linkedin/linkedin-extension-3.9.11.zip",
        current: false,
        note: "Deep inbox harvest: più thread, ID e URL profilo contatto-specifici",
      },
      {
        version: "3.9.10",
        filename: "linkedin-extension-3.9.10.zip",
        path: "/chrome-extensions/linkedin/linkedin-extension-3.9.10.zip",
        current: false,
        note: "Harvest URL inbox post-Optimus: recupera thread/profile URL anche da plan cached",
      },
      {
        version: "3.9.9",
        filename: "linkedin-extension-3.9.9.zip",
        path: "/chrome-extensions/linkedin/linkedin-extension-3.9.9.zip",
        current: false,
        note: "Fallback profile URL nelle inbox cards senza thread anchor (contatti con URL valido)",
      },
      {
        version: "3.9.8",
        filename: "linkedin-extension-3.9.8.zip",
        path: "/chrome-extensions/linkedin/linkedin-extension-3.9.8.zip",
        current: false,
        note: "Tab inattive senza finestra bianca, riusa tab esistenti linkedin.com",
      },
      {
        version: "3.9.3",
        filename: "linkedin-extension-3.9.3.zip",
        path: "/chrome-extensions/linkedin/linkedin-extension-3.9.3.zip",
        current: false,
        note: "Rimappa DOM invio manuale (Optimus relearn messaging/profile)",
      },
      {
        version: "3.9.2",
        filename: "linkedin-extension-3.9.2.zip",
        path: "/chrome-extensions/linkedin/linkedin-extension-3.9.2.zip",
        current: false,
        note: "Optimus V2.1 — bridge AI ora trova la webapp anche dentro iframe (editor Lovable)",
      },
      {
        version: "3.9.0",
        filename: "linkedin-extension-3.9.0.zip",
        path: "/chrome-extensions/linkedin/linkedin-extension-3.9.0.zip",
        current: false,
        note: "Archivio — focus isolation, no iframe bridge",
      },
      {
        version: "3.8.0",
        filename: "linkedin-extension-3.8.0.zip",
        path: "/chrome-extensions/linkedin/linkedin-extension-3.8.0.zip",
        current: false,
        note: "Archivio — Optimus V2 (focus stealing bug)",
      },
    ],
  },
  "partner-connect": {
    title: "Partner Connect",
    latestVersion: "3.4.3",
    items: [
      {
        version: "3.4.3",
        filename: "partner-connect-extension-3.4.3.zip",
        path: "/chrome-extensions/partner-connect/partner-connect-extension-3.4.3.zip",
        current: true,
        note: "Partner Connect 3.4.3 — canale LinkedIn disabilitato: LinkedIn passa solo da LinkedIn Cookie Sync.",
      },
      {
        version: "3.4.2",
        filename: "partner-connect-extension-3.4.2.zip",
        path: "/chrome-extensions/partner-connect/partner-connect-extension-3.4.2.zip",
        current: false,
        note: "Archivio.",
      },
    ],
  },
  email: {
    title: "Email Client Universale",
    latestVersion: "5.0.0",
    items: [
      {
        version: "5.0.0",
        filename: "email-extension-5.0.0.zip",
        path: "/chrome-extensions/email/email-extension-5.0.0.zip",
        current: true,
        note: "Universal Communication Hub — pannello laterale email e canali.",
      },
    ],
  },
  ra: {
    title: "ReportAziende Cookie Sync",
    latestVersion: "1.0",
    items: [
      {
        version: "1.0",
        filename: "ra-extension-1.0.zip",
        path: "/chrome-extensions/ra/ra-extension-1.0.zip",
        current: true,
        note: "Login automatico e sincronizzazione cookie per ReportAziende.it.",
      },
    ],
  },
  wca: {
    title: "WCA Cookie Sync",
    latestVersion: "3.0",
    items: [
      {
        version: "3.0",
        filename: "wca-extension-3.0.zip",
        path: "/chrome-extensions/wca/wca-extension-3.0.zip",
        current: true,
        note: "Login automatico, sincronizzazione cookie ed estrazione contatti WCA.",
      },
    ],
  },
};

export type ExtensionCatalogChannel = "partner-connect" | "whatsapp" | "linkedin" | "email" | "ra" | "wca";

export interface ExtensionCatalogItem {
  version: string;
  filename: string;
  path: string;
  current: boolean;
  note?: string;
}

export interface ExtensionCatalogSection {
  title: string;
  latestVersion: string;
  items: ExtensionCatalogItem[];
}

export interface ExtensionCatalog {
  "partner-connect"?: ExtensionCatalogSection;
  whatsapp?: ExtensionCatalogSection;
  linkedin?: ExtensionCatalogSection;
  email?: ExtensionCatalogSection;
  ra?: ExtensionCatalogSection;
  wca?: ExtensionCatalogSection;
}

async function fetchStaticAsset(assetPath: string, fallbackPaths: string[] = []) {
  let lastError: unknown;

  for (const path of [assetPath, ...fallbackPaths]) {
    try {
      const response = await fetch(`${path}?t=${Date.now()}`, {
        cache: "no-store",
      });

      if (response.ok) {
        return response;
      }

      lastError = await ApiError.fromResponse(response, `fetchStaticAsset:${path}:${response.status}`);
    } catch (err) {
      lastError = ApiError.from(err, `fetchStaticAsset:${path}`);
    }
  }

  throw (lastError instanceof Error ? lastError : new Error(`Static asset unavailable: ${assetPath}`));
}

function base64ToBlob(base64: string, mimeType: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
}

async function bytesToShortHash(bytes: ArrayBuffer): Promise<string> {
  try {
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const arr = Array.from(new Uint8Array(digest));
    return arr.slice(0, 4).map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return Date.now().toString(16).slice(-8);
  }
}

async function readManifestVersionFromZip(blob: Blob): Promise<string | null> {
  try {
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const manifest = zip.file("manifest.json");
    if (!manifest) return null;
    const content = await manifest.async("string");
    const parsed = JSON.parse(content) as { version?: string };
    return typeof parsed.version === "string" ? parsed.version : null;
  } catch {
    return null;
  }
}

function appendHashToFilename(filename: string, hash: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot < 0) return `${filename}-${hash}`;
  return `${filename.slice(0, dot)}-${hash}${filename.slice(dot)}`;
}

export async function downloadStaticExtensionZip(
  assetPath: string,
  filename: string,
  fallbackPaths: string[] = [],
  expectedVersion?: string,
) {
  let blob: Blob;

  try {
    const response = await fetchStaticAsset(assetPath, fallbackPaths);
    blob = await response.blob();
  } catch (error) {
    // Embedded fallback only for the CURRENT WhatsApp version AND only if the
    // embedded base64 truly contains that same version. This prevents serving
    // a stale ZIP under a fresh filename (es. 5.5.1 mascherata da 5.7.0).
    if (
      filename === WHATSAPP_EXTENSION_CURRENT_FILENAME &&
      (EMBEDDED_WHATSAPP_EXTENSION_ZIP_VERSION as string) === (WHATSAPP_EXTENSION_REQUIRED_VERSION as string)
    ) {
      blob = base64ToBlob(EMBEDDED_WHATSAPP_EXTENSION_ZIP_BASE64, "application/zip");
    } else {
      throw error;
    }
  }

  // Guard B: validate manifest version inside the ZIP before serving.
  if (expectedVersion) {
    const buf = await blob.arrayBuffer();
    const actualVersion = await readManifestVersionFromZip(new Blob([buf]));
    if (actualVersion && actualVersion !== expectedVersion) {
      throw new Error(
        `ZIP corrotto: contiene v${actualVersion} ma il filename dichiara v${expectedVersion}. Riprova fra qualche secondo.`,
      );
    }
    // Guard A: append integrity hash to the filename so any cached/intermediate
    // copy is immediately distinguishable from the freshly downloaded one.
    const hash = await bytesToShortHash(buf);
    const finalName = appendHashToFilename(filename, hash);
    blob = new Blob([buf], { type: "application/zip" });
    triggerDownload(blob, finalName);
    return;
  }

  triggerDownload(blob, filename);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function fetchExtensionCatalog(): Promise<ExtensionCatalog> {
  try {
    const response = await fetchStaticAsset(EXTENSION_CATALOG_PATH);
    return (await response.json()) as ExtensionCatalog;
  } catch {
    return DEFAULT_EXTENSION_CATALOG;
  }
}

export async function downloadWhatsAppExtensionZip() {
  return downloadStaticExtensionZip(
    WHATSAPP_EXTENSION_CURRENT_PATH,
    WHATSAPP_EXTENSION_CURRENT_FILENAME,
    [WHATSAPP_EXTENSION_FALLBACK_PATH],
    WHATSAPP_EXTENSION_REQUIRED_VERSION,
  );
}

export async function downloadLinkedInExtensionZip() {
  return downloadStaticExtensionZip(
    LINKEDIN_EXTENSION_CURRENT_PATH,
    LINKEDIN_EXTENSION_CURRENT_FILENAME,
    [LINKEDIN_EXTENSION_FALLBACK_PATH],
    LINKEDIN_EXTENSION_REQUIRED_VERSION,
  );
}

export async function downloadPartnerConnectExtensionZip() {
  return downloadStaticExtensionZip(
    PARTNER_CONNECT_EXTENSION_CURRENT_PATH,
    PARTNER_CONNECT_EXTENSION_CURRENT_FILENAME,
    [PARTNER_CONNECT_EXTENSION_FALLBACK_PATH],
    PARTNER_CONNECT_EXTENSION_REQUIRED_VERSION,
  );
}

export async function downloadEmailExtensionZip() {
  return downloadStaticExtensionZip(
    EMAIL_EXTENSION_CURRENT_PATH,
    EMAIL_EXTENSION_CURRENT_FILENAME,
    [EMAIL_EXTENSION_FALLBACK_PATH],
    EMAIL_EXTENSION_REQUIRED_VERSION,
  );
}

export async function downloadRaExtensionZip() {
  return downloadStaticExtensionZip(
    RA_EXTENSION_CURRENT_PATH,
    RA_EXTENSION_CURRENT_FILENAME,
    [RA_EXTENSION_FALLBACK_PATH],
    RA_EXTENSION_REQUIRED_VERSION,
  );
}

export async function downloadWcaExtensionZip() {
  return downloadStaticExtensionZip(
    WCA_EXTENSION_CURRENT_PATH,
    WCA_EXTENSION_CURRENT_FILENAME,
    [WCA_EXTENSION_FALLBACK_PATH],
    WCA_EXTENSION_REQUIRED_VERSION,
  );
}
