/**
 * DAL: ui_navigation_map
 * Mappa intent → destinazione (path + filtri + modale) per il Floating Co-Pilot.
 * Editabile da Prompt Lab → Navigation Map (admin only).
 */
import { supabase } from "@/integrations/supabase/client";

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

const TABLE = "ui_navigation_map" as const;

export async function listNavigationIntents(opts?: {
  category?: string;
  onlyEnabled?: boolean;
}): Promise<UiNavigationIntent[]> {
  // Untyped access: tabella non ancora nei generated types fino al prossimo regen.
  let query = (supabase as unknown as {
    from: (t: string) => {
      select: (cols: string) => {
        order: (col: string, opts: { ascending: boolean }) => Promise<{ data: unknown; error: unknown }>;
        eq: (col: string, val: unknown) => unknown;
      };
    };
  }).from(TABLE).select("*");
  if (opts?.onlyEnabled) {
    // chain eq before order
    query = (query as unknown as { eq: (c: string, v: unknown) => typeof query }).eq("enabled", true);
  }
  if (opts?.category) {
    query = (query as unknown as { eq: (c: string, v: unknown) => typeof query }).eq("category", opts.category);
  }
  const { data, error } = await (query as unknown as {
    order: (c: string, o: { ascending: boolean }) => Promise<{ data: unknown; error: unknown }>;
  }).order("category", { ascending: true });
  if (error) throw error;
  return (data as UiNavigationIntent[]) ?? [];
}

export async function findIntentByKey(intentKey: string): Promise<UiNavigationIntent | null> {
  const { data, error } = await (supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (c: string, v: unknown) => {
          maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
        };
      };
    };
  }).from(TABLE).select("*").eq("intent_key", intentKey).maybeSingle();
  if (error) throw error;
  return (data as UiNavigationIntent) ?? null;
}

export async function upsertIntent(input: Partial<UiNavigationIntent> & { intent_key: string }): Promise<void> {
  const { error } = await (supabase as unknown as {
    from: (t: string) => {
      upsert: (row: unknown, opts: { onConflict: string }) => Promise<{ error: unknown }>;
    };
  }).from(TABLE).upsert(input, { onConflict: "intent_key" });
  if (error) throw error;
}

export async function deleteIntent(id: string): Promise<void> {
  const { error } = await (supabase as unknown as {
    from: (t: string) => {
      delete: () => { eq: (c: string, v: unknown) => Promise<{ error: unknown }> };
    };
  }).from(TABLE).delete().eq("id", id);
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