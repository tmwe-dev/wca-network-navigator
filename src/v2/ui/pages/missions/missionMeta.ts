/**
 * missionMeta — SSOT presentazionale delle missioni autopilot.
 * Etichette, toni semantici e calcoli di avanzamento (invariati rispetto
 * alla versione precedente della pagina: solo estratti in un modulo comune).
 */
import type { StatusTone } from "@/v2/ui/molecules/StatusDot";

export const STATUS_META: Record<string, { label: string; tone: StatusTone }> = {
  draft: { label: "Bozza", tone: "muted" },
  active: { label: "Attiva", tone: "success" },
  paused: { label: "In pausa", tone: "warning" },
  completed: { label: "Conclusa", tone: "muted" },
  failed: { label: "Fallita", tone: "danger" },
  budget_exhausted: { label: "Budget esaurito", tone: "danger" },
};

export function statusMeta(status: string): { label: string; tone: StatusTone } {
  return STATUS_META[status] ?? { label: status, tone: "muted" };
}

export const GOAL_TYPES = [
  { value: "get_replies", label: "Ottenere risposte" },
  { value: "book_meetings", label: "Prenotare meeting" },
  { value: "qualify_prospects", label: "Qualificare prospect" },
  { value: "custom", label: "Obiettivo custom" },
];

export const GOAL_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  GOAL_TYPES.map((g) => [g.value, g.label]),
);

export const EVENT_LABELS: Record<string, string> = {
  mission_created: "Missione creata",
  mission_started: "Missione avviata",
  mission_paused: "Missione in pausa",
  mission_resumed: "Missione ripresa",
  mission_completed: "Missione conclusa",
  mission_failed: "Missione interrotta",
  action_planned: "Azione pianificata",
  action_executed: "Azione eseguita",
  email_sent: "Email inviata",
  reply_received: "Risposta ricevuta",
  budget_warning: "Allerta budget",
  budget_exhausted: "Budget esaurito",
};

export type MissionEvent = { id: string; event_type: string; payload: unknown; created_at: string };

export function computeKpiProgress(
  target: Record<string, number | string>,
  current: Record<string, number>,
): number {
  const numericKeys = Object.keys(target ?? {}).filter((k) => k !== "deadline" && typeof target[k] === "number");
  if (numericKeys.length === 0) return 0;
  const total = numericKeys.reduce((sum, key) => {
    const t = target[key] as number;
    const c = current?.[key] ?? 0;
    return sum + Math.min(1, t > 0 ? c / t : 0);
  }, 0);
  return Math.round((total / numericKeys.length) * 100);
}

export function computeBudgetProgress(
  budget: Record<string, number>,
  consumed: Record<string, number>,
): number {
  const keys = Object.keys(budget ?? {});
  if (keys.length === 0) return 0;
  const maxRatio = keys.reduce((max, key) => {
    const limit = budget[key] ?? 1;
    const used = consumed?.[key] ?? 0;
    return Math.max(max, limit > 0 ? used / limit : 0);
  }, 0);
  return Math.round(Math.min(100, maxRatio * 100));
}
