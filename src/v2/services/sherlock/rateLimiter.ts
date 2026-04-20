/**
 * rateLimiter — throttle globale per canale Sherlock.
 *
 * Singleton condiviso fra tutte le indagini Sherlock contemporanee dell'utente:
 *  - linkedin: 1 hit ogni 10 secondi (anti-ban)
 *  - generic: 1 req/secondo per dominio
 *
 * Nota: limite client-side cooperativo, non backend. È intenzionale (vedi
 * note interne sul rate limiting backend assente).
 */

type Channel = "linkedin" | "generic" | string;

const CHANNEL_MIN_INTERVAL_MS: Record<string, number> = {
  linkedin: 10_000,
  generic: 1_000,
};

// Map<key, lastRequestTimestamp>
const lastByKey = new Map<string, number>();
// Promise queue per serializzare richieste sulla stessa chiave
const pendingByKey = new Map<string, Promise<void>>();

function keyFor(channel: Channel, url: string): string {
  if (channel === "linkedin") return "channel:linkedin"; // throttle GLOBALE su tutto LinkedIn
  try {
    const host = new URL(url).hostname.toLowerCase();
    return `host:${host}`;
  } catch {
    return `channel:${channel}`;
  }
}

function intervalFor(channel: Channel): number {
  return CHANNEL_MIN_INTERVAL_MS[channel] ?? CHANNEL_MIN_INTERVAL_MS.generic;
}

/**
 * Calcola quanti ms bisogna attendere prima di eseguire la prossima richiesta.
 * Non aspetta — solo informativo (utile per UI).
 */
export function estimateWaitMs(channel: Channel, url: string): number {
  const key = keyFor(channel, url);
  const last = lastByKey.get(key);
  if (!last) return 0;
  const min = intervalFor(channel);
  const elapsed = Date.now() - last;
  return Math.max(0, min - elapsed);
}

/**
 * Attende il throttle se necessario, poi registra il "now" come ultimo hit.
 * Serializza le chiamate sulla stessa key per evitare race.
 */
export async function throttle(channel: Channel, url: string, signal?: AbortSignal): Promise<void> {
  const key = keyFor(channel, url);
  const min = intervalFor(channel);

  // Concatena alla coda pendente sulla stessa key
  const prev = pendingByKey.get(key) ?? Promise.resolve();
  let release: () => void = () => {};
  const slot = new Promise<void>((res) => {
    release = res;
  });
  pendingByKey.set(key, prev.then(() => slot));

  await prev;
  try {
    const last = lastByKey.get(key) ?? 0;
    const wait = Math.max(0, min - (Date.now() - last));
    if (wait > 0) {
      await new Promise<void>((res, rej) => {
        const t = setTimeout(res, wait);
        if (signal) {
          const onAbort = () => {
            clearTimeout(t);
            rej(new Error("Aborted"));
          };
          if (signal.aborted) onAbort();
          else signal.addEventListener("abort", onAbort, { once: true });
        }
      });
    }
    lastByKey.set(key, Date.now());
  } finally {
    release();
    // Cleanup se nessuno aspetta più
    queueMicrotask(() => {
      if (pendingByKey.get(key) === prev.then(() => slot)) {
        pendingByKey.delete(key);
      }
    });
  }
}
