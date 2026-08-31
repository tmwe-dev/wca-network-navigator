/**
 * MissionSummaryPopover — i riepiloghi NON stanno nella maschera operativa:
 * vivono dietro questa icona. Stessi calcoli KPI/budget di prima.
 */
import * as React from "react";
import { BarChart3 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { computeBudgetProgress, computeKpiProgress } from "./missionMeta";
import type { AgentMissionRow } from "@/data/agentMissions";

export interface MissionSummaryPopoverProps {
  readonly missions: readonly AgentMissionRow[];
}

export function MissionSummaryPopover({ missions }: MissionSummaryPopoverProps): React.ReactElement {
  const rows = React.useMemo(() => {
    const count = (s: string) => missions.filter((m) => m.status === s).length;
    const avg = (values: number[]) =>
      values.length === 0 ? 0 : Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    const goal = avg(missions.map((m) => computeKpiProgress(m.kpi_target, m.kpi_current)));
    const budget = avg(missions.map((m) => computeBudgetProgress(m.budget, m.budget_consumed)));
    return [
      { label: "Attive", value: String(count("active")) },
      { label: "In pausa", value: String(count("paused")) },
      {
        label: "Concluse",
        value: String(
          missions.filter((m) => ["completed", "failed", "budget_exhausted"].includes(m.status)).length,
        ),
      },
      { label: "Obiettivo medio", value: `${goal}%` },
      { label: "Budget medio", value: `${budget}%` },
      { label: "Totale", value: String(missions.length) },
    ];
  }, [missions]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-muted/40 text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
          aria-label="Riepilogo missioni"
          title="Riepilogo missioni"
        >
          <BarChart3 className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <h3 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Riepilogo missioni
        </h3>
        <dl className="mt-2 space-y-1.5">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-2">
              <dt className="text-[11px] text-muted-foreground">{r.label}</dt>
              <dd className="text-xs font-medium tabular-nums text-foreground">{r.value}</dd>
            </div>
          ))}
        </dl>
      </PopoverContent>
    </Popover>
  );
}

export default MissionSummaryPopover;
