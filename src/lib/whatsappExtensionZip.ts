import { ApiError } from "@/lib/api/apiError";

export const WHATSAPP_EXTENSION_REQUIRED_VERSION = "5.3.2";
export const LINKEDIN_EXTENSION_REQUIRED_VERSION = "3.2.1";

const WHATSAPP_EXTENSION_CURRENT_FILENAME = `whatsapp-extension-${WHATSAPP_EXTENSION_REQUIRED_VERSION}.zip`;
const LINKEDIN_EXTENSION_CURRENT_FILENAME = `linkedin-extension-${LINKEDIN_EXTENSION_REQUIRED_VERSION}.zip`;
const WHATSAPP_EXTENSION_CURRENT_PATH = `/chrome-extensions/whatsapp/${WHATSAPP_EXTENSION_CURRENT_FILENAME}`;
const LINKEDIN_EXTENSION_CURRENT_PATH = `/chrome-extensions/linkedin/${LINKEDIN_EXTENSION_CURRENT_FILENAME}`;
const EXTENSION_CATALOG_PATH = "/chrome-extensions/catalog.json";

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

async function fetchStaticAsset(assetPath: string) {
  let response: Response;

  try {
    response = await fetch(`${assetPath}?t=${Date.now()}`, {
      cache: "no-store",
    });
  } catch (err) {
    throw ApiError.from(err, "fetchStaticAsset");
  }

  if (!response.ok) {
    throw await ApiError.fromResponse(response, "fetchStaticAsset");
  }

  return response;
}

export async function downloadStaticExtensionZip(assetPath: string, filename: string) {
  const response = await fetchStaticAsset(assetPath);
  const blob = await response.blob();
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
  const response = await fetchStaticAsset(EXTENSION_CATALOG_PATH);
  return (await response.json()) as ExtensionCatalog;
}

export async function downloadWhatsAppExtensionZip() {
  return downloadStaticExtensionZip(
    WHATSAPP_EXTENSION_CURRENT_PATH,
    WHATSAPP_EXTENSION_CURRENT_FILENAME
  );
}

export async function downloadLinkedInExtensionZip() {
  return downloadStaticExtensionZip(
    LINKEDIN_EXTENSION_CURRENT_PATH,
    LINKEDIN_EXTENSION_CURRENT_FILENAME
  );
}
