/**
 * kbAssembler.ts — Assembla la Knowledge Base in 3 livelli iniettati nel
 * system prompt di Super Mario.
 *
 * 1. STATIC      — sempre presente: identità sistema, glossario, regole ferree.
 * 2. DYNAMIC     — filtrata per intent: operative_prompts attivi del dominio.
 * 3. SITUATIONAL — dati live: conteggi rapidi, stato.
 *
 * Routing intent: keyword-based deterministico (no LLM extra).
 */

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

export type KbDomain =
  | "commercial"
  | "email"
  | "outreach"
  | "partner-search"
  | "agenda"
  | "classification"
  | "general";

export interface KbBlock {
  text: string;
  domain: KbDomain;
  loaded_cards: Array<{ source: string; id: string; name: string }>;
  static_chars: number;
  dynamic_chars: number;
  situational_chars: number;
}

const STATIC_KB = `
## SISTEMA
WCA Network Navigator — CRM/BI per gestire partner logistici di 17 network WCA.
Operatori: Admin, Tutor, Operatori commerciali. Visibilità globale degli agenti AI.

## GLOSSARIO
- Partner: agenzia logistica iscritta a uno o più network WCA.
- BCA (Business Card): badge che certifica l'appartenenza al network.
- Lead status: 9 stati (new, qualified, engaged, holding, archived, blacklisted, ...).
- Holding pattern: partner "in attesa", visualizzato con airplane pulsante.
- Commercial workflow: 6 stage (sales_standard).
- Outreach: campagne multicanale (Email, WhatsApp, LinkedIn) con A/B test.

## REGOLE FERREE (applicate anche dal codice)
- NO DELETE fisico: soft-delete via trigger DB su tabelle business.
- Address-priority: usa l'indirizzo piu' recente verificato.
- Same-Location Guard: niente due partner stessa citta' in 7 giorni.
- Email solo se verificata.
- WA/LinkedIn solo via extension bridge (stealth-sync).
`.trim();

const INTENT_KEYWORDS: Record<KbDomain, string[]> = {
  email: ["email", "mail", "scrivi", "scrivere", "bozza", "draft", "rispondi", "subject"],
  outreach: ["outreach", "campagna", "campagne", "sequenza", "follow", "follow-up", "whatsapp", "linkedin"],
  "partner-search": ["partner", "trova", "cerca", "elenco", "lista", "filtra", "agenti", "network", "wca"],
  agenda: ["agenda", "oggi", "domani", "scadenz", "promemoria", "ricordami", "briefing", "priorit"],
  classification: ["classifica", "categorizz", "etichett", "tag", "stato", "lead"],
  commercial: ["holding", "qualif", "blacklist", "archivi", "chiudi", "vendita", "deal"],
  general: [],
};

const DOMAIN_TO_PROMPT_CONTEXTS: Record<KbDomain, string[]> = {
  email: ["email", "email-quality", "post-send"],
  outreach: ["outreach", "multi-channel", "whatsapp", "post-send"],
  "partner-search": ["general"],
  agenda: ["general"],
  classification: ["classification", "lead-status"],
  commercial: ["lead-status", "outreach"],
  general: ["general"],
};

export function detectDomain(userRequest: string): KbDomain {
  const text = userRequest.toLowerCase();
  let best: { domain: KbDomain; score: number } = { domain: "general", score: 0 };
  for (const [domain, kws] of Object.entries(INTENT_KEYWORDS) as Array<[KbDomain, string[]]>) {
    let score = 0;
    for (const kw of kws) if (text.includes(kw)) score++;
    if (score > best.score) best = { domain, score };
  }
  return best.domain;
}

const MAX_PROMPT_CARDS = 6;
const MAX_CARD_CHARS = 800;

async function loadOperativePrompts(
  supabase: SupabaseClient,
  domain: KbDomain,
): Promise<Array<{ id: string; name: string; body: string }>> {
  const contexts = DOMAIN_TO_PROMPT_CONTEXTS[domain] ?? ["general"];
  const { data, error } = await supabase
    .from("operative_prompts")
    .select("id, name, context, objective, procedure, criteria, priority")
    .in("context", contexts)
    .eq("is_active", true)
    .is("deprecated_at", null)
    .order("priority", { ascending: false })
    .limit(MAX_PROMPT_CARDS * 3);

  if (error || !data) return [];

  const seen = new Set<string>();
  const cards: Array<{ id: string; name: string; body: string }> = [];
  for (const row of data as Array<Record<string, unknown>>) {
    const name = String(row.name ?? "");
    if (seen.has(name)) continue;
    seen.add(name);
    const body = [
      row.objective && `Obiettivo: ${row.objective}`,
      row.procedure && `Procedura: ${row.procedure}`,
      row.criteria && `Criteri: ${row.criteria}`,
    ]
      .filter(Boolean)
      .join("\n")
      .slice(0, MAX_CARD_CHARS);
    cards.push({ id: String(row.id), name, body });
    if (cards.length >= MAX_PROMPT_CARDS) break;
  }
  return cards;
}

async function loadSituational(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const [partnerRes, agendaRes] = await Promise.all([
      supabase.from("partners").select("id", { count: "exact", head: true }).is("deleted_at", null),
      supabase.from("activities").select("id", { count: "exact", head: true })
        .eq("user_id", userId).gte("due_at", today).lt("due_at", tomorrow),
    ]);
    const lines: string[] = [];
    if (partnerRes?.count != null) lines.push(`- Partner totali nel CRM: ${partnerRes.count}`);
    if (agendaRes?.count != null) lines.push(`- Attivita' in agenda oggi: ${agendaRes.count}`);
    return lines.length ? lines.join("\n") : "(nessuna metrica live disponibile)";
  } catch {
    return "(metriche live non recuperabili)";
  }
}

export async function assembleKb(opts: {
  supabase: SupabaseClient;
  userId: string;
  userRequest: string;
}): Promise<KbBlock> {
  const { supabase, userId, userRequest } = opts;
  const domain = detectDomain(userRequest);

  const [promptCards, situational] = await Promise.all([
    loadOperativePrompts(supabase, domain),
    loadSituational(supabase, userId),
  ]);

  const dynamicText = promptCards.length
    ? promptCards.map((c) => `### ${c.name}\n${c.body}`).join("\n\n")
    : "(nessun prompt operativo specifico per questo dominio)";

  const text = [
    "=== KNOWLEDGE BASE ===",
    "",
    "## STATIC",
    STATIC_KB,
    "",
    `## DYNAMIC (dominio: ${domain})`,
    dynamicText,
    "",
    "## SITUATIONAL",
    situational,
    "",
    "=== END KB ===",
  ].join("\n");

  return {
    text,
    domain,
    loaded_cards: promptCards.map((c) => ({ source: "operative_prompts", id: c.id, name: c.name })),
    static_chars: STATIC_KB.length,
    dynamic_chars: dynamicText.length,
    situational_chars: situational.length,
  };
}
