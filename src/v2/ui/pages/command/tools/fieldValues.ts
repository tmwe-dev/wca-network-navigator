/**
 * Tool: field-values — introspezione dei valori reali di un campo.
 *
 * Risponde a "quali valori esistono nel campo X di Y", "che stati ha…",
 * distinguendo "campo vuoto" da "filtro sbagliato" (diagnosi dalla RPC).
 */
import { rpcFieldValues } from "@/data/aiFieldValues";
import { rpcIntrospectSchema } from "@/data/rpc";
import type { Tool, ToolResult } from "./types";

/** Sinonimi in linguaggio naturale → tabella reale. */
const TABLE_ALIASES: readonly (readonly [RegExp, string])[] = [
  [/partner|aziend/i, "partners"],
  [/contatt|rubrica/i, "imported_contacts"],
  [/biglietti|business card/i, "business_cards"],
  [/messagg|posta|inbox|email ricevut/i, "channel_messages"],
  [/attivit|agenda/i, "activities"],
  [/coda|outreach|campagn/i, "email_campaign_queue"],
];

function parse(prompt: string): { table: string; column: string } | null {
  const col = prompt.match(/campo\s+["'`]?([a-z_][a-z0-9_]{2,})["'`]?/i)?.[1];
  if (!col) return null;
  const table = TABLE_ALIASES.find(([re]) => re.test(prompt))?.[1] ?? "partners";
  return { table, column: col.toLowerCase() };
}

export const fieldValuesTool: Tool = {
  id: "field-values",
  label: "Valori di un campo",
  description: "Mostra i valori reali presenti in un campo di una tabella (distinti, conteggi, nulli e diagnosi).",
  match: (p) => /\bcampo\s+[a-z_][a-z0-9_]{2,}/i.test(p) && /valor|quali|elenc|distint|opzion|stat[oi]/i.test(p),

  execute: async (prompt: string): Promise<ToolResult> => {
    const parsed = parse(prompt);
    if (!parsed) {
      return {
        kind: "result",
        title: "Valori di un campo",
        status: "empty",
        message: "Indica il campo da ispezionare, es. «quali valori esistono nel campo lead_status dei partner».",
      };
    }

    let column = parsed.column;
    let data = await rpcFieldValues(parsed.table, column, 20);

    // Fallback: il campo indicato dall'utente può non esistere con quel nome esatto.
    if (data?.error) {
      const schema = await rpcIntrospectSchema([parsed.table]);
      const cols = schema?.[0]?.columns?.map((c) => c.name) ?? [];
      const guess = cols.find((c) => c === column) ?? cols.find((c) => c.includes(column) || column.includes(c));
      if (guess && guess !== column) {
        column = guess;
        data = await rpcFieldValues(parsed.table, column, 20);
      }
    }
    if (!data || data.error) {
      return {
        kind: "result",
        title: `Campo ${parsed.table}.${column}`,
        status: "error",
        message: data?.error ?? "Campo o tabella non leggibili.",
      };
    }

    const rows = (data.top_values ?? []).map((r) => ({
      value: r.value ?? "(vuoto)",
      count: r.count,
    }));

    return {
      kind: "table",
      title: `Valori · ${parsed.table}.${column}`,
      meta: {
        count: rows.length,
        sourceLabel: `DB · ${data.distinct_values ?? rows.length} valori distinti · ${data.non_null ?? 0}/${data.total_rows ?? 0} valorizzati`,
        ...(data.diagnosis ? { auditRefs: [{ kind: "context" as const, label: "Diagnosi", value: data.diagnosis }] } : {}),
      },
      columns: [
        { key: "value", label: "Valore" },
        { key: "count", label: "Record" },
      ],
      rows,
    };
  },
};
