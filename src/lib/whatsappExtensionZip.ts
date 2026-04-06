const WHATSAPP_EXTENSION_ZIP_FILENAME = "whatsapp-extension.zip";

export const WHATSAPP_EXTENSION_REQUIRED_VERSION = "4.1-sessionfix";

export async function downloadWhatsAppExtensionZip() {
  const response = await fetch(`/${WHATSAPP_EXTENSION_ZIP_FILENAME}`);

  if (!response.ok) {
    throw new Error(`Download failed: ${response.status}`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = WHATSAPP_EXTENSION_ZIP_FILENAME;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
