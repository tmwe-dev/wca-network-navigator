/**
 * PromptLabHealthBanner — KPI a colpo d'occhio del Prompt Lab.
 * Read-only. Mostra: prompt attivi/duplicati, personas thin, test runner status,
 * proposte pending, refiner status, KB doctrine.
 * Semafori verde/giallo/rosso in base a soglie definite localmente.
 */
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Activity,
  Copy,
  UserCircle2,
  TestTube2,
  Inbox,
  Sparkles,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchPromptLabHealth, type PromptLabHealth } from "@/data/promptLabHealth";
import { queryKeys } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";

type Level = "ok" | "warn" | "alert";

function lvlClass(l: Level): string {
  if (l === "ok") return "text-emerald-600 dark:text-emerald-400";
  if (l === "warn") return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
}
function lvlDot(l: Level): string {
  if (l === "ok") return "bg-emerald-500";
  if (l === "warn") return "bg-amber-500";
  return "bg-rose-500";
}

function gradeTestRuns(h: PromptLabHealth): { level: Level; label: string } {
  if (h.testRuns7d === 0) return { level: "alert", label: "0 run / 7g" };
  const passRate = h.testRuns7d > 0 ? h.testPassed7d / h.testRuns7d : 0;
  if (passRate >= 0.95) return { level: "ok", label: `${Math.round(passRate * 100)}% pass` };
  if (passRate >= 0.85) return { level: "warn", label: `${Math.round(passRate * 100)}% pass` };
  return { level: "alert", label: `${Math.round(passRate * 100)}% pass` };
}

function gradeDuplicates(h: PromptLabHealth): { level: Level; label: string } {
  if (h.duplicateGroups === 0) return { level: "ok", label: "0 dup" };
  if (h.duplicateGroups <= 5) return { level: "warn", label: `${h.duplicateGroups} dup` };
  return { level: "alert", label: `${h.duplicateGroups} dup` };
}

function gradePersonas(h: PromptLabHealth): { level: Level; label: string } {
  if (h.personasThin === 0) return { level: "ok", label: "complete" };
  if (h.personasThin <= 2) return { level: "warn", label: `${h.personasThin} thin` };
  return { level: "alert", label: `${h.personasThin}/${h.personasTotal} thin` };
}

interface KpiProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  hint: string;
  level: Level;
}

function Kpi({ icon: Icon, label, value, hint, level }: KpiProps) {
  return (
    <div
      className="flex items-center gap-2.5 px-3 py-2 rounded-md border bg-card/50 min-w-0 flex-1"
      title={hint}
    >
      <Icon className={cn("h-4 w-4 flex-shrink-0", lvlClass(level))} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", lvlDot(level))} />
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">
            {label}
          </span>
        </div>
        <div className="text-sm font-semibold leading-tight truncate">{value}</div>
      </div>
    </div>
  );
}

export function PromptLabHealthBanner() {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.promptLabHealth,
    queryFn: fetchPromptLabHealth,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <div className="px-3 py-2 border-b bg-muted/30 text-xs text-muted-foreground flex items-center gap-2">
        <Activity className="h-3.5 w-3.5 animate-pulse" />
        Caricamento KPI Prompt Lab…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="px-3 py-2 border-b bg-muted/30 text-xs text-muted-foreground flex items-center gap-2">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
        KPI non disponibili (vista Health in costruzione)
      </div>
    );
  }

  const tests = gradeTestRuns(data);
  const dups = gradeDuplicates(data);
  const personas = gradePersonas(data);
  const refinerLevel: Level = data.cronRefiner ? "ok" : "warn";
  const copilotLevel: Level = data.copilotPending === 0 ? "ok" : data.copilotPending <= 5 ? "warn" : "alert";

  const anyAlert =
    tests.level === "alert" ||
    dups.level === "alert" ||
    personas.level === "alert" ||
    !data.cronTestRunner;

  return (
    <Card className="rounded-none border-x-0 border-t-0 border-b bg-muted/20 px-2 py-1.5">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-2 py-1 flex-shrink-0">
          {anyAlert ? (
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          )}
          <span className="text-xs font-semibold">Health</span>
          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
            P0
          </Badge>
        </div>
        <div className="flex items-center gap-2 flex-1 overflow-x-auto">
          <Kpi
            icon={Activity}
            label="Prompt attivi"
            value={`${data.promptsActive} / ${data.promptsDistinctNames}`}
            hint={`${data.promptsActive} righe attive su ${data.promptsDistinctNames} nomi distinti`}
            level={data.promptsActive > 0 ? "ok" : "alert"}
          />
          <Kpi
            icon={Copy}
            label="Duplicati"
            value={dups.label}
            hint={`${data.duplicateGroups} gruppi (${data.duplicateExtraRows} righe extra). Da analizzare prima di dedup.`}
            level={dups.level}
          />
          <Kpi
            icon={UserCircle2}
            label="Personas"
            value={personas.label}
            hint={`${data.personasTotal - data.personasThin}/${data.personasTotal} ≥ 300 char`}
            level={personas.level}
          />
          <Kpi
            icon={TestTube2}
            label="Test runner"
            value={tests.label}
            hint={`Run 7g: ${data.testRuns7d}, 30g: ${data.testRuns30d}. Cron ${data.cronTestRunner ? "attivo" : "NON attivo"}.`}
            level={tests.level}
          />
          <Kpi
            icon={Inbox}
            label="Proposte copilot"
            value={data.copilotPending}
            hint={`Proposte pending in /v2/prompt-lab/proposals`}
            level={copilotLevel}
          />
          <Kpi
            icon={Sparkles}
            label="Refiner"
            value={data.cronRefiner ? `${data.refinerPending} pending` : "OFF"}
            hint={
              data.cronRefiner
                ? `Cron settimanale attivo. ${data.refinerPending} proposte pending.`
                : "agent-prompt-refiner non schedulato. Loop automatico inattivo."
            }
            level={refinerLevel}
          />
        </div>
      </div>
    </Card>
  );
}
