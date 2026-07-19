/**
 * DAL — Prompt Lab Health KPIs.
 * Read-only aggregation. Nessuna scrittura, nessun side-effect.
 */
import { supabase } from "@/integrations/supabase/client";

export interface PromptLabHealth {
  promptsActive: number;
  promptsDistinctNames: number;
  duplicateGroups: number;
  duplicateExtraRows: number;
  personasTotal: number;
  personasThin: number;
  testCasesActive: number;
  testRuns7d: number;
  testRuns30d: number;
  testPassed7d: number;
  lastTestRun: string | null;
  refinerPending: number;
  copilotPending: number;
  cronTestRunner: boolean;
  cronRefiner: boolean;
  fetchedAt: string;
}

type Row = Record<string, unknown>;

function num(row: Row | undefined, key: string): number {
  const v = row?.[key];
  return typeof v === "number" ? v : v == null ? 0 : Number(v) || 0;
}

export async function fetchPromptLabHealth(): Promise<PromptLabHealth> {
  // Una sola RPC sarebbe ideale; per ora 4 query parallele su tabelle già RLS-protette.
  const [promptsRes, personasRes, testsRes, proposalsRes] = await Promise.all([
    (supabase as unknown as { rpc: (n: string) => Promise<{ data: Row[] | null; error: unknown }> })
      .rpc("prompt_lab_health_prompts")
      .catch(() => ({ data: null, error: null })),
    supabase.from("agent_personas").select("custom_tone_prompt"),
    supabase
      .from("prompt_test_runs")
      .select("status, created_at")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("prompt_change_proposals")
      .select("status")
      .eq("status", "pending"),
  ]);

  // Fallback: se la RPC non esiste, calcola lato client
  let promptsActive = 0;
  let promptsDistinct = 0;
  let dupGroups = 0;
  let dupExtra = 0;
  if (promptsRes.data && Array.isArray(promptsRes.data) && promptsRes.data.length > 0) {
    const r = promptsRes.data[0] as Row;
    promptsActive = num(r, "prompts_active");
    promptsDistinct = num(r, "prompts_distinct_names");
    dupGroups = num(r, "dup_name_groups");
    dupExtra = num(r, "dup_extra_rows");
  } else {
    const { data: opRows } = await supabase
      .from("operative_prompts")
      .select("name")
      .eq("is_active", true);
    const names = (opRows ?? []).map((r) => (r as { name: string }).name);
    promptsActive = names.length;
    const counts = new Map<string, number>();
    for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1);
    promptsDistinct = counts.size;
    for (const c of counts.values()) {
      if (c > 1) {
        dupGroups += 1;
        dupExtra += c - 1;
      }
    }
  }

  const personas = (personasRes.data ?? []) as Array<{ custom_tone_prompt: string | null }>;
  const personasThin = personas.filter(
    (p) => (p.custom_tone_prompt ?? "").length < 300,
  ).length;

  const runs = (testsRes.data ?? []) as Array<{ status: string; created_at: string }>;
  const now = Date.now();
  const ms7 = 7 * 24 * 3600 * 1000;
  const ms30 = 30 * 24 * 3600 * 1000;
  let runs7 = 0;
  let runs30 = 0;
  let passed7 = 0;
  for (const r of runs) {
    const t = new Date(r.created_at).getTime();
    const age = now - t;
    if (age <= ms30) runs30 += 1;
    if (age <= ms7) {
      runs7 += 1;
      if (r.status === "passed") passed7 += 1;
    }
  }
  const lastTestRun = runs.length > 0 ? runs[0].created_at : null;

  // Cron presence (best-effort, non blocca)
  const cronRes = await (
    supabase as unknown as {
      rpc: (n: string) => Promise<{ data: Row[] | null; error: unknown }>;
    }
  )
    .rpc("prompt_lab_cron_status")
    .catch(() => ({ data: null, error: null }));
  const cronRow = (cronRes.data?.[0] ?? {}) as Row;
  const cronTestRunner = Boolean(cronRow.cron_test_runner);
  const cronRefiner = Boolean(cronRow.cron_refiner);

  // ai_pending_actions: refiner pending — non garantito tutti i progetti l'abbiano
  let refinerPending = 0;
  try {
    const { count } = await (
      supabase as unknown as {
        from: (t: string) => {
          select: (
            c: string,
            o: { count: "exact"; head: true },
          ) => {
            eq: (
              k: string,
              v: string,
            ) => { eq: (k: string, v: string) => Promise<{ count: number | null }> };
          };
        };
      }
    )
      .from("ai_pending_actions")
      .select("id", { count: "exact", head: true })
      .eq("action_type", "prompt_refinement")
      .eq("status", "pending");
    refinerPending = count ?? 0;
  } catch {
    refinerPending = 0;
  }

  return {
    promptsActive,
    promptsDistinctNames: promptsDistinct,
    duplicateGroups: dupGroups,
    duplicateExtraRows: dupExtra,
    personasTotal: personas.length,
    personasThin,
    testCasesActive: 0,
    testRuns7d: runs7,
    testRuns30d: runs30,
    testPassed7d: passed7,
    lastTestRun,
    refinerPending,
    copilotPending: (proposalsRes.data ?? []).length,
    cronTestRunner,
    cronRefiner,
    fetchedAt: new Date().toISOString(),
  };
}
