/**
 * aiQueryTool — Tool unico AI-Native per ricerche su DB.
 *
 * Sostituisce: partnerSearch, contactSearch, prospectSearch,
 * scanWcaDirectory, deepSearchPartner.
 *
 * Flusso:
 *   1. planQuery(prompt) → AI genera QueryPlan
 *   2. executeQueryPlan(plan) → safe executor esegue su Supabase
 *   3. Renderer mappa righe in ToolResult (table)
 *
 * L'AI ha conoscenza completa dello schema DB e produce query libere
 * (rispettando whitelist tabelle/operatori e RLS).
 */
import type { Tool, ToolResult, ToolResultColumn, MultiResultPart } from "./types";
import { planQuery } from "@/v2/io/edge/aiQueryPlanner";
import { executeQueryPlan, QueryValidationError, type QueryPlan } from "../lib/safeQueryExecutor";
import { isOk } from "@/v2/core/domain/result";

/** Module-level cache of the LAST successful QueryPlan, read by useCommandSubmit
 *  to update conversational query context. Single-tab assumption is fine here. */
let _lastSuccessfulPlan: QueryPlan | null = null;
export function getLastSuccessfulQueryPlan(): QueryPlan | null {
  return _lastSuccessfulPlan;
}
export function clearLastSuccessfulQueryPlan(): void {
  _lastSuccessfulPlan = null;
}

const COUNTRY_CODE_BY_NAME: Record<string, string> = {
  malta: "MT", italia: "IT", italy: "IT", francia: "FR", france: "FR",
  spagna: "ES", spain: "ES", germania: "DE", germany: "DE",
  "regno unito": "GB", uk: "GB", inghilterra: "GB", olanda: "NL", "paesi bassi": "NL",
  netherlands: "NL", belgio: "BE", belgium: "BE", portogallo: "PT", portugal: "PT",
  grecia: "GR", greece: "GR", svizzera: "CH", switzerland: "CH", austria: "AT",
  polonia: "PL", poland: "PL", romania: "RO", turchia: "TR", turkey: "TR",
  "stati uniti": "US", usa: "US", "united states": "US", canada: "CA", brasile: "BR",
  brazil: "BR", cina: "CN", china: "CN", giappone: "JP", japan: "JP", india: "IN",
  emirati: "AE", uae: "AE", egitto: "EG", egypt: "EG", marocco: "MA", morocco: "MA",
  australia: "AU", singapore: "SG", "hong kong": "HK",
};

function deterministicPartnerCountryPlan(prompt: string): QueryPlan | null {
  const lower = prompt.toLowerCase();
  if (!/\bpartners?\b/i.test(lower)) return null;
  const country = Object.entries(COUNTRY_CODE_BY_NAME).find(([name]) => new RegExp(`\\b${name}\\b`, "i").test(lower));
  if (!country) return null;

  const [countryLabel, countryCode] = country;
  const isListIntent = /\b(elenco|elenc|lista|liste|mostra|mostrami|dammi|vedi|visualizza|fammi vedere|fai vedere)\b/i.test(prompt);
  const isCountIntent = !isListIntent && /\b(quanti|quante|totale|numero di|numero|conteggio|count)\b/i.test(prompt);

  return {
    table: "partners",
    columns: isCountIntent ? ["id"] : ["id", "company_name", "city", "country_code", "email", "website", "lead_status"],
    filters: [{ column: "country_code", op: "eq", value: countryCode }],
    limit: isCountIntent ? 1 : 200,
    title: isCountIntent ? `Conteggio partner · ${countryLabel}` : `Partner · ${countryLabel}`,
    rationale: "Piano deterministico locale per partner+paese: evita un hop AI quando la query è univoca.",
  };
}

/* ─── Bulk action templates per tabella ─── */

const BULK_ACTIONS_BY_TABLE: Record<string, ToolResult & { kind: "table" } extends infer T ? T extends { bulkActions?: infer B } ? B : never : never> = {} as never;

function bulkActionsFor(table: string): readonly { id: string; label: string; promptTemplate: string }[] {
  switch (table) {
    case "partners":
      return [
        { id: "outreach", label: "Programma outreach", promptTemplate: "Programma outreach per i partner con id: {ids}" },
        { id: "campaign", label: "Aggiungi a campagna", promptTemplate: "Crea campagna per i partner con id: {ids}" },
        { id: "enrich", label: "Arricchisci dati", promptTemplate: "Arricchisci i dati dei partner con id: {ids}" },
        { id: "score", label: "Calcola lead-score", promptTemplate: "Calcola lead-score per i partner con id: {ids}" },
      ];
    case "imported_contacts":
      return [
        { id: "outreach", label: "Programma outreach", promptTemplate: "Programma outreach per i contatti con id: {ids}" },
        { id: "compose", label: "Componi email", promptTemplate: "Componi email per i contatti con id: {ids}" },
        { id: "enrich", label: "Arricchisci", promptTemplate: "Arricchisci i contatti con id: {ids}" },
      ];
    case "outreach_queue":
      return [
        { id: "approve", label: "Approva", promptTemplate: "Approva gli outreach con id: {ids}" },
      ];
    case "activities":
      return [
        { id: "complete", label: "Segna completate", promptTemplate: "Segna come completate le attività con id: {ids}" },
      ];
    default:
      return [];
  }
}

function formatCellValue(v: unknown): string | number | null {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "✓" : "✗";
  if (typeof v === "number") return v;
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (Array.isArray(v)) return v.length === 0 ? "—" : `${v.length} item`;
  return JSON.stringify(v).slice(0, 80);
}

function humanLabel(col: string): string {
  return col
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bId\b/g, "ID");
}

export const aiQueryTool: Tool = {
  id: "ai-query",
  label: "Ricerca AI",
  description:
    "Interroga il database tramite AI: l'AI conosce lo schema e genera la query da sé (partner, contatti, attività, messaggi, biglietti, job, KB).",

  // Match generico: cattura qualsiasi prompt di lettura/ricerca/visualizzazione.
  // I tool d'azione (create/update/scrape/enrich/score/dedup/browser) hanno match più specifici e vincono.
  match(prompt: string): boolean {
    const lower = prompt.toLowerCase().trim();
    if (!lower) return false;
    // Esclusioni esplicite (azioni, non letture)
    const actionPatterns = [
      /\bcrea\b/, /\baggiungi\b/, /\baggiorna\b/, /\bmodifica\b/, /\belimina\b/,
      /\bscrap/, /\benrich/, /\barricch/, /\bdedup/, /\bcalcola lead/, /\binvia\b/,
      /\bcomponi\b/, /\bnaviga\b/, /\bcompila form/,
      /\bscriv/, /\bredig/, /\bprepar/, /\bmand/, /\bbozz[ae]/, /\bdraft\b/,
      /\b(e-?mail|mail)\s+a\b/, /\bemail\s+ai\b/, /\bmail\s+ai\b/, /\binvit/,
    ];
    if (actionPatterns.some((re) => re.test(lower))) return false;

    // Inclusioni: verbi/sostantivi tipici di query
    const queryPatterns = [
      /\bmostra/, /\belenc/, /\bcerca/, /\btrova/, /\bvisualizza/, /\blista/,
      /\bquanti/, /\bquante/, /\bultimi/, /\bultime/, /\brecenti/,
      /\bpartner/, /\bcontatt/, /\bprospect/, /\battivit/, /\bmessagg/,
      /\bagent/, /\boutreach/, /\bcampagn/, /\bjob/, /\bbiglietti/, /\bkb\b/,
      /\bscansion/, /\bscan\b/, /\bdirectory/, /\bdatabase/, /\btabella/,
    ];
    if (queryPatterns.some((re) => re.test(lower))) return true;

    // Fallback "lookup nudo": prompt breve (<= 6 token) che contiene almeno
    // un nome proprio (parola con maiuscola iniziale nel testo originale) o
    // una sequenza alfabetica plausibilmente un'azienda/persona.
    // Questo cattura prompt come "Radiant", "Acme Corp", "Mario Rossi" che
    // l'utente intende come ricerca diretta sul DB.
    const tokens = prompt.trim().split(/\s+/);
    if (tokens.length === 0 || tokens.length > 6) return false;
    const hasProperNoun = tokens.some((t) => /^[A-ZÀ-Ý][a-zà-ÿ0-9'’.-]{1,}/.test(t));
    const isAlphaOnly = /^[\p{L}\p{N}\s'’.&/-]+$/u.test(prompt.trim());
    return hasProperNoun && isAlphaOnly;
  },

  async execute(prompt: string, context): Promise<ToolResult> {
    // PREFER the natural-language prompt: if planRunner already resolved a JSON
    // payload from a multi-step plan, the AI Query Planner needs the ORIGINAL
    // user prompt (or a pre-built QueryPlan in payload), NOT a serialized JSON.
    const naturalPrompt =
      context?.originalPrompt && context.originalPrompt.trim().length > 0
        ? context.originalPrompt
        : (() => {
            // If `prompt` looks like JSON (planRunner did JSON.stringify), reject it
            const trimmed = prompt.trim();
            if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
              // Try to extract a "prompt" / "query" / "search" hint, else fallback
              try {
                const parsed = JSON.parse(trimmed) as Record<string, unknown>;
                const hint =
                  (parsed.prompt as string) ??
                  (parsed.query as string) ??
                  (parsed.search as string) ??
                  (parsed.q as string) ??
                  "";
                return typeof hint === "string" && hint.length > 0 ? hint : prompt;
              } catch {
                return prompt;
              }
            }
            return prompt;
          })();

    // 1) Genera QueryPlan. Per query partner+paese univoche usiamo un piano
    //    deterministico locale: è il percorso storico operativo e non consuma
    //    un ulteriore hop AI solo per tradurre "Malta" → "MT".
    const localPlan = deterministicPartnerCountryPlan(naturalPrompt);
    let plans: QueryPlan[] | null = localPlan ? [localPlan] : null;
    if (!plans) {
      const planRes = await planQuery({
        prompt: naturalPrompt,
        history: context?.history,
        contextHint: context?.contextHint,
      });

      if (!isOk(planRes)) {
        return {
          kind: "result",
          title: "Query AI · Errore planner",
          message: `Non sono riuscito a interpretare la richiesta. Riformulala in modo più specifico (es. "mostra partner US attivi", "ultimi 20 contatti", "messaggi non letti").`,
          meta: { count: 0, sourceLabel: "AI Query Planner" },
        };
      }
      plans = planRes.value.plans;
    }

    // Caso INVALID: planner ha esplicitamente segnalato richiesta non-query.
    const firstPlan = plans[0];
    if (firstPlan.table === "INVALID") {
      return {
        kind: "result",
        title: "Query AI · Richiesta non supportata",
        message:
          firstPlan.rationale ?? "Questa richiesta non è una query di lettura. Prova con un'azione esplicita o riformulala come ricerca.",
        meta: { count: 0, sourceLabel: "AI Query Planner" },
      };
    }

    // 2) Esegui i piani in PARALLELO. allSettled: una query può fallire senza
    //    bloccare le altre (es. tabella valida + colonna inventata in una sola).
    const t0 = Date.now();
    const settled = await Promise.allSettled(
      plans.map(async (p) => {
        const start = Date.now();
        const exec = await executeQueryPlan(p);
        return { plan: p, exec, durationMs: Date.now() - start };
      }),
    );

    const idField = "id";

    const buildPart = (
      plan: QueryPlan,
      exec: { rows: Record<string, unknown>[]; count: number; table: string; columnsUsed: string[] } | null,
      error: string | null,
      durationMs: number,
    ): MultiResultPart => {
      if (!exec) {
        return {
          title: plan.title ?? `Risultati · ${plan.table}`,
          table: plan.table,
          count: 0,
          columns: [],
          rows: [],
          filters: plan.filters,
          error: error ?? "Errore sconosciuto",
          durationMs,
        };
      }
      const visibleCols = exec.columnsUsed.filter((c) => c !== idField).slice(0, 8);
      const columns: ToolResultColumn[] = visibleCols.map((c) => ({ key: c, label: humanLabel(c) }));
      const tableRows = exec.rows.map((r) => {
        const out: Record<string, string | number | null> = {};
        if (idField in r) out[idField] = String(r[idField] ?? "");
        for (const c of visibleCols) out[c] = formatCellValue(r[c]);
        return out;
      });
      return {
        title: plan.title ?? `Risultati · ${exec.table}`,
        table: exec.table,
        count: exec.count,
        columns,
        rows: tableRows,
        filters: plan.filters,
        durationMs,
      };
    };

    const parts: MultiResultPart[] = settled.map((s, i) => {
      const plan = plans[i];
      if (s.status === "fulfilled") {
        return buildPart(plan, s.value.exec, null, s.value.durationMs);
      }
      const reason = s.reason;
      const msg = reason instanceof QueryValidationError ? reason.message : reason instanceof Error ? reason.message : String(reason);
      return buildPart(plan, null, msg, 0);
    });

    // ── Caso 1 piano: mantengo retro-compatibilità totale (kind:"table"). ──
    if (parts.length === 1) {
      const part = parts[0];
      const plan = plans[0];
      if (part.error) {
        return {
          kind: "result",
          title: "Query AI · Errore esecuzione",
          message: `❌ ${part.error}`,
          meta: { count: 0, sourceLabel: "Safe Query Executor" },
        };
      }
      _lastSuccessfulPlan = plan;
      return {
        kind: "table",
        title: part.title,
        columns: part.columns,
        rows: part.rows,
        meta: {
          count: part.count,
          sourceLabel: `AI Query · ${part.table}${plan.rationale ? ` · ${plan.rationale}` : ""}`,
        },
        selectable: true,
        idField,
        liveSource: part.table,
        bulkActions: bulkActionsFor(part.table),
        queryFilters: plan.filters,
      };
    }

    // ── Caso N piani: kind:"multi". Cache il primo piano riuscito per follow-up. ──
    const firstSuccessIdx = parts.findIndex((p) => !p.error);
    if (firstSuccessIdx >= 0) {
      _lastSuccessfulPlan = plans[firstSuccessIdx];
    }
    const totalCount = parts.reduce((s, p) => s + (p.error ? 0 : p.count), 0);
    const tableNames = parts.map((p) => p.table).join(" + ");
    const totalMs = Date.now() - t0;
    return {
      kind: "multi",
      title: `Risultati · ${tableNames}`,
      parts,
      meta: {
        count: totalCount,
        sourceLabel: `AI Query · ${parts.length} entità · ${totalMs}ms`,
      },
    };
  },
};
