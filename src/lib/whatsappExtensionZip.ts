import { ApiError } from "@/lib/api/apiError";
import { EMBEDDED_WHATSAPP_EXTENSION_ZIP_BASE64 } from "@/lib/embeddedWhatsAppExtensionZip";

export const WHATSAPP_EXTENSION_REQUIRED_VERSION = "5.4.2";
export const LINKEDIN_EXTENSION_REQUIRED_VERSION = "3.3.0";

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
    latestVersion: "5.4.0",
    items: [
      {
        version: "5.4.0",
        filename: "whatsapp-extension-5.4.0.zip",
        path: "/chrome-extensions/whatsapp/whatsapp-extension-5.4.0.zip",
        current: true,
        note: "Versione corrente",
      },
      {
        version: "5.3.2",
        filename: "whatsapp-extension-5.3.2.zip",
        path: "/chrome-extensions/whatsapp/whatsapp-extension-5.3.2.zip",
        current: false,
        note: "Archivio",
      },
      {
        version: "1.1",
        filename: "whatsapp-extension-1.1.zip",
        path: "/chrome-extensions/whatsapp/whatsapp-extension-1.1.zip",
        current: false,
        note: "Archivio compatibilità",
      },
    ],
  },
  linkedin: {
    title: "LinkedIn Cookie Sync",
    latestVersion: "3.3.0",
    items: [
      {
        version: "3.3.0",
        filename: "linkedin-extension-3.3.0.zip",
        path: "/chrome-extensions/linkedin/linkedin-extension-3.3.0.zip",
        current: true,
        note: "Versione corrente",
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

      lastError = await ApiError.fromResponse(response, "fetchStaticAsset");
    } catch (err) {
      lastError = ApiError.from(err, "fetchStaticAsset");
    }
  }

  throw (lastError instanceof Error ? lastError : new Error("Static asset unavailable"));
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
