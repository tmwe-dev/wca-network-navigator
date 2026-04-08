import { ApiError } from "@/lib/api/apiError";

const WHATSAPP_EXTENSION_ZIP_FILENAME = "whatsapp-extension.zip";

export const WHATSAPP_EXTENSION_REQUIRED_VERSION = "5.1-csp";

export async function downloadWhatsAppExtensionZip() {
  let response: Response;
  try {
    response = await fetch(`/${WHATSAPP_EXTENSION_ZIP_FILENAME}`);
  } catch (err) {
    throw ApiError.from(err, "downloadWhatsAppExtensionZip");
  }

  if (!response.ok) {
    throw await ApiError.fromResponse(response, "downloadWhatsAppExtensionZip");
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
