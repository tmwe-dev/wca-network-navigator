/**
 * Circuit Breaker — Vol. IV §2
 *
 * Closed → Open (3 fail) → Half-Open (60s cooldown) → Closed (se ok)
 * Ogni transizione loggata.
 */

import { createLogger } from "./internal-logger";
import { type Result, ok, err } from "../core/domain/result";
import { infraError, type AppError } from "../core/domain/errors";

const logger = createLogger("CircuitBreaker");

// ── Types ────────────────────────────────────────────────────────────

export type CircuitState = "closed" | "open" | "half-open";

export interface CircuitBreakerConfig {
  readonly name: string;
  readonly failureThreshold: number;
  readonly cooldownMs: number;
}

interface CircuitBreakerState {
  state: CircuitState;
  failureCount: number;
  lastFailureAt: number;
}

// ── Default config ───────────────────────────────────────────────────

const DEFAULT_CONFIG: Omit<CircuitBreakerConfig, "name"> = {
  failureThreshold: 3,
  cooldownMs: 60_000,
};

// ── Registry ─────────────────────────────────────────────────────────

const breakers = new Map<string, { config: CircuitBreakerConfig; state: CircuitBreakerState }>();

function getOrCreate(name: string, overrides?: Partial<CircuitBreakerConfig>) {
  let breaker = breakers.get(name);
  if (!breaker) {
    breaker = {
      config: { ...DEFAULT_CONFIG, name, ...overrides },
      state: { state: "closed", failureCount: 0, lastFailureAt: 0 },
    };
    breakers.set(name, breaker);
  }
  return breaker;
}

// ── Public API ───────────────────────────────────────────────────────

export async function withCircuitBreaker<T>(
  name: string,
  fn: () => Promise<T>,
  overrides?: Partial<CircuitBreakerConfig>,
): Promise<Result<T, AppError>> {
  const breaker = getOrCreate(name, overrides);
  const { config, state } = breaker;

  // Check open → half-open transition
  if (state.state === "open") {
    const elapsed = Date.now() - state.lastFailureAt;
    if (elapsed >= config.cooldownMs) {
      transition(state, "half-open", name);
    } else {
      return err(infraError(
        "CIRCUIT_OPEN",
        `Circuit "${name}" is open. Retry in ${Math.ceil((config.cooldownMs - elapsed) / 1000)}s.`,
        { circuitName: name },
      ));
    }
  }

  try {
    const value = await fn();
    if (state.state === "half-open") {
      transition(state, "closed", name);
      state.failureCount = 0;
    }
    return ok(value);
  } catch (caught: unknown) {
    state.failureCount++;
    state.lastFailureAt = Date.now();

    const errorMsg = caught instanceof Error ? caught.message : String(caught);

    if (state.state === "half-open") {
      transition(state, "open", name);
      return err(infraError("CIRCUIT_HALF_OPEN_FAIL", errorMsg, { circuitName: name }));
    }

    if (state.failureCount >= config.failureThreshold) {
      transition(state, "open", name);
    }

    return err(infraError("CIRCUIT_OPEN", errorMsg, { circuitName: name, failureCount: state.failureCount }));
  }
}

export function getCircuitState(name: string): CircuitState | undefined {
  return breakers.get(name)?.state.state;
}

export function resetCircuit(name: string): void {
  breakers.delete(name);
}

export function resetAllCircuits(): void {
  breakers.clear();
}

// ── Internal ─────────────────────────────────────────────────────────

function transition(
  state: CircuitBreakerState,
  newState: CircuitState,
  name: string,
): void {
  const oldState = state.state;
  state.state = newState;
  if (newState === "closed") state.failureCount = 0;
  logger.info("state transition", { circuit: name, from: oldState, to: newState });
}
