/**
 * MissionContextRail — rail DESTRO: parametri della missione aperta e
 * azioni di stato. Sostituisce il menu "…" di riga (una sola sede azioni).
 */
import * as React from "react";
import { Play, Pause, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  GOAL_TYPE_LABELS,
  computeBudgetProgress,
  computeKpiProgress,
  statusMeta,
} from "./missionMeta";
import type { AgentMissionRow } from "@/data/agentMissions";

function ProgressLine({ label, value, barClass }: { label: string; value: number; barClass: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums">{value}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", barClass)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function KeyValueList({
  title,
  target,
  current,
}: {
  title: string;
  target: Record<string, number | string> | null | undefined;
  current: Record<string, number> | null | undefined;
}) {
  const keys = Object.keys(target ?? {});
  if (keys.length === 0) return null;
  return (
    <div>
      <h3 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <dl className="mt-1.5 space-y-1">
        {keys.map((k) => (
          <div key={k} className="flex items-center justify-between gap-2">
            <dt className="truncate text-[11px] text-muted-foreground">{k}</dt>
            <dd className="shrink-0 text-xs font-medium tabular-nums text-foreground">
              {current?.[k] ?? 0} / {String(target?.[k] ?? "—")}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export interface MissionContextRailProps {
  readonly mission: AgentMissionRow | null;
  readonly onStatusChange: (status: string) => void;
}

export function MissionContextRail({ mission, onStatusChange }: MissionContextRailProps): React.ReactElement {
  if (!mission) {
    return (
      <aside className="flex h-full flex-col bg-card/40 p-4">
        <p className="text-[11px] text-muted-foreground">
          Seleziona una missione per vederne parametri e azioni.
        </p>
      </aside>
    );
  }

  const meta = statusMeta(mission.status);
  const kpiProgress = computeKpiProgress(mission.kpi_target, mission.kpi_current);
  const budgetProgress = computeBudgetProgress(mission.budget, mission.budget_consumed);
  const budgetBar =
    budgetProgress >= 100 ? "bg-destructive" : budgetProgress > 80 ? "bg-warning" : "bg-foreground/60";

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-y-auto bg-card/40 p-4">
      <div className="space-y-4">
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Contesto</h3>
          <dl className="mt-2 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-[11px] text-muted-foreground">Obiettivo</dt>
              <dd className="truncate text-xs font-medium text-foreground">
                {GOAL_TYPE_LABELS[mission.goal_type] ?? mission.goal_type}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-[11px] text-muted-foreground">Stato</dt>
              <dd className="text-xs font-medium text-foreground">{meta.label}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-[11px] text-muted-foreground">Autopilot</dt>
              <dd className="text-xs font-medium text-foreground">{mission.autopilot ? "Attivo" : "Disattivo"}</dd>
            </div>
          </dl>
        </div>

        <div className="space-y-2">
          <ProgressLine label="Avanzamento" value={kpiProgress} barClass="bg-foreground/60" />
          <ProgressLine label="Budget" value={budgetProgress} barClass={budgetBar} />
        </div>

        <KeyValueList title="Target" target={mission.kpi_target} current={mission.kpi_current} />
        <KeyValueList title="Budget" target={mission.budget} current={mission.budget_consumed} />

        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Azioni</h3>
          <div className="mt-2 flex flex-col gap-1.5">
            {(mission.status === "draft" || mission.status === "paused") && (
              <Button size="sm" variant="outline" className="justify-start" onClick={() => onStatusChange("active")}>
                <Play className="mr-2 h-3.5 w-3.5" />
                {mission.status === "draft" ? "Avvia" : "Riprendi"}
              </Button>
            )}
            {mission.status === "active" && (
              <Button size="sm" variant="outline" className="justify-start" onClick={() => onStatusChange("paused")}>
                <Pause className="mr-2 h-3.5 w-3.5" /> Metti in pausa
              </Button>
            )}
            {(mission.status === "active" || mission.status === "paused") && (
              <Button size="sm" variant="outline" className="justify-start" onClick={() => onStatusChange("failed")}>
                <Square className="mr-2 h-3.5 w-3.5" /> Termina
              </Button>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

export default MissionContextRail;
