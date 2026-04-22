/**
 * aliasesHandler.ts - Alias generation tool handlers
 * Handles: generate aliases
 */

export async function handleGenerateAliases(
  args: Record<string, unknown>,
  authHeader: string
): Promise<unknown> {
  const body: Record<string, unknown> = { type: args.type || "company", limit: Number(args.limit) || 20 };
  if (args.partner_ids) body.partner_ids = args.partner_ids;
  if (args.country_code) body.country_code = String(args.country_code).toUpperCase();
  const response = await fetch(
    `${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-aliases`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: authHeader },
      body: JSON.stringify(body),
    }
  );
  const data = await response.json();
  return response.ok ? { success: true, ...data } : { error: data.error || "Errore" };
}
