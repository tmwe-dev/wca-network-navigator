/**
 * Sanitize a search string for use in Supabase PostgREST `.or()` / `.ilike()` filters.
 * Escapes special PostgREST characters that could manipulate the query.
 */
export function sanitizeSearchTerm(input: string): string {
  // Remove PostgREST operator characters: parentheses, commas, dots, backslashes
  return input.replace(/[(),.\\\*%_]/g, "");
}
