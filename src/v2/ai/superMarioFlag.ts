/**
 * superMarioFlag — Feature flag client-side per attivare Super Mario nel Command.
 *
 * Persistente in localStorage. Cambio istantaneo, no reload.
 * Default OFF: il Command usa il percorso classico (planExecution + useResultCommentary).
 * ON: il Command bypassa planner e regex, chiama super-mario edge.
 */
const KEY = "super_mario_enabled";

export function isSuperMarioEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEY) === "true";
  } catch {
    return false;
  }
}

export function setSuperMarioEnabled(on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, on ? "true" : "false");
    window.dispatchEvent(new CustomEvent("super-mario-flag-changed", { detail: { on } }));
  } catch {
    /* noop */
  }
}
