/**
 * Bridge unificato per le estensioni (WhatsApp v5.10.0, LinkedIn v3.9.0).
 *
 * Contratto reale (vedi webapp-bridge.js dell'estensione):
 *   webapp → ext   →  window.postMessage({ direction, action, requestId, ...payload })
 *   ext    → webapp ←  window.postMessage({ direction, action, requestId, response })
 *
 * Tre canali, ognuno con la sua coppia di direction:
 *   FireScrape  : from-webapp-fs  / from-extension-fs
 *   WhatsApp    : from-webapp-wa  / from-extension-wa
 *   LinkedIn    : from-webapp     / from-extension
 *
 * Ogni response è un oggetto `{ success: boolean, error?: string, ...data }`.
 * Quando `success: true` i campi extra sono i dati restituiti dall'azione.
 */

export type ExtensionTarget = "firescrape" | "whatsapp" | "linkedin";

interface DirectionPair {
  out: string; // direction usata dalla webapp per inviare
  in: string;  // direction attesa nella risposta dall'estensione
}

const DIRECTIONS: Record<ExtensionTarget, DirectionPair> = {
  firescrape: { out: "from-webapp-fs", in: "from-extension-fs" },
  whatsapp:   { out: "from-webapp-wa", in: "from-extension-wa" },
  linkedin:   { out: "from-webapp",    in: "from-extension"    },
};

const DEFAULT_TIMEOUT_MS = 30_000;
const PING_TIMEOUT_MS = 3_000;

export interface ExtensionResponse {
  success: boolean;
  error?: string;
  [key: string]: unknown;
}

export type CallResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** Invia un comando a un canale dell'estensione e attende la risposta tipizzata. */
export async function callExtension<T = ExtensionResponse>(
  target: ExtensionTarget,
  action: string,
  payload: Record<string, unknown> = {},
  options: { timeoutMs?: number } = {},
): Promise<CallResult<T>> {
  const dir = DIRECTIONS[target];
  if (!dir) return { ok: false, error: `Target estensione sconosciuto: ${target}` };

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const requestId = `wca_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  return new Promise((resolve) => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const handler = (event: MessageEvent) => {
      if (event.source !== window) return;
      const msg = event.data as { direction?: string; requestId?: string; response?: ExtensionResponse } | undefined;
      if (!msg || msg.direction !== dir.in || msg.requestId !== requestId) return;

      window.removeEventListener("message", handler);
      clearTimeout(timeoutId);

      const resp = (msg.response ?? {}) as ExtensionResponse;
      if (resp.success === false) {
        resolve({ ok: false, error: resp.error ?? "Errore estensione" });
      } else {
        // success: true → restituiamo l'intero oggetto come dati
        resolve({ ok: true, data: resp as unknown as T });
      }
    };

    window.addEventListener("message", handler);

    const message = { direction: dir.out, action, requestId, ...payload };
    try {
      window.postMessage(message, window.location.origin);
    } catch {
      window.postMessage(message, "*");
    }

    timeoutId = setTimeout(() => {
      window.removeEventListener("message", handler);
      resolve({
        ok: false,
        error: `Estensione (${target}/${action}) non risponde entro ${timeoutMs}ms. Verifica che Partner Connect sia installata e attiva.`,
      });
    }, timeoutMs);
  });
}

/** Verifica se un canale dell'estensione è attivo via ping. */
export async function pingExtension(target: ExtensionTarget): Promise<boolean> {
  const res = await callExtension(target, "ping", {}, { timeoutMs: PING_TIMEOUT_MS });
  return res.ok;
}

// ════════════════════════════════════════════════════════════════════
// Helper specifici (zucchero sintattico per le azioni più frequenti).
// ════════════════════════════════════════════════════════════════════

export const fs = {
  ping: () => callExtension("firescrape", "ping", {}, { timeoutMs: PING_TIMEOUT_MS }),
  scrape: (skipCache = false) => callExtension("firescrape", "scrape", { skipCache }),
  scrapeUrl: (url: string, skipCache = false) =>
    callExtension("firescrape", "scrape", { url, skipCache }, { timeoutMs: 60_000 }),
  extract: (schema: Record<string, unknown>, url?: string) =>
    callExtension("firescrape", "extract", { schema, ...(url ? { url } : {}) }),
  googleSearch: (query: string, limit = 10) =>
    callExtension("firescrape", "google-search", { query, limit }, { timeoutMs: 45_000 }),
  agentAction: (step: Record<string, unknown>) =>
    callExtension("firescrape", "agent-action", { step }, { timeoutMs: 60_000 }),
  agentSequence: (steps: Array<Record<string, unknown>>) =>
    callExtension("firescrape", "agent-sequence", { steps }, { timeoutMs: 120_000 }),
  pipelineExecute: (pipelineId: string, vars: Record<string, unknown> = {}) =>
    callExtension("firescrape", "pipeline-execute", { pipelineId, vars }, { timeoutMs: 180_000 }),
  pipelineSave: (pipeline: Record<string, unknown>) =>
    callExtension("firescrape", "pipeline-save", { pipeline }),
  pipelineList: () => callExtension("firescrape", "pipeline-list", {}),
  brainAnalyze: (topic: string) => callExtension("firescrape", "brain-analyze", { topic }),
  brainThink: (prompt: string) => callExtension("firescrape", "brain-think", { prompt }),
  cacheStats: () => callExtension("firescrape", "cache-stats", {}),

  /**
   * Naviga il BackgroundTab dell'estensione su `url` (tab nascosto, riusato).
   * Equivalente a `agent-action { action:"navigate", background:true, reuseTab:true }`.
   */
  navigateBackground: (url: string, timeoutMs = 30_000) =>
    callExtension("firescrape", "agent-action", {
      step: { action: "navigate", url, background: true, reuseTab: true },
    }, { timeoutMs }),

  /**
   * Esegue navigate(BackgroundTab) → delay → scrape, restituendo il risultato
   * dello scrape (con markdown). Supporta AbortSignal per interruzione immediata.
   */
  async readUrl(
    url: string,
    options: { settleMs?: number; signal?: AbortSignal; skipCache?: boolean } = {},
  ): Promise<CallResult<ExtensionResponse>> {
    const settleMs = options.settleMs ?? 2500;
    const signal = options.signal;

    if (signal?.aborted) return { ok: false, error: "Interrotto" };
    const nav = await this.navigateBackground(url, 30_000);
    if (!nav.ok) return nav;
    if (signal?.aborted) return { ok: false, error: "Interrotto" };

    // Attesa client-side, interrompibile
    await new Promise<void>((resolve) => {
      const t = setTimeout(resolve, settleMs);
      signal?.addEventListener("abort", () => { clearTimeout(t); resolve(); }, { once: true });
    });
    if (signal?.aborted) return { ok: false, error: "Interrotto" };

    return callExtension("firescrape", "scrape", { skipCache: options.skipCache ?? true }, { timeoutMs: 30_000 });
  },

  /**
   * Esegue una sequenza di URL, invocando `onProgress` dopo ogni URL letto.
   * Supporta abort. Ritorna i risultati nell'ordine.
   */
  async runUrls(
    urls: string[],
    onProgress: (i: number, total: number, url: string, result: CallResult<ExtensionResponse>) => void,
    options: { settleMs?: number; signal?: AbortSignal } = {},
  ): Promise<Array<CallResult<ExtensionResponse>>> {
    const results: Array<CallResult<ExtensionResponse>> = [];
    for (let i = 0; i < urls.length; i++) {
      if (options.signal?.aborted) {
        const aborted: CallResult<ExtensionResponse> = { ok: false, error: "Interrotto dall'utente" };
        try { onProgress(i, urls.length, urls[i], aborted); } catch { /* swallow */ }
        results.push(aborted);
        break;
      }
      const res = await this.readUrl(urls[i], { settleMs: options.settleMs, signal: options.signal });
      results.push(res);
      try { onProgress(i, urls.length, urls[i], res); } catch { /* swallow */ }
    }
    return results;
  },

  /**
   * @deprecated Usa runUrls. Mantenuto per compatibilità con codice esistente.
   */
  async runSequenceWithProgress(
    steps: Array<Record<string, unknown>>,
    onStep: (i: number, total: number, step: Record<string, unknown>, result: CallResult<ExtensionResponse>) => void,
    options: { signal?: AbortSignal; stepTimeoutMs?: number } = {},
  ): Promise<Array<CallResult<ExtensionResponse>>> {
    const results: Array<CallResult<ExtensionResponse>> = [];
    const stepTimeoutMs = options.stepTimeoutMs ?? 25_000;
    for (let i = 0; i < steps.length; i++) {
      if (options.signal?.aborted) {
        const aborted: CallResult<ExtensionResponse> = { ok: false, error: "Interrotto dall'utente" };
        try { onStep(i, steps.length, steps[i], aborted); } catch { /* swallow */ }
        results.push(aborted);
        break;
      }
      const step = steps[i];
      const res = await callExtension<ExtensionResponse>(
        "firescrape", "agent-action", { step }, { timeoutMs: stepTimeoutMs },
      );
      results.push(res);
      try { onStep(i, steps.length, step, res); } catch { /* swallow */ }
      if (!res.ok) break; // interrompi al primo errore
    }
    return results;
  },
};

export const wa = {
  ping: () => callExtension("whatsapp", "ping", {}, { timeoutMs: PING_TIMEOUT_MS }),
};

export const li = {
  ping: () => callExtension("linkedin", "ping", {}, { timeoutMs: PING_TIMEOUT_MS }),
  extractProfile: () => callExtension("linkedin", "extractProfile", {}, { timeoutMs: 60_000 }),
};
