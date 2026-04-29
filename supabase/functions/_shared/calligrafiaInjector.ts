/**
 * calligrafiaInjector.ts — SSOT block that instructs every email-producing
 * orchestrator to read the "calligrafia" KB entry for FORMATTING ONLY.
 *
 * Scope: posizione e formattazione del testo email (HTML tags, paragrafi,
 * spaziatura, tipografia). NON contenuto, NON tono, NON strategia.
 *
 * Uso: import { CALLIGRAFIA_DIRECTIVE, fetchCalligrafiaBlock } and append
 * to the system prompt of generate-email, generate-outreach, improve-email,
 * agent-execute (when emitting email content), etc.
 */

// deno-lint-ignore no-explicit-any
type AnySupabaseClient = any;

/** Direttiva sintetica iniettabile in QUALSIASI prompt che produce email. */
export const CALLIGRAFIA_DIRECTIVE = `
## REGOLA DI FORMATTAZIONE EMAIL — VINCOLANTE
Per la formattazione, l'impaginazione e la tipografia del testo email DEVI
seguire ESCLUSIVAMENTE le regole della voce KB "Calligrafia — Standard di
formattazione email" (categoria: calligrafia). Quelle regole governano:
  - tag HTML ammessi e vietati nel corpo,
  - struttura visiva (saluti, paragrafi, chiusura),
  - spaziatura, elenchi, link, punteggiatura,
  - divieti tipografici e checklist finale.
Se il blocco "Calligrafia" è presente sotto, applicalo alla lettera.
Se NON è presente, applica comunque queste regole minime non negoziabili:
  - Il corpo deve essere HTML renderizzabile, non testo escapato: usa <p>...</p>, NON &lt;p&gt;...&lt;/p&gt;.
  - Ogni paragrafo dentro <p>...</p>; tra paragrafi NON usare <br>; mai più di un <br> consecutivo.
  - Nessun tag visibile come testo; nessun Markdown nel corpo; nessuna virgola/punto fuori dai tag di paragrafo.
  - Nessuna firma nel corpo (la aggiunge il sistema).
  - Nessun placeholder, nessun emoji, nessun TUTTO MAIUSCOLO per enfasi.
`;

/**
 * Carica il contenuto integrale della voce KB "calligrafia" (se presente)
 * per iniettarlo nel prompt come fonte di verità sulla formattazione.
 * Restituisce stringa vuota se non disponibile.
 */
export async function fetchCalligrafiaBlock(
  supabase: AnySupabaseClient,
  userId?: string | null,
): Promise<string> {
  try {
    let query = supabase
      .from("kb_entries")
      .select("title, content")
      .eq("is_active", true)
      .is("deleted_at", null)
      .eq("category", "calligrafia")
      .order("priority", { ascending: false })
      .limit(1);

    if (userId) {
      query = query.or(`user_id.eq.${userId},user_id.is.null`);
    }

    const { data } = await query;
    if (!data || data.length === 0) return "";
    const entry = data[0] as { title: string; content: string };
    return `\n## CALLIGRAFIA — REGOLE DI FORMATTAZIONE (fonte: KB "${entry.title}")\n${entry.content}\n`;
  } catch {
    return "";
  }
}

/**
 * Variante combinata: ritorna direttiva + blocco completo (se trovato).
 */
export async function buildCalligrafiaSection(
  supabase: AnySupabaseClient,
  userId?: string | null,
): Promise<string> {
  const block = await fetchCalligrafiaBlock(supabase, userId);
  return `${CALLIGRAFIA_DIRECTIVE}${block}`;
}