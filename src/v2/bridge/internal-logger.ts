/**
 * Internal logger for v2 bridge — thin wrapper to avoid circular deps.
 * In production, delegates to the v1 structured logger.
 */

export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

export function createLogger(module: string): Logger {
  const prefix = `[v2:${module}]`;
  return {
    debug(message, context) {
      if (typeof import.meta !== "undefined" && import.meta.env?.PROD) return;
      console.debug(prefix, message, context ?? ""); // eslint-disable-line no-console
    },
    info(message, context) {
      if (typeof import.meta !== "undefined" && import.meta.env?.PROD) return;
      console.info(prefix, message, context ?? ""); // eslint-disable-line no-console
    },
    warn(message, context) {
      console.warn(prefix, message, context ?? ""); // eslint-disable-line no-console
    },
    error(message, context) {
      console.error(prefix, message, context ?? ""); // eslint-disable-line no-console
    },
  };
}
