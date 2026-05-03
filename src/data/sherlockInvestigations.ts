/**
 * DAL — Sherlock investigations level lookup.
 * Restituisce il massimo livello di indagine completata per partner/contatto.
 */
import { untypedFrom } from "@/lib/supabaseUntyped";
import { createLogger } from "@/lib/log";

const log = createLogger("sherlockInvestigations");

export type SherlockLevelInfo = { level: 1 | 2 | 3; completed_at: string | null };

export type SherlockLevelMap = Record<string, SherlockLevelInfo>;

async function fetchMaxLevel(
  column: "partner_id" | "contact_id",
  ids: readonly string[],
): Promise<SherlockLevelMap> {
  const out: SherlockLevelMap = {};
  if (!ids.length) return out;
  try {
    const { data, error } = (await untypedFrom("sherlock_investigations")
      .select(`${column}, level, completed_at`)
      .eq("status", "completed")
      .in(column, ids as string[])) as {
      data: unknown;
      error: unknown;
    };
    if (error) throw error;
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    for (const r of rows) {
      const id = r[column] as string | null;
      const lvl = Number(r.level) as 1 | 2 | 3;
      const completedAt = (r.completed_at as string | null) ?? null;
      if (!id || !lvl) continue;
      const cur = out[id];
      if (!cur || lvl > cur.level) out[id] = { level: lvl, completed_at: completedAt };
    }
  } catch (e) {
    log.warn("fetchMaxLevel failed", { column, error: e });
  }
  return out;
}

export function getMaxLevelByPartner(partnerIds: readonly string[]): Promise<SherlockLevelMap> {
  return fetchMaxLevel("partner_id", partnerIds);
}

export function getMaxLevelByContact(contactIds: readonly string[]): Promise<SherlockLevelMap> {
  return fetchMaxLevel("contact_id", contactIds);
}
