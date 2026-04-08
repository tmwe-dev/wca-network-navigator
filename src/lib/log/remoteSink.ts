/**
 * remoteSink — sink remoto env-gated per `createLogger`.
 *
 * Vol. II §11.4 "Centralizzazione dei log" + §12.1 "Telemetria":
 *   "I log devono poter essere raccolti in un sistema centrale (Sentry,
 *    Logtail, Datadog) senza modificare il codice applicativo. Il logger
 *    deve esporre un punto di iniezione (sink) per la spedizione remota."
 *
 * Strategia:
 * - Lo scaffold è sempre presente; l'attivazione è gated da
 *   `VITE_REMOTE_LOG_ENDPOINT` (URL HTTPS) + opzionale
 *   `VITE_REMOTE_LOG_TOKEN` (Bearer).
 * - Se le env-var non sono presenti, `installRemoteSink()` è no-op,
 *   quindi i deploy senza credenziali continuano a funzionare.
 * - Buffer interno con flush periodico (sendBeacon su unload) per
 *   non bloccare la UI ad ogni log.
 * - Solo `warn` ed `error` vengono inviati per default — il rumore di
 *   debug/info resta locale (ADR-0003).
 *
 * Da chiamare una sola volta all'avvio dell'app, tipicamente in `main.tsx`:
 *
 *   import { installRemoteSink } from "@/lib/log/remoteSink";
 *   installRemoteSink();
 */
import { logConfig, type LogRecord, type LogLevel } from "@/lib/log";

export interface RemoteSinkOptions {
  endpoint?: string;
  token?: string;
  /** Livello minimo da spedire (default: "warn") */
  minLevel?: LogLevel;
  /** Dimensione max del buffer prima del flush automatico (default: 20) */
  flushAt?: number;
  /** Intervallo flush periodico in ms (default: 10_000) */
  flushIntervalMs?: number;
}

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

interface InstalledSink {
  enabled: boolean;
  endpoint?: string;
  pendingCount: number;
}

let installed: InstalledSink = { enabled: false, pendingCount: 0 };

/**
 * Installa il sink remoto. Idempotente: chiamate successive sono no-op.
 */
export function installRemoteSink(options: RemoteSinkOptions = {}): InstalledSink {
  if (installed.enabled) return installed;

  const endpoint =
    options.endpoint ??
    (typeof import.meta !== "undefined" ? import.meta.env?.VITE_REMOTE_LOG_ENDPOINT : undefined);

  if (!endpoint) {
    // env-gated: senza endpoint il sink resta disattivato
    installed = { enabled: false, pendingCount: 0 };
    return installed;
  }

  const token =
    options.token ??
    (typeof import.meta !== "undefined" ? import.meta.env?.VITE_REMOTE_LOG_TOKEN : undefined);
  const minLevel = options.minLevel ?? "warn";
  const flushAt = options.flushAt ?? 20;
  const flushIntervalMs = options.flushIntervalMs ?? 10_000;

  const buffer: LogRecord[] = [];

  const flush = (useBeacon = false): void => {
    if (buffer.length === 0) return;
    const batch = buffer.splice(0, buffer.length);
    installed.pendingCount = 0;
    const body = JSON.stringify({ records: batch });
    try {
      if (useBeacon && typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        navigator.sendBeacon(endpoint, new Blob([body], { type: "application/json" }));
        return;
      }
      void fetch(endpoint, {
        method: "POST",
        keepalive: true,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body,
      }).catch(() => {
        // un sink non deve mai far saltare l'applicazione (Vol. II §4.5)
      });
    } catch {
      // idem
    }
  };

  logConfig.addSink((record: LogRecord) => {
    if (LEVEL_WEIGHT[record.level] < LEVEL_WEIGHT[minLevel]) return;
    buffer.push(record);
    installed.pendingCount = buffer.length;
    if (buffer.length >= flushAt) flush();
  });

  if (typeof window !== "undefined") {
    window.setInterval(() => flush(), flushIntervalMs);
    window.addEventListener("beforeunload", () => flush(true));
  }

  installed = { enabled: true, endpoint, pendingCount: 0 };
  return installed;
}

/** Helper per il testing */
export function __getInstalledSinkState(): InstalledSink {
  return installed;
}

/** Helper per il testing — resetta lo stato (NON il logger) */
export function __resetInstalledSinkState(): void {
  installed = { enabled: false, pendingCount: 0 };
}
