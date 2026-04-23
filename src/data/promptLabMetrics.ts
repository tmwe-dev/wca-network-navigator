/**
 * promptLabMetrics.ts — Sistema di tracciamento metriche per Prompt Lab.
 *
 * Traccia effettività dei miglioramenti: numero blocchi processati,
 * tasso di accettazione, distribuzione esiti, dimensione media cambiamenti.
 *
 * Persiste su app_settings con chiave prompt_lab_metrics_${runId}.
 */
import { supabase } from "@/integrations/supabase/client";
import { upsertAppSetting, getAppSetting } from "./appSettings";
import type { GlobalProposal } from "@/v2/ui/pages/prompt-lab/hooks/useProposalProcessing";

/**
 * Tipo di esito del blocco migliorato.
 * Mappa 1:1 con OutcomeType da useProposalProcessing.
 */
export type OutcomeType =
  | "text_fix"
  | "kb_fix"
  | "contract_needed"
  | "code_policy_needed"
  | "runtime_mapping_fix"
  | "no_change";

/**
 * Metriche aggregate per un run di miglioramento.
 */
export interface PromptLabMetrics {
  // Conteggi base
  total_blocks: number;
  accepted_count: number;
  rejected_count: number;
  skipped_count: number;
  error_count: number;

  // Tassi
  acceptance_rate: number; // accepted / (accepted + rejected), 0-1

  // Distribuzione esiti (solo per blocchi elaborati)
  outcome_distribution: Record<OutcomeType, number>;

  // Cambiamenti medi
  avg_change_size: number; // media caratteri |after - before|

  // Metadati run
  run_id: string;
  user_id: string;
  created_at: string;
  completed_at?: string;
}

/**
 * Metriche aggregate per utente (ultimi 20 run).
 */
export interface AggregateMetrics {
  overall_acceptance_rate: number; // media pesata ultimi run
  total_blocks_improved: number;
  avg_acceptance_rate: number; // media semplice ultimi run
  run_count: number;
  outcome_distribution: Record<OutcomeType, number>;
}

/**
 * Summary compatto per UI display.
 */
export interface MetricsSummary {
  acceptance_rate: number; // percentuale 0-100
  total_blocks: number;
  accepted_count: number;
  status: "excellent" | "good" | "moderate" | "poor"; // basato su acceptance_rate
}

/**
 * Calcola e salva metriche per un run completato.
 *
 * Estrae da proposals:
 * - Status: saved (accepted), ready (rejected se non saved), skipped, error
 * - Differenza |after - before| per avg_change_size
 * - outcome_type per distribuzione esiti
 *
 * @param runId ID del run (from prompt_lab_global_runs)
 * @param userId ID utente
 * @param proposals Array di proposte completate
 * @returns Metriche calcolate
 */
export async function trackImprovementMetrics(
  runId: string,
  userId: string,
  proposals: ReadonlyArray<GlobalProposal>,
): Promise<PromptLabMetrics> {
  // Conteggi base
  const total_blocks = proposals.length;
  const accepted_count = proposals.filter((p) => p.status === "saved").length;
  const rejected_count = proposals.filter((p) => p.status === "ready").length;
  const skipped_count = proposals.filter((p) => p.status === "skipped").length;
  const error_count = proposals.filter((p) => p.status === "error").length;

  // Tasso di accettazione
  const acceptance_rate =
    accepted_count + rejected_count > 0
      ? accepted_count / (accepted_count + rejected_count)
      : 0;

  // Distribuzione esiti
  const outcome_distribution: Record<OutcomeType, number> = {
    text_fix: 0,
    kb_fix: 0,
    contract_needed: 0,
    code_policy_needed: 0,
    runtime_mapping_fix: 0,
    no_change: 0,
  };

  proposals.forEach((p) => {
    if (p.outcomeType && p.outcomeType in outcome_distribution) {
      outcome_distribution[p.outcomeType as OutcomeType]++;
    }
  });

  // Dimensione media cambiamenti
  let totalDiff = 0;
  let countWithDiff = 0;
  proposals.forEach((p) => {
    if (p.after && p.before) {
      totalDiff += Math.abs(p.after.length - p.before.length);
      countWithDiff++;
    }
  });
  const avg_change_size = countWithDiff > 0 ? totalDiff / countWithDiff : 0;

  // Componi metriche
  const metrics: PromptLabMetrics = {
    total_blocks,
    accepted_count,
    rejected_count,
    skipped_count,
    error_count,
    acceptance_rate,
    outcome_distribution,
    avg_change_size,
    run_id: runId,
    user_id: userId,
    created_at: new Date().toISOString(),
  };

  // Salva su app_settings
  const key = `prompt_lab_metrics_${runId}`;
  try {
    await upsertAppSetting(userId, key, JSON.stringify(metrics));
  } catch (e) {
    console.error(
      `[trackImprovementMetrics] Errore salvataggio metriche ${runId}:`,
      e,
    );
    // Non lanciamo errore — continuiamo comunque
  }

  return metrics;
}

/**
 * Carica le ultime 20 metriche run per utente.
 *
 * @param userId ID utente
 * @returns Array metriche (ultimi run per primi)
 */
async function loadRunMetrics(userId: string): Promise<PromptLabMetrics[]> {
  const metrics: PromptLabMetrics[] = [];

  // Cerchiamo tutte le chiavi prompt_lab_metrics_*
  // NB: Supabase non ha una query "like", quindi facciamo un'app_settings
  // select senza filtro key, poi filterizziamo in memory.
  // Alternatively, potremmo iterare una lista di runId noti, ma qui facciamo semplice.
  const { data, error } = await (supabase as any)
    .from("app_settings")
    .select("key,value")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[loadRunMetrics] Errore query app_settings:", error);
    return [];
  }

  if (!data) return [];

  // Filtra chiavi prompt_lab_metrics_*
  data.forEach((row: { key: string; value: string }) => {
    if (row.key.startsWith("prompt_lab_metrics_")) {
      try {
        const m = JSON.parse(row.value) as PromptLabMetrics;
        metrics.push(m);
      } catch {
        // Ignora parsing errors
      }
    }
  });

  // Ritorna ultimi 20
  return metrics.slice(0, 20);
}

/**
 * Calcola aggregate statistics per utente.
 *
 * Carica ultime 20 metriche e calcola:
 * - acceptance_rate media pesata
 * - total_blocks_improved
 * - acceptance_rate media semplice
 * - distribuzione esiti aggregata
 *
 * @param userId ID utente
 * @returns Metriche aggregate
 */
export async function getAggregateMetrics(userId: string): Promise<AggregateMetrics> {
  const metrics = await loadRunMetrics(userId);

  if (metrics.length === 0) {
    return {
      overall_acceptance_rate: 0,
      total_blocks_improved: 0,
      avg_acceptance_rate: 0,
      run_count: 0,
      outcome_distribution: {
        text_fix: 0,
        kb_fix: 0,
        contract_needed: 0,
        code_policy_needed: 0,
        runtime_mapping_fix: 0,
        no_change: 0,
      },
    };
  }

  // Accettazione pesata (sum(accepted) / sum(accepted+rejected))
  const totalAccepted = metrics.reduce((sum, m) => sum + m.accepted_count, 0);
  const totalProcessed = metrics.reduce(
    (sum, m) => sum + m.accepted_count + m.rejected_count,
    0,
  );
  const overall_acceptance_rate = totalProcessed > 0 ? totalAccepted / totalProcessed : 0;

  // Blocchi totali migliorati
  const total_blocks_improved = metrics.reduce((sum, m) => sum + m.accepted_count, 0);

  // Accettazione media
  const avg_acceptance_rate = metrics.reduce((sum, m) => sum + m.acceptance_rate, 0) / metrics.length;

  // Distribuzione esiti aggregata
  const outcome_distribution: Record<OutcomeType, number> = {
    text_fix: 0,
    kb_fix: 0,
    contract_needed: 0,
    code_policy_needed: 0,
    runtime_mapping_fix: 0,
    no_change: 0,
  };
  metrics.forEach((m) => {
    Object.entries(m.outcome_distribution).forEach(([key, count]) => {
      outcome_distribution[key as OutcomeType] += count;
    });
  });

  return {
    overall_acceptance_rate,
    total_blocks_improved,
    avg_acceptance_rate,
    run_count: metrics.length,
    outcome_distribution,
  };
}

/**
 * Ritorna summary compatto per UI display.
 *
 * Usa metriche aggregate ultima settimana, o ultimi run se non c'è storico.
 *
 * @param userId ID utente
 * @returns Summary per badge UI
 */
export async function getMetricsSummary(userId: string): Promise<MetricsSummary> {
  const metrics = await loadRunMetrics(userId);

  if (metrics.length === 0) {
    return {
      acceptance_rate: 0,
      total_blocks: 0,
      accepted_count: 0,
      status: "poor",
    };
  }

  // Usa ultima run o media ultimi run
  const m = metrics[0];
  const acceptance_pct = Math.round(m.acceptance_rate * 100);

  let status: "excellent" | "good" | "moderate" | "poor";
  if (acceptance_pct >= 70) {
    status = "excellent";
  } else if (acceptance_pct >= 50) {
    status = "good";
  } else if (acceptance_pct >= 30) {
    status = "moderate";
  } else {
    status = "poor";
  }

  return {
    acceptance_rate: acceptance_pct,
    total_blocks: m.total_blocks,
    accepted_count: m.accepted_count,
    status,
  };
}
