/**
 * Structured logger — Vol. I §3.3
 *
 * Obiettivo: ogni record di log è un oggetto JSON con campi standard
 * (timestamp, livello, modulo, user id, session id, messaggio, contesto)
 * invece di stringhe testuali non ricercabili.
 *
 * Regole:
 * - Mai chiamare `console.*` direttamente nell'app. Usare `log.info/warn/error/debug`.
 * - In produzione (`import.meta.env.PROD`) i livelli `debug` e `info` sono disattivati
 *   di default per ridurre il rumore in console.
 * - Il logger può essere esteso con uno o più sink remoti (Sentry, Logtail, ecc.)
 *   tramite `log.addSink()`.
 *
 * Vol. I §3.3: "Il logging deve essere strutturato, ossia ogni record deve essere
 * un oggetto JSON con campi standard: timestamp, livello, modulo, identificativo
 * utente, identificativo sessione, messaggio, contesto. I log testuali non
 * strutturati sono inutilizzabili per l'analisi."
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogRecord {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  context?: Record<string, unknown>;
  userId?: string;
  sessionId?: string;
  route?: string;
  userAgent?: string;
}

export type LogSink = (record: LogRecord) => void;

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const PROD = typeof import.meta !== "undefined" && Boolean(import.meta.env?.PROD);
const DEFAULT_MIN_LEVEL: LogLevel = PROD ? "warn" : "debug";

let minLevel: LogLevel = DEFAULT_MIN_LEVEL;
const sinks: LogSink[] = [];

/**
 * Sink di default: console con output strutturato.
 * In dev stampa anche il contesto, in prod solo warn/error.
 */
const consoleSink: LogSink = (record) => {
  const prefix = `[${record.level.toUpperCase()}] ${record.module}`;
  const payload = record.context ? { context: record.context } : undefined;

  switch (record.level) {
    case "error":
       
      console.error(prefix, record.message, payload ?? "");
      break;
    case "warn":
       
      console.warn(prefix, record.message, payload ?? "");
      break;
    case "info":
       
      console.info(prefix, record.message, payload ?? "");
      break;
    case "debug":
       
      console.debug(prefix, record.message, payload ?? "");
      break;
  }
};

sinks.push(consoleSink);

function getRouteSafe(): string | undefined {
  try {
    return typeof window !== "undefined" ? window.location.pathname : undefined;
  } catch {
    return undefined;
  }
}

function getUserAgentSafe(): string | undefined {
  try {
    return typeof navigator !== "undefined" ? navigator.userAgent : undefined;
  } catch {
    return undefined;
  }
}

function getUserIdSafe(): string | undefined {
  try {
    if (typeof localStorage === "undefined") return undefined;
    const key = Object.keys(localStorage).find((k) => k.includes("supabase") && k.includes("auth"));
    if (!key) return undefined;
    const raw = localStorage.getItem(key);
    if (!raw) return undefined;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "user" in parsed &&
      typeof (parsed as { user?: { id?: unknown } }).user?.id === "string"
    ) {
      return (parsed as { user: { id: string } }).user.id;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function getSessionIdSafe(): string | undefined {
  try {
    if (typeof sessionStorage === "undefined") return undefined;
    let id = sessionStorage.getItem("wca.session_id");
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem("wca.session_id", id);
    }
    return id;
  } catch {
    return undefined;
  }
}

function emit(level: LogLevel, module: string, message: string, context?: Record<string, unknown>): void {
  if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[minLevel]) return;

  const record: LogRecord = {
    timestamp: new Date().toISOString(),
    level,
    module,
    message,
    context,
    userId: getUserIdSafe(),
    sessionId: getSessionIdSafe(),
    route: getRouteSafe(),
    userAgent: getUserAgentSafe(),
  };

  for (const sink of sinks) {
    try {
      sink(record);
    } catch {
      // un sink non deve mai far saltare l'applicazione
    }
  }
}

/**
 * Logger per-modulo. Usare sempre un nome modulo esplicito.
 *
 * @example
 *   const log = createLogger("useDownloadEngine");
 *   log.info("job started", { jobId });
 *   log.error("login failed", { reason: err.message });
 */
export function createLogger(module: string) {
  return {
    debug: (message: string, context?: Record<string, unknown>) => emit("debug", module, message, context),
    info: (message: string, context?: Record<string, unknown>) => emit("info", module, message, context),
    warn: (message: string, context?: Record<string, unknown>) => emit("warn", module, message, context),
    error: (message: string, context?: Record<string, unknown>) => emit("error", module, message, context),
  };
}

/**
 * Root logger (usato quando non si vuole specificare un modulo).
 * Preferire `createLogger("ModuleName")` per avere tracciabilità.
 */
export const log = createLogger("root");

/**
 * Configurazione runtime del logger.
 */
export const logConfig = {
  /** Imposta il livello minimo visibile. */
  setMinLevel(level: LogLevel): void {
    minLevel = level;
  },
  getMinLevel(): LogLevel {
    return minLevel;
  },
  /** Aggiunge un sink remoto (es. Sentry, Logtail). */
  addSink(sink: LogSink): void {
    sinks.push(sink);
  },
  /** Rimuove tutti i sink tranne il console sink di default. */
  reset(): void {
    sinks.length = 0;
    sinks.push(consoleSink);
    minLevel = DEFAULT_MIN_LEVEL;
  },
};
