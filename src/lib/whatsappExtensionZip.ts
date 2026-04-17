import JSZip from "jszip";
import { ApiError } from "@/lib/api/apiError";

const WHATSAPP_EXTENSION_ZIP_FILENAME = "whatsapp-extension.zip";
const LINKEDIN_EXTENSION_ZIP_FILENAME = "linkedin-extension.zip";

export const WHATSAPP_EXTENSION_REQUIRED_VERSION = "5.3.2";
export const LINKEDIN_EXTENSION_REQUIRED_VERSION = "3.2.1";

const EXTENSION_FILES = {
  "whatsapp-extension": [
    "actions.js",
    "ai-bridge.js",
    "ai-extract.js",
    "background.js",
    "config.js",
    "content.js",
    "discovery.js",
    "icon.png",
    "icon128.png",
    "icon16.png",
    "icon48.png",
    "manifest.json",
    "optimus-client.js",
    "popup.html",
    "popup.js",
    "tab-manager.js",
  ],
  "linkedin-extension": [
    "actions.js",
    "ai-bridge.js",
    "ai-learn.js",
    "auth.js",
    "ax-tree.js",
    "background.js",
    "config.js",
    "content.js",
    "hybrid-ops.js",
    "icon.png",
    "manifest.json",
    "optimus-client.js",
    "popup.html",
    "popup.js",
    "tab-manager.js",
  ],
} as const;

type ExtensionFolder = keyof typeof EXTENSION_FILES;

async function fetchExtensionFile(folder: ExtensionFolder, file: string, version: string) {
  let response: Response;

  try {
    response = await fetch(`/${folder}/${file}?v=${encodeURIComponent(version)}&t=${Date.now()}`, {
      cache: "no-store",
    });
  } catch (err) {
    throw ApiError.from(err, "fetchExtensionFile");
  }

  if (!response.ok) {
    throw await ApiError.fromResponse(response, "fetchExtensionFile");
  }

  return response.blob();
}

async function downloadExtensionFolderZip(folder: ExtensionFolder, zipFilename: string, version: string) {
  const zip = new JSZip();

  await Promise.all(
    EXTENSION_FILES[folder].map(async (file) => {
      const blob = await fetchExtensionFile(folder, file, version);
      zip.file(file, blob);
    })
  );

  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = zipFilename.replace(".zip", `-${version}.zip`);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function downloadWhatsAppExtensionZip() {
  return downloadExtensionFolderZip(
    "whatsapp-extension",
    WHATSAPP_EXTENSION_ZIP_FILENAME,
    WHATSAPP_EXTENSION_REQUIRED_VERSION
  );
}

export async function downloadLinkedInExtensionZip() {
  return downloadExtensionFolderZip(
    "linkedin-extension",
    LINKEDIN_EXTENSION_ZIP_FILENAME,
    LINKEDIN_EXTENSION_REQUIRED_VERSION
  );
}
