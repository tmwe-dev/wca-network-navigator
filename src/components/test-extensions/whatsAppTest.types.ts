/**
 * Tipi, costanti e helper puri di WhatsAppTest.
 */
export const WA_FIXED_RECIPIENT_KEY = "wa_test_fixed_recipient";
export const WA_LEGACY_LAST_RECIPIENT_KEY = "wa_test_last_recipient";

export interface FoundContact {
  contact: string;
  time?: string;
}

export interface StoredWaTestRecipient {
  phone?: string;
  name?: string | null;
  company?: string | null;
  savedAt?: string;
}

export function normalizeWaTestPhone(raw: string): string | null {
  const cleaned = raw.trim().replace(/[^0-9+]/g, "");
  const digits = cleaned.replace(/^\+/, "");
  if (digits.length < 7) return null;
  return cleaned.startsWith("+") ? cleaned : `+${digits}`;
}