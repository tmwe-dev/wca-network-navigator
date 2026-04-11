import { createLogger } from "@/lib/log";

const log = createLogger("wcaCookieStore");
/**
 * WCA Session Cookie — modulo centralizzato per gestione cookie di sessione.
 * 
 * Strategia di sicurezza: cookie in memoria con fallback localStorage per persistenza.
 * Il cookie viene invalidato dopo TTL_MS (8 minuti).
 * 
 * Vol. II §6.4 — ridurre superficie di attacco XSS evitando duplicazione.
 */

const STORAGE_KEY = "wca_session_cookie";
const TTL_MS = 8 * 60 * 1000; // 8 minuti

// In-memory primary store (non accessibile via XSS su localStorage)
let memCookie: string | null = null;
let memSavedAt = 0;

/**
 * Salva il cookie WCA in memoria + localStorage (fallback persistenza).
 */
export function setWcaCookie(cookie: string): void {
  memCookie = cookie;
  memSavedAt = Date.now();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ cookie, savedAt: memSavedAt }));
  } catch (e) {
    log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) });
    // localStorage non disponibile — in-memory only
  }
}

/**
 * Recupera il cookie WCA se ancora valido (entro TTL).
 * Priorità: memoria → localStorage.
 */
export function getWcaCookie(): string | null {
  // In-memory first
  if (memCookie && Date.now() - memSavedAt < TTL_MS) {
    return memCookie;
  }

  // Fallback localStorage
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.cookie && Date.now() - parsed.savedAt < TTL_MS) {
        // Promote to memory
        memCookie = parsed.cookie;
        memSavedAt = parsed.savedAt;
        return parsed.cookie;
      }
    }
  } catch (e) {
    log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) });
    // corrupted or unavailable
  }

  return null;
}

/**
 * Controlla se c'è un cookie valido senza restituirlo.
 */
export function hasWcaCookie(): boolean {
  return getWcaCookie() !== null;
}

/**
 * Invalida il cookie (logout/errore).
 */
export function clearWcaCookie(): void {
  memCookie = null;
  memSavedAt = 0;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) });
    // ignore
  }
}
