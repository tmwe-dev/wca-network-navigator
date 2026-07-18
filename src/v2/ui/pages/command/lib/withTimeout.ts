/**
 * withTimeout — race a promise against a millisecond deadline.
 * Unica implementazione riusata da planRunner, useCommandSubmit,
 * useResultCommentary. Rimuove duplicati di Promise.race + setTimeout.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`timeout ${ms}ms · ${label}`)), ms),
    ),
  ]);
}