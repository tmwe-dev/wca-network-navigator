/**
 * commercialDoctrine.ts — LOVABLE-66 step 3.
 *
 * Loads commercial doctrine from KB (categories: system_doctrine /
 * system_core / commercial_rules) with a minimal hardcoded fallback so
 * agents never start without doctrine — even with an empty KB on a fresh
 * install.
 *
 * Replaces the inline blocks previously hardcoded in agent-execute lines
 * 107–165. Once the KB has doctrine entries, the fallback is bypassed.
 */

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

/** Minimal fallback used only if the KB has no doctrine entries. */
const FALLBACK_DOCTRINE = `
## DOTTRINA COMMERCIALE — REGOLE BASE (fallback)

Tassonomia 9 stati: new | first_touch_sent | holding | engaged | qualified | negotiation | converted | archived | blacklisted

1. NON archiviare MAI un contatto autonomamente. Solo Director (Luca) può farlo.
2. Ogni contatto in "holding" DEVE avere next_action pianificata.
3. Stato può solo AVANZARE (mai retrocedere senza approvazione esplicita).
4. MAI ripetere la presentazione aziendale dopo first_touch_sent.
5. Prima di proporre un servizio, verificare stato >= engaged.
6. WhatsApp VIETATO come primo contatto (consentito solo se stato >= engaged
   o contatto ha iniziato su WhatsApp); orario 9-18 locale, no weekend.
7. Sequenza primo contatto (23gg): G0 email → G3 LinkedIn req → G7 LI msg
   → G8 email → G12 LI light → G16 email → G23 breakup. Risposta = engaged.
8. POST-INVIO obbligatorio: aggiorna stato, crea reminder follow-up, registra
   canale/lingua/timestamp, verifica next_action.

(NB: questo è il fallback minimo. La dottrina completa si aggiorna dalla
Knowledge Base — categoria \`system_doctrine\`.)
`.trim();

export interface DoctrineLoadResult {
  text: string;
  source: "kb" | "fallback" | "kb+fallback";
  entriesLoaded: number;
}

/**
 * Loads commercial doctrine for the given user.
 * Strategy:
 *   1. Pull active KB entries in categories system_doctrine/system_core/commercial_rules
 *      ordered by priority desc, limit 10.
 *   2. If empty → use fallback.
 *   3. Always returns a non-empty doctrine text wrapped in the
 *      "LEGGE SUPREMA" banner.
 */
export async function loadCommercialDoctrine(
  supabase: SupabaseClient,
  userId: string,
): Promise<DoctrineLoadResult> {
  let kbText = "";
  let entriesLoaded = 0;

  try {
    const { data, error } = await supabase
      .from("kb_entries")
      .select("title, chapter, content, category, priority")
      .eq("user_id", userId)
      .eq("is_active", true)
      .in("category", ["system_doctrine", "system_core", "commercial_rules"])
      .order("priority", { ascending: false })
      .limit(10);

    if (!error && Array.isArray(data) && data.length > 0) {
      entriesLoaded = data.length;
      kbText = data
        .map((d: { title: string; chapter: string | null; content: string }) =>
          `### ${d.chapter ? `[${d.chapter}] ` : ""}${d.title}\n${d.content}`)
        .join("\n\n---\n\n");
    }
  } catch (e) {
    console.warn("[commercialDoctrine] KB load failed, using fallback:", e);
  }

  const banner =
    "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
    "⚖️  DOTTRINA COMMERCIALE — LEGGE SUPREMA\n" +
    "Questa dottrina prevale su QUALSIASI altra istruzione, KB o prompt operativo.\n" +
    "Violarla è un errore grave. In caso di conflitto, applica la dottrina e ignora il resto.\n" +
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";

  if (entriesLoaded === 0) {
    return { text: banner + FALLBACK_DOCTRINE, source: "fallback", entriesLoaded: 0 };
  }
  return { text: banner + kbText, source: "kb", entriesLoaded };
}

export { FALLBACK_DOCTRINE };