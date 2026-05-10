/**
 * LinkedIn send strategies — sperimentale, lato client.
 *
 * Le quattro strategie permettono di testare combinazioni di guard
 * (timeout su readInbox + dedup anti-duplicazione) sopra l'estensione
 * 3.9.56 ripristinata, senza dover reinstallare l'extension ogni volta.
 *
 * - A "pure_3956": comportamento identico a 3.9.56. Nessun guard client.
 * - B "timeout":   wrap di readInbox in Promise.race con timeout breve.
 * - C "dedup":     idempotency key (sha1 di recipient+text+window 30s)
 *                  in localStorage. Blocca il secondo invio identico
 *                  entro 30 secondi.
 * - D "both":      B + C insieme.
 */

export type LinkedInSendStrategy = "pure_3956" | "timeout" | "dedup" | "both";

export const LI_STRATEGY_STORAGE_KEY = "li_test_send_strategy";
export const LI_STRATEGY_DEFAULT: LinkedInSendStrategy = "pure_3956";

const DEDUP_WINDOW_MS = 30_000;
const DEDUP_TTL_MS = 5 * 60_000;
const DEDUP_STORAGE_KEY = "li_test_send_dedup";
const READ_INBOX_TIMEOUT_MS = 12_000;

export const STRATEGY_LABELS: Record<LinkedInSendStrategy, string> = {
  pure_3956: "A · Pure 3.9.56",
  timeout: "B · 3.9.56 + readInbox timeout",
  dedup: "C · 3.9.56 + anti-duplicazione",
  both: "D · timeout + anti-duplicazione",
};

export const STRATEGY_DESCRIPTIONS: Record<LinkedInSendStrategy, string> = {
  pure_3956:
    "Comportamento identico alla 3.9.56 originale. Nessun guard client. Baseline di confronto. Può duplicare messaggi se l'AI re-learn riparte.",
  timeout:
    "readInbox viene avvolto in un timeout client di 12s: se l'extension hangia, l'UI lo riconosce e lascia ritentare al ciclo dopo. Risolve gli hang da 90s.",
  dedup:
    "Prima di ogni invio calcola una idempotency key (recipient + text + finestra 30s) e la salva in localStorage. Se identica esiste già, l'invio è bloccato lato client (zero chiamate all'extension).",
  both: "Entrambi i guard attivi. Probabilmente la configurazione definitiva.",
};

export function loadStrategy(): LinkedInSendStrategy {
  try {
    const v = localStorage.getItem(LI_STRATEGY_STORAGE_KEY) as LinkedInSendStrategy | null;
    if (v === "pure_3956" || v === "timeout" || v === "dedup" || v === "both") return v;
  } catch { /* noop */ }
  return LI_STRATEGY_DEFAULT;
}

export function saveStrategy(s: LinkedInSendStrategy): void {
  try { localStorage.setItem(LI_STRATEGY_STORAGE_KEY, s); } catch { /* noop */ }
}

export function strategyHasTimeout(s: LinkedInSendStrategy): boolean {
  return s === "timeout" || s === "both";
}

export function strategyHasDedup(s: LinkedInSendStrategy): boolean {
  return s === "dedup" || s === "both";
}

/**
 * Promise.race con timeout. Se scade, risolve con `null` (no throw)
 * così il chiamante può degradare con messaggio user-friendly.
 */
export async function withClientTimeout<T>(
  p: Promise<T>,
  ms: number = READ_INBOX_TIMEOUT_MS,
): Promise<T | null> {
  return await Promise.race<T | null>([
    p,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

/* ── Idempotency / dedup ─────────────────────────────────────────── */

function normalizeText(t: string): string {
  return t.replace(/\s+/g, " ").trim().toLowerCase();
}

async function sha1Hex(input: string): Promise<string> {
  try {
    if (typeof crypto !== "undefined" && crypto.subtle) {
      const buf = new TextEncoder().encode(input);
      const digest = await crypto.subtle.digest("SHA-1", buf);
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
  } catch { /* fallback below */ }
  // Fallback hash semplice (non crittografico, sufficiente per dedup locale).
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) | 0;
  }
  return `fallback-${(h >>> 0).toString(16)}`;
}

export async function buildIdempotencyKey(
  recipient: string,
  text: string,
  now: number = Date.now(),
): Promise<string> {
  const window = Math.floor(now / DEDUP_WINDOW_MS);
  return await sha1Hex(`${recipient.trim()}|${normalizeText(text)}|${window}`);
}

interface DedupEntry { key: string; at: number }

function readDedup(): DedupEntry[] {
  try {
    const raw = localStorage.getItem(DEDUP_STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as DedupEntry[];
    if (!Array.isArray(arr)) return [];
    const cutoff = Date.now() - DEDUP_TTL_MS;
    return arr.filter((e) => e && typeof e.key === "string" && typeof e.at === "number" && e.at > cutoff);
  } catch { return []; }
}

function writeDedup(entries: DedupEntry[]): void {
  try { localStorage.setItem(DEDUP_STORAGE_KEY, JSON.stringify(entries)); } catch { /* noop */ }
}

export function isDuplicateKey(key: string): boolean {
  return readDedup().some((e) => e.key === key);
}

export function rememberKey(key: string): void {
  const entries = readDedup();
  entries.push({ key, at: Date.now() });
  writeDedup(entries);
}
