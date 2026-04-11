/**
 * Result Monad — Vol. III §2.1
 *
 * Ogni operazione v2 ritorna Result<T, E> invece di throw.
 * Ispirato a Rust Result / fp-ts Either.
 */

import type { AppError } from "./errors";

// ── Discriminated union ──────────────────────────────────────────────

interface OkResult<T> {
  readonly _tag: "Ok";
  readonly value: T;
}

interface ErrResult<E> {
  readonly _tag: "Err";
  readonly error: E;
}

export type Result<T, E = AppError> = OkResult<T> | ErrResult<E>;

// ── Constructors ─────────────────────────────────────────────────────

export function ok<T>(value: T): Result<T, never> {
  return { _tag: "Ok", value };
}

export function err<E>(error: E): Result<never, E> {
  return { _tag: "Err", error };
}

// ── Type guards ──────────────────────────────────────────────────────

export function isOk<T, E>(result: Result<T, E>): result is OkResult<T> {
  return result._tag === "Ok";
}

export function isErr<T, E>(result: Result<T, E>): result is ErrResult<E> {
  return result._tag === "Err";
}

// ── Combinators ──────────────────────────────────────────────────────

export function map<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U,
): Result<U, E> {
  return isOk(result) ? ok(fn(result.value)) : result;
}

export function flatMap<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>,
): Result<U, E> {
  return isOk(result) ? fn(result.value) : result;
}

export function mapErr<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F,
): Result<T, F> {
  return isErr(result) ? err(fn(result.error)) : result;
}

export function unwrapOr<T, E>(result: Result<T, E>, fallback: T): T {
  return isOk(result) ? result.value : fallback;
}

export function unwrap<T, E>(result: Result<T, E>): T {
  if (isOk(result)) return result.value;
  throw new Error(
    `Called unwrap on Err: ${
      result.error instanceof Error
        ? result.error.message
        : String(result.error)
    }`,
  );
}

/**
 * Wrappa una Promise che potrebbe throw in Result.
 * Utile come adapter per codice legacy / librerie esterne.
 */
export async function fromPromise<T, E = AppError>(
  promise: Promise<T>,
  mapError: (e: unknown) => E,
): Promise<Result<T, E>> {
  try {
    const value = await promise;
    return ok(value);
  } catch (e: unknown) {
    return err(mapError(e));
  }
}
