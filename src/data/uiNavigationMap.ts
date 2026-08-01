/**
 * DAL: ui_navigation_map
 * Mappa intent → destinazione (path + filtri + modale) per il Floating Co-Pilot.
 * Editabile da Prompt Lab → Navigation Map (admin only).
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type UiNavigationMapRow = Database["public"]["Tables"]["ui_navigation_map"]["Row"];

export interface UiNavigationIntent {
  id: string;
  intent_key: string;
  label: string;
  description: string;
  examples: string[];
  path: string;
  default_filters: Record<string, unknown>;
  modal: string | null;
  modal_params: Record<string, unknown>;
  category: string;
  requires_confirmation: boolean;
  enabled: boolean;
  updated_at: string;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function toIntent(row: UiNavigationMapRow): UiNavigationIntent {
  return {
    id: row.id,
    intent_key: row.intent_key,
    label: row.label,
    description: row.description,
    examples: row.examples,
    path: row.path,
    default_filters: isRecord(row.default_filters) ? row.default_filters : {},
    modal: row.modal,
    modal_params: isRecord(row.modal_params) ? row.modal_params : {},
    category: row.category,
    requires_confirmation: row.requires_confirmation,
    enabled: row.enabled,
    updated_at: row.updated_at,
  };
}

const TABLE = "ui_navigation_map" as const;

export async function listNavigationIntents(opts?: {
  category?: string;
  onlyEnabled?: boolean;
}): Promise<UiNavigationIntent[]> {
  let query = supabase.from(TABLE).select("*");
  if (opts?.onlyEnabled) {
    query = query.eq("enabled", true);
  }
  if (opts?.category) {
    query = query.eq("category", opts.category);
  }
  const { data, error } = await query.order("category", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(toIntent);
}

export async function findIntentByKey(intentKey: string): Promise<UiNavigationIntent | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("intent_key", intentKey)
    .maybeSingle();
  if (error) throw error;
  return data ? toIntent(data) : null;
}

export async function upsertIntent(input: Partial<UiNavigationIntent> & { intent_key: string }): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .upsert(input as Database["public"]["Tables"]["ui_navigation_map"]["Insert"], { onConflict: "intent_key" });
  if (error) throw error;
}

export async function deleteIntent(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) throw error;
}

/**
 * Match euristico locale: cerca per intent_key esatto, poi fuzzy su label/description/examples.
 * Restituisce il match migliore o null.
 */
export function matchIntentLocally(
  query: string,
  intents: UiNavigationIntent[],
): UiNavigationIntent | null {
  if (!query) return null;
  const q = query.toLowerCase().trim();

  const exact = intents.find((i) => i.intent_key.toLowerCase() === q);
  if (exact) return exact;

  let best: { score: number; intent: UiNavigationIntent } | null = null;
  for (const i of intents) {
    if (!i.enabled) continue;
    let score = 0;
    if (i.label.toLowerCase().includes(q)) score += 5;
    if (i.description.toLowerCase().includes(q)) score += 2;
    for (const ex of i.examples) {
      const exl = ex.toLowerCase();
      if (exl === q) score += 10;
      else if (exl.includes(q) || q.includes(exl)) score += 4;
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { score, intent: i };
    }
  }
  return best?.intent ?? null;
}
