import { ApiError } from "@/lib/api/apiError";
import { EMBEDDED_WHATSAPP_EXTENSION_ZIP_BASE64 } from "@/lib/embeddedWhatsAppExtensionZip";

export const WHATSAPP_EXTENSION_REQUIRED_VERSION = "5.6.0";
export const LINKEDIN_EXTENSION_REQUIRED_VERSION = "3.5.0";

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
    latestVersion: "5.6.0",
    items: [
      {
        version: "5.6.0",
        filename: "whatsapp-extension-5.6.0.zip",
        path: "/chrome-extensions/whatsapp/whatsapp-extension-5.6.0.zip",
        current: true,
        note: "Versione corrente — Optimus auto-relearn + cache locale piano AI 24h + fallback edge function diretto",
      },
      {
        version: "5.5.1",
        filename: "whatsapp-extension-5.5.1.zip",
        path: "/chrome-extensions/whatsapp/whatsapp-extension-5.5.1.zip",
        current: false,
        note: "Archivio — fallback legacy permissivo + Optimus module-check",
      },
    ],
  },
  linkedin: {
    title: "LinkedIn Cookie Sync",
    latestVersion: "3.5.0",
    items: [
      {
        version: "3.5.0",
        filename: "linkedin-extension-3.5.0.zip",
        path: "/chrome-extensions/linkedin/linkedin-extension-3.5.0.zip",
        current: true,
        note: "Versione corrente — Optimus auto-relearn LinkedIn + fallback edge function diretto + cache schema 3h",
      },
      {
        version: "3.4.0",
        filename: "linkedin-extension-3.4.0.zip",
        path: "/chrome-extensions/linkedin/linkedin-extension-3.4.0.zip",
        current: false,
        note: "Archivio — stealth background, no focus hijack",
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

export async function downloadStaticExtensionZip(assetPath: string, filename: string, fallbackPaths: string[] = []) {
  let blob: Blob;

  try {
    const response = await fetchStaticAsset(assetPath, fallbackPaths);
    blob = await response.blob();
  } catch (error) {
    // Embedded fallback only for the CURRENT WhatsApp version — guarantees
    // user always gets a coherent ZIP, never a stale one.
    if (filename === WHATSAPP_EXTENSION_CURRENT_FILENAME) {
      blob = base64ToBlob(EMBEDDED_WHATSAPP_EXTENSION_ZIP_BASE64, "application/zip");
    } else {
      throw error;
    }
  }

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
    [WHATSAPP_EXTENSION_FALLBACK_PATH]
  );
}

export async function downloadLinkedInExtensionZip() {
  return downloadStaticExtensionZip(
    LINKEDIN_EXTENSION_CURRENT_PATH,
    LINKEDIN_EXTENSION_CURRENT_FILENAME,
    [LINKEDIN_EXTENSION_FALLBACK_PATH]
  );
}
