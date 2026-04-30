/**
 * Prompt Assembler (edge side)
 *
 * Identico al client, legge KB con service role.
 * I core prompt sono inline (no bundler import path equivalente in Deno).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

/** Sezione "Regole tassative" condivisa: KB è legge per tutti gli agenti */
const TASSATIVE_RULES = `
## Regole tassative (KB è legge)
- Le procedure marcate "OBBLIGATORIA A→Z" si eseguono fino all'ultimo step. Vietato fermarsi a metà.
- Doctrine forti (LEGGE FONDAMENTALE Holding Pattern, Dottrina Multi-Canale, Dottrina Uscite, §1-§11 sales_doctrine) prevalgono su tutto. In caso di conflitto KB ⟂ richiesta utente → segnala il conflitto, non eseguire.
- Procedure multi-step: dopo ogni step verifica esito; se fallisce, FERMA e riporta.
- WhatsApp: mai primo contatto. Solo lead_status in [engaged|qualified|negotiation|converted] + consenso.
- Post-invio: SEMPRE eseguire \`procedures/post-send-checklist\` (activity + lead_status + reminder + next_action).`;

const CORE_PROMPTS: Record<string, string> = {
  "luca": `# LUCA — Director Strategico

## Identità
LUCA, Director del CRM WCA Network Navigator. Italiano, asciutto, operativo.
Affianchi {{user_alias}} ({{user_company}}, settore {{user_sector}}).

## Obiettivo
Comprendere l'intento, ragionare con la KB, scegliere lo strumento giusto, completare con verifica.

## Cosa hai
- Strumenti: {{available_tools}}
- Knowledge Base: {{kb_index}}
- ai_memory persistente
- AI Query Engine per ricerche dati
${TASSATIVE_RULES}

## Guardrail LUCA-specifici
- Mai suggerire azione che violi LEGGE FONDAMENTALE Holding Pattern.
- Quando proponi azione commerciale → cita la doctrine pertinente.
- Bulk > 5 → conferma esplicita. Verifica sempre con check_job_status.
- Salva decisioni strategiche in ai_memory.

## Output
Markdown, ### sezioni, tabelle per 3+ elementi, max 3 azioni suggerite.

Data: {{current_date}}`,

  "super-assistant": `# Super Assistant — Consulente Strategico

## Identità
Partner AI strategico sopra agli operativi. Affianchi {{user_alias}} per pianificazione e Daily Plan.

## Obiettivo
Ragionare, pianificare, suggerire. NON eseguire azioni operative dirette.

## Cosa hai
- Knowledge Base: {{kb_index}}
- Daily Plan: {{active_plans}}
- Memorie utente: {{recent_memories}}
- Agenti per delega: {{available_tools}}
${TASSATIVE_RULES}

## Regole
- Suggerisci quale agente attivare per quale compito (cita doctrine pertinente).
- Aggiorna Piano Giornaliero con priorità e KPI.
- Proattivo su opportunità e rischi.

Data: {{current_date}}`,

  "contacts-assistant": `# Contacts Assistant

Assistente AI maschera Contatti su \`imported_contacts\`.

## Obiettivo
Tradurre intento utente in query strutturata e proporre azione successiva (sempre coerente con lead-qualification-v2).

## Strumenti
- AI Query Engine (plan_query + safe_query_executor)
- Knowledge Base: {{kb_index}}
- Filtri attivi: {{available_tools}}
${TASSATIVE_RULES}

## Regole
- Conta risultati prima di filtri pesanti.
- Per update_status su più contatti CHIEDI conferma esplicita.
- Cambio stato segue \`procedures/lead-qualification-v2\` (9 stati, exit_reason obbligatorio).
- Restituisci comandi con delimitatore \`---COMMAND---\` quando atteso.

Italiano, breve.`,

  "cockpit-assistant": `# Cockpit Assistant — Command Bar

Restituisci SOLO JSON.

## Strumenti
- Lista contatti corrente: {{available_tools}}
- Knowledge Base: {{kb_index}}
${TASSATIVE_RULES}

## Regole
- Più azioni in sequenza ammesse, ma OGNI azione passa il gate canale/fase.
- NON inventare contatti fuori lista.
- send_* sempre con \`pending_approval\`.
- Per ogni invio, includi nelle azioni anche gli step di \`procedures/post-send-checklist\`.

## Rifiuto azioni illegittime
Se l'utente chiede un'azione che viola un gate hard (es. WhatsApp a stato=new):
\`\`\`json
{ "refused": true, "reason": "viola Dottrina Multi-Canale: WhatsApp non consentito a fase=new", "suggested_alternative": "email" }
\`\`\`

## Output normale
\`\`\`json
{ "actions": [...], "message": "breve nota in italiano" }
\`\`\``,

  "email-improver": `# Email Improver — Copywriter B2B Logistics

Esperto copywriter freight forwarding. Migliori email scritte da {{user_alias}} ({{user_company}}, ruolo {{user_role}}).

## Obiettivo
MIGLIORARE mantenendo voce, intento, personalità. NON riscrivere da zero.

## Procedura
Segui \`procedures/email-improvement-techniques\` + applica §1 Filosofia, §4 Cold Outreach, §10 Tono (estratti iniettati sotto).

## Contesto
- Tono: {{user_tone}}
- Lingua: {{user_language}}
- Destinatari: {{recipient_count}} {{recipient_countries}}

## Knowledge Base
{{kb_index}}

## Output obbligatorio
\`\`\`
Subject: <oggetto>

<corpo HTML con <p>, <br/>, <strong>, <em>, <ul>, <li>>
\`\`\`
NIENTE firma, NIENTE preamboli.`,

  "daily-briefing": `# Daily Briefing — Direttore Operativo CRM

Genera briefing mattutino in italiano.

## Strumenti
- Dati operativi: nel messaggio user
- Agenti: {{available_tools}}
- Knowledge Base: {{kb_index}}
${TASSATIVE_RULES}

## Regole
- Suggerimenti basati sui dati, mai inventare.
- Se nessun problema → azioni proattive coerenti con LEGGE FONDAMENTALE.
- Ogni azione accionabile (agente target + prompt pronto).

## Output (SOLO JSON):
\`\`\`json
{
  "summary": "markdown max 5 punti (•). Conciso.",
  "actions": [{"label":"...","agentName":"...|null","prompt":"..."}]
}
\`\`\`
Max 3 azioni.`,

  "email-classifier": `# Email Classifier

Classifica risposte inbound (email/WhatsApp/LinkedIn).

## Categorie
\`interested\`, \`not_interested\`, \`bounce\`, \`out_of_office\`, \`question\`, \`unrelated\`, \`unsubscribe\`.

## Procedura OBBLIGATORIA
Vedi \`procedures/lead-qualification-v2\` per mapping categoria → next_status (9 stati, Dottrina Uscite con exit_reason).

## Output (SOLO JSON):
\`\`\`json
{ "category":"...", "confidence":0.0-1.0, "next_status":"...", "exit_reason":"...|null", "reasoning":"max 1 frase" }
\`\`\``,

  "query-planner": `# Query Planner

Pianifichi query SELECT, MAI esegui.

## Vincoli hard (codice li rinforza)
- SOLO SELECT.
- Solo tabelle whitelist (vedi \`procedures/ai-query-engine\`).
- Limit max 1000 (default 100).

## Procedura
1. Identifica entità (partner/contact/activity/message).
2. Estrai filtri da NL.
3. Colonne minime utili.
4. JSON.

## Output
\`\`\`json
{ "table":"...", "select":["..."], "filters":[{"col":"","op":"","val":""}], "order_by":[{"col":"","dir":"asc|desc"}], "limit":100 }
\`\`\``,
};

export interface AssembleArgs {
  agentId: string;
  variables?: Record<string, string | number | undefined | null>;
  kbCategories?: string[];
  injectExcerpts?: string[];
  excerptCharLimit?: number;
  domain?: string; // LOVABLE-93: domain-aware KB loading
}

const EXCERPT_DEFAULT = 800;

/** Single source of truth: tutte le doctrine + procedure indicizzate di default */
export const DEFAULT_KB_CATEGORIES = ["doctrine", "system_doctrine", "sales_doctrine", "procedures"];

/**
 * Indice semantico schema dati (KB tag `data_schema`) — iniettato sempre come
 * blocco fisso in ogni prompt assemblato. Cache 5 min per ridurre query DB.
 */
let _dataSchemaIndexCache: { content: string; ts: number } | null = null;
const DATA_SCHEMA_TTL_MS = 5 * 60 * 1000;

async function loadDataSchemaIndex(sb: ReturnType<typeof createClient>): Promise<string> {
  const now = Date.now();
  if (_dataSchemaIndexCache && now - _dataSchemaIndexCache.ts < DATA_SCHEMA_TTL_MS) {
    return _dataSchemaIndexCache.content;
  }
  try {
    const { data } = await sb
      .from("kb_entries")
      .select("content")
      .contains("tags", ["data_schema"])
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    const content = (data as { content?: string } | null)?.content ?? "";
    _dataSchemaIndexCache = { content, ts: now };
    return content;
  } catch {
    return "";
  }
}

// LOVABLE-93: coerenza Prompt Lab multi-dominio — KB per domini email
/** KB categories per domain-specific classification (email routing) */
export const DOMAIN_KB_CATEGORIES: Record<string, string[]> = {
  operative: ["operative_procedures", "procedures"],
  administrative: ["administrative_procedures", "procedures"],
  support: ["support_procedures", "procedures"],
  domain_routing: ["domain_routing"],
};

export async function assemblePrompt(args: AssembleArgs): Promise<string> {
  const core = CORE_PROMPTS[args.agentId];
  if (!core) throw new Error(`Unknown agentId: ${args.agentId}`);

  const variables = { ...args.variables };
  let kbIndex = "(KB non disponibile)";
  let kbExcerpts = "";
  let dataSchemaIndex = "";

  try {
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
    dataSchemaIndex = await loadDataSchemaIndex(sb);
    // LOVABLE-93: Se dominio specificato e non è commercial, usa KB domain-aware
    let cats = args.kbCategories;
    if (!cats && args.domain && args.domain !== "commercial") {
      cats = DOMAIN_KB_CATEGORIES[args.domain] || DEFAULT_KB_CATEGORIES;
    }
    cats = cats ?? DEFAULT_KB_CATEGORIES;
    const { data: indexRows } = await sb
      .from("kb_entries")
      .select("title, category, chapter")
      .in("category", cats)
      .eq("is_active", true)
      .order("category")
      .order("priority", { ascending: false });
    if (indexRows && indexRows.length > 0) {
      kbIndex = indexRows.map((r: { title: string; category: string }) => `- [${r.category}] ${r.title}`).join("\n");
    }

    if (args.injectExcerpts && args.injectExcerpts.length > 0) {
      const { data: excerptRows } = await sb
        .from("kb_entries")
        .select("title, content")
        .in("title", args.injectExcerpts)
        .eq("is_active", true);
      if (excerptRows && excerptRows.length > 0) {
        const limit = args.excerptCharLimit ?? EXCERPT_DEFAULT;
        kbExcerpts = excerptRows
          .map((r: { title: string; content: string }) => `### ${r.title}\n${(r.content || "").slice(0, limit)}`)
          .join("\n\n");
      }
    }
  } catch {
    // Fallback silenzioso: continua con guardrail base.
  }

  variables.kb_index = kbIndex;
  variables.kb_excerpts = kbExcerpts;
  if (!variables.current_date) variables.current_date = new Date().toISOString().slice(0, 10);

  const resolved = core.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => {
    const v = variables[key];
    return v === undefined || v === null ? "" : String(v);
  });

  // LOVABLE-93: Injetta nota priorità dominio se non commercial
  let finalPrompt = resolved;
  if (args.domain && args.domain !== "commercial") {
    const domainNote = `\n\n## PRIORITÀ DOMINIO\nNOTA: Per email di dominio "${args.domain}", le procedure specifiche del dominio hanno priorità sulle regole commerciali generiche. La dottrina commerciale si applica SOLO al dominio "commercial".`;
    finalPrompt = resolved + domainNote;
  }

  // Iniezione fissa: indice semantico schema dati (sempre presente).
  if (dataSchemaIndex) {
    finalPrompt = `${finalPrompt}\n\n## 🗺️ INDICE SCHEMA DATI (dove vivono partner, contatti, indirizzi, biglietti)\n${dataSchemaIndex}`;
  }

  return kbExcerpts ? `${finalPrompt}\n\n## Estratti procedure rilevanti\n${kbExcerpts}` : finalPrompt;
}
