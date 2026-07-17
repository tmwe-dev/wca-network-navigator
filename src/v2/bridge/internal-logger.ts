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
      // eslint-disable-next-line no-console
      console.debug(prefix, message, context ?? "");  
    },
    info(message, context) {
      if (typeof import.meta !== "undefined" && import.meta.env?.PROD) return;
      // eslint-disable-next-line no-console
      console.info(prefix, message, context ?? "");  
    },
    warn(message, context) {
      // eslint-disable-next-line no-console
      console.warn(prefix, message, context ?? "");  
    },
    error(message, context) {
      // eslint-disable-next-line no-console
      console.error(prefix, message, context ?? "");  
    },
  };
}
