/**
 * createPauseChecker — fabbrica memoized per `ai_automations_paused`.
 * Cadence-engine processa fino a 50 actions/ciclo: molte condividono lo
 * stesso user_id. Senza cache = 50 lookup DB; con cache = 1 per utente
 * distinto. Cache locale al request, nessuno stato persistente.
 */
export function createPauseChecker(
  lookup: (userId: string) => Promise<boolean>,
): (userId: string) => Promise<boolean> {
  const cache = new Map<string, boolean>();
  return async (userId: string) => {
    const hit = cache.get(userId);
    if (hit !== undefined) return hit;
    const paused = await lookup(userId);
    cache.set(userId, paused);
    return paused;
  };
}