/**
 * Feature flags client-side.
 *
 * LEAN_MODE: quando `true` (default) la UI mostra solo le 7 voci di menu
 * essenziali per l'uso commerciale quotidiano. Tutte le altre rotte restano
 * registrate e raggiungibili via deep-link / popover "Tutte le pagine".
 *
 * Per spegnerlo (mostrare l'intero menu storico): impostare
 *   VITE_LEAN_MODE=false
 * in `.env` e ricaricare il dev server.
 */

function readBool(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value === "") return fallback;
  const v = value.trim().toLowerCase();
  if (["false", "0", "off", "no"].includes(v)) return false;
  if (["true", "1", "on", "yes"].includes(v)) return true;
  return fallback;
}

export const LEAN_MODE: boolean = readBool(
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_LEAN_MODE,
  true,
);

/**
 * Path delle 7 voci canoniche in Lean Mode.
 * Devono combaciare esattamente con i `path` in `navItemsDef`
 * (incluso il nuovo `/v2/comms` introdotto dalla Fase 3).
 */
export const LEAN_NAV_PATHS: ReadonlySet<string> = new Set([
  "/v2/command",
  "/v2/explore/network",
  "/v2/cockpit",
  "/v2/comms",
  "/v2/agenda",
  "/v2/intelligence/agents",
  "/v2/settings",
]);