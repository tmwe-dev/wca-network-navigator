/**
 * deepMailAnalysis — gate condiviso per l'analisi AI "profonda" sulle mail in arrivo
 * (scout mittente via web + inbound enrichment in background).
 *
 * Default: DISATTIVATO. L'analisi profonda parte solo se l'utente la abilita
 * esplicitamente con app_setting `ai_deep_mail_analysis_enabled = "true"`.
 *
 * Motivo: questo flusso fa ricerca web + chiamate LLM su OGNI mail da mittente
 * sconosciuto, ed è il principale driver di costo non controllato.
 *
 * Fail-safe: in caso di errore di lettura → ritorna false (analisi OFF).
 */
// deno-lint-ignore no-explicit-any
type SBClient = any;

export const DEEP_MAIL_SETTING_KEY = "ai_deep_mail_analysis_enabled";

export async function isDeepMailAnalysisEnabled(
  supabase: SBClient,
  userId: string | null | undefined,
): Promise<boolean> {
  if (!userId) return false;
  try {
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", DEEP_MAIL_SETTING_KEY)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) return false;
    return data?.value === "true";
  } catch {
    return false;
  }
}
