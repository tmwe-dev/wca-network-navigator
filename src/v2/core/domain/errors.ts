/**
 * Error Factory — Vol. II §5.3 + Vol. IV §3
 *
 * 3 categorie: Domain, IO, Infra.
 * Ogni errore ha code, message, category, context, recoveryStrategy.
 * Zero catch vuoti — ogni errore è tipizzato e tracciabile.
 */

// ── Recovery strategies ──────────────────────────────────────────────

export type RecoveryStrategy = "retry" | "fallback" | "escalate" | "ignore";

// ── Error categories ─────────────────────────────────────────────────

export type ErrorCategory = "domain" | "io" | "infra";

// ── Error codes per categoria ────────────────────────────────────────

export type DomainErrorCode =
  | "VALIDATION_FAILED"
  | "BUSINESS_RULE_VIOLATED"
  | "ENTITY_NOT_FOUND"
  | "DUPLICATE_ENTITY"
  | "INVALID_STATE_TRANSITION";

export type IOErrorCode =
  | "NETWORK_ERROR"
  | "DATABASE_ERROR"
  | "SCHEMA_MISMATCH"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "EDGE_FUNCTION_ERROR"
  | "EXTERNAL_API_ERROR";

export type InfraErrorCode =
  | "EVENT_BUS_ERROR"
  | "CIRCUIT_OPEN"
  | "CIRCUIT_HALF_OPEN_FAIL"
  | "HEALTH_CHECK_FAILED"
  | "CONFIG_MISSING"
  | "FEATURE_DISABLED";

export type AppErrorCode = DomainErrorCode | IOErrorCode | InfraErrorCode;

// ── Base error interface ─────────────────────────────────────────────

export interface AppError {
  readonly category: ErrorCategory;
  readonly code: AppErrorCode;
  readonly message: string;
  readonly context?: Readonly<Record<string, unknown>>;
  readonly recoveryStrategy: RecoveryStrategy;
  readonly timestamp: string;
  readonly source?: string;
}

// ── Factory functions ────────────────────────────────────────────────

function createError(
  category: ErrorCategory,
  code: AppErrorCode,
  message: string,
  recoveryStrategy: RecoveryStrategy,
  context?: Record<string, unknown>,
  source?: string,
): AppError {
  return Object.freeze({
    category,
    code,
    message,
    recoveryStrategy,
    context: context ? Object.freeze({ ...context }) : undefined,
    timestamp: new Date().toISOString(),
    source,
  });
}

export function domainError(
  code: DomainErrorCode,
  message: string,
  context?: Record<string, unknown>,
  source?: string,
): AppError {
  const strategy: RecoveryStrategy =
    code === "ENTITY_NOT_FOUND" ? "fallback" : "escalate";
  return createError("domain", code, message, strategy, context, source);
}

export function ioError(
  code: IOErrorCode,
  message: string,
  context?: Record<string, unknown>,
  source?: string,
): AppError {
  const strategy: RecoveryStrategy =
    code === "NETWORK_ERROR" || code === "TIMEOUT" || code === "RATE_LIMITED"
      ? "retry"
      : code === "UNAUTHENTICATED"
        ? "escalate"
        : "fallback";
  return createError("io", code, message, strategy, context, source);
}

export function infraError(
  code: InfraErrorCode,
  message: string,
  context?: Record<string, unknown>,
  source?: string,
): AppError {
  const strategy: RecoveryStrategy =
    code === "CIRCUIT_OPEN" || code === "CIRCUIT_HALF_OPEN_FAIL"
      ? "fallback"
      : code === "FEATURE_DISABLED"
        ? "ignore"
        : "escalate";
  return createError("infra", code, message, strategy, context, source);
}

// ── Type guard ───────────────────────────────────────────────────────

export function isAppError(value: unknown): value is AppError {
  return (
    typeof value === "object" &&
    value !== null &&
    "category" in value &&
    "code" in value &&
    "message" in value &&
    "recoveryStrategy" in value &&
    "timestamp" in value
  );
}

/**
 * Converte un unknown catturato in AppError.
 * Usato come adapter per try/catch legacy.
 */
export function fromUnknown(
  caught: unknown,
  fallbackCode: AppErrorCode = "DATABASE_ERROR",
  source?: string,
): AppError {
  if (isAppError(caught)) return caught;

  const message =
    caught instanceof Error
      ? caught.message
      : typeof caught === "string"
        ? caught
        : "Errore sconosciuto";

  const category: ErrorCategory =
    fallbackCode.includes("VALIDATION") || fallbackCode.includes("BUSINESS")
      ? "domain"
      : fallbackCode.includes("EVENT") ||
          fallbackCode.includes("CIRCUIT") ||
          fallbackCode.includes("HEALTH") ||
          fallbackCode.includes("CONFIG") ||
          fallbackCode.includes("FEATURE")
        ? "infra"
        : "io";

  return createError(category, fallbackCode, message, "escalate", undefined, source);
}
