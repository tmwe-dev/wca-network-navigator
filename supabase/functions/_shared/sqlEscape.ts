/**
 * SQL LIKE/ILIKE wildcard escaping.
 *
 * Vol. II §6.1 (input validation) — input proveniente da utente o da
 * tool args generati dall'LLM può contenere `%` o `_` che PostgREST
 * passa direttamente al motore PostgreSQL come wildcard. Anche se
 * questo non è SQL injection in senso classico (PostgREST usa query
 * parametrizzate), permette wildcard abuse / DoS via match troppo
 * larghi (es. `%%%%` matcha tutto).
 *
 * Esempio:
 *   const safe = escapeLike(userInput);
 *   query.ilike("name", `%${safe}%`);
 */
export function escapeLike(value: unknown): string {
  if (value == null) return "";
  return String(value).replace(/[\\%_]/g, (c) => `\\${c}`);
}
