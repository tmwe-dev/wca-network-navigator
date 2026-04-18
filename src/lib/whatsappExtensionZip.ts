import JSZip from "jszip";
import { ApiError } from "@/lib/api/apiError";
import {
  EMBEDDED_WHATSAPP_EXTENSION_ZIP_BASE64,
  EMBEDDED_WHATSAPP_EXTENSION_ZIP_VERSION,
} from "@/lib/embeddedWhatsAppExtensionZip";

export const WHATSAPP_EXTENSION_REQUIRED_VERSION = "5.8.0";
export const LINKEDIN_EXTENSION_REQUIRED_VERSION = "3.7.0";

const WHATSAPP_EXTENSION_CURRENT_FILENAME = `whatsapp-extension-${WHATSAPP_EXTENSION_REQUIRED_VERSION}.zip`;
const LINKEDIN_EXTENSION_CURRENT_FILENAME = `linkedin-extension-${LINKEDIN_EXTENSION_REQUIRED_VERSION}.zip`;
const WHATSAPP_EXTENSION_CURRENT_PATH = `/chrome-extensions/whatsapp/${WHATSAPP_EXTENSION_CURRENT_FILENAME}`;
const LINKEDIN_EXTENSION_CURRENT_PATH = `/chrome-extensions/linkedin/${LINKEDIN_EXTENSION_CURRENT_FILENAME}`;
const WHATSAPP_EXTENSION_FALLBACK_PATH = "/whatsapp-extension.zip";
const LINKEDIN_EXTENSION_FALLBACK_PATH = "/linkedin-extension.zip";
const EXTENSION_CATALOG_PATH = "/chrome-extensions/catalog.json";

export const DEFAULT_EXTENSION_CATALOG: ExtensionCatalog = {
  whatsapp: {
    title: "WhatsApp Direct Send",
    latestVersion: "5.8.0",
    items: [
      {
        version: "5.8.0",
        filename: "whatsapp-extension-5.8.0.zip",
        path: "/chrome-extensions/whatsapp/whatsapp-extension-5.8.0.zip",
        current: true,
        note: "Versione corrente — M3/M7 badge detection senza data-testid + fallback strutturali, M4 brief tab activation per sbloccare DOM throttling background",
      },
      {
        version: "5.7.0",
        filename: "whatsapp-extension-5.7.0.zip",
        path: "/chrome-extensions/whatsapp/whatsapp-extension-5.7.0.zip",
        current: false,
        note: "Archivio — prompt AI ottimizzati IT, snapshot DOM arricchito",
      },
    ],
  },
  linkedin: {
    title: "LinkedIn Cookie Sync",
    latestVersion: "3.7.0",
    items: [
      {
        version: "3.7.0",
        filename: "linkedin-extension-3.7.0.zip",
        path: "/chrome-extensions/linkedin/linkedin-extension-3.7.0.zip",
        current: true,
        note: "Versione corrente — M1 anti-multitab (cerca tab esistenti), M2 dedup inbox + filtro notification badge, M5 brief tab activation",
      },
      {
        version: "3.6.0",
        filename: "linkedin-extension-3.6.0.zip",
        path: "/chrome-extensions/linkedin/linkedin-extension-3.6.0.zip",
        current: false,
        note: "Archivio — prompt AI ottimizzati IT con threadUrl + direction + auth",
      },
    ],
  },
};

export type ExtensionCatalogChannel = "whatsapp" | "linkedin";

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
  whatsapp?: ExtensionCatalogSection;
  linkedin?: ExtensionCatalogSection;
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
      EMBEDDED_WHATSAPP_EXTENSION_ZIP_VERSION === WHATSAPP_EXTENSION_REQUIRED_VERSION
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
