/**
 * MissionsPage — Agent Autopilot Missions
 * Lists, creates, and monitors autonomous agent missions with KPI tracking.
 *
 * Presentazione allineata al contratto di pagina (docs/design/contratto-pagina.md)
 * e al prototipo di riferimento dell'archetipo Monitor/KPI
 * (docs/design/prototipo-missioni-autopilot.md):
 *   guscio StandardPageFrame · toolbar con filtri di stato · fascia KPI ·
 *   elenco righe a 5 informazioni · pannello di dettaglio a richiesta.
 * Query, mutation e calcoli KPI/budget sono invariati.
 */
import * as React from "react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  findAllAgentMissions,
  findAgentMissionEvents,
  updateAgentMissionFields,
  insertAgentMission,
  type AgentMissionRow,
} from "@/data/agentMissions";
import { findAgentOptions } from "@/data/agents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Plus, MoreHorizontal, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";
import { StandardPageFrame } from "@/v2/ui/templates/StandardPageFrame";
import { KpiStrip, type KpiItem } from "@/v2/ui/molecules/KpiStrip";
import { StatusDot, type StatusTone } from "@/v2/ui/molecules/StatusDot";

type AgentMission = AgentMissionRow;

/** Mappa stati → etichetta italiana + token semantico (contratto di pagina §4). */
const STATUS_META: Record<string, { label: string; tone: StatusTone }> = {
  draft: { label: "Bozza", tone: "muted" },
  active: { label: "Attiva", tone: "success" },
  paused: { label: "In pausa", tone: "warning" },
  completed: { label: "Conclusa", tone: "muted" },
  failed: { label: "Fallita", tone: "danger" },
  budget_exhausted: { label: "Budget esaurito", tone: "danger" },
};

function statusMeta(status: string): { label: string; tone: StatusTone } {
  return STATUS_META[status] ?? { label: status, tone: "muted" };
}

const GOAL_TYPES = [
  { value: "get_replies", label: "Ottenere risposte" },
  { value: "book_meetings", label: "Prenotare meeting" },
  { value: "qualify_prospects", label: "Qualificare prospect" },
  { value: "custom", label: "Obiettivo custom" },
];

const GOAL_TYPE_LABELS: Record<string, string> = Object.fromEntries(GOAL_TYPES.map((g) => [g.value, g.label]));

/** Etichette leggibili degli eventi di missione (fallback: chiave grezza). */
const EVENT_LABELS: Record<string, string> = {
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

type StatusFilter = "all" | "active" | "paused" | "done";

const STATUS_FILTERS: readonly { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Tutte" },
  { value: "active", label: "Attive" },
  { value: "paused", label: "In pausa" },
  { value: "done", label: "Concluse" },
];

export function MissionsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedMission, setSelectedMission] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Fetch missions
  const { data: missions = [], isLoading } = useQuery({
    queryKey: ["agent-missions"],
    queryFn: async () => {
      return findAllAgentMissions();
    },
  });

  // Fetch events for selected mission
  const { data: events = [] } = useQuery({
    queryKey: ["agent-mission-events", selectedMission],
    queryFn: async () => {
      if (!selectedMission) return [];
      return findAgentMissionEvents(selectedMission, 50);
    },
    enabled: !!selectedMission,
  });

  // Status mutation
  const statusMut = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      type MissionUpdate = Database["public"]["Tables"]["agent_missions"]["Update"];
      const updates: MissionUpdate = { status };
      if (status === "active") updates.started_at = new Date().toISOString();
      await updateAgentMissionFields(id, updates);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent-missions"] });
      toast({ title: "Stato missione aggiornato" });
    },
  });

  // Create mission
  const createMut = useMutation({
    mutationFn: async (mission: Partial<AgentMission>) => {
      const { data: userData } = await supabase.auth
        .getSession()
        .then((r) => ({ data: { user: r.data.session?.user ?? null } }));
      const ownerUserId = userData.user?.id;
      if (!ownerUserId) throw new Error("Sessione non valida: impossibile creare la missione");
      if (!mission.agent_id) throw new Error("Seleziona un agente per la missione");
      if (!mission.title) throw new Error("Titolo missione obbligatorio");
      await insertAgentMission({
        owner_user_id: ownerUserId,
        agent_id: mission.agent_id,
        title: mission.title,
        goal_type: mission.goal_type,
        goal_description: mission.goal_description,
        autopilot: mission.autopilot,
        status: mission.status,
        kpi_target: mission.kpi_target,
        kpi_current: mission.kpi_current,
        budget: mission.budget,
        budget_consumed: mission.budget_consumed,
        approval_only_for: mission.approval_only_for,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent-missions"] });
      setWizardOpen(false);
      toast({ title: "Missione creata" });
    },
  });

  const visibleMissions = React.useMemo(() => {
    if (statusFilter === "all") return missions;
    if (statusFilter === "active") return missions.filter((m) => m.status === "active");
    if (statusFilter === "paused") return missions.filter((m) => m.status === "paused");
    return missions.filter((m) => ["completed", "failed", "budget_exhausted"].includes(m.status));
  }, [missions, statusFilter]);

  const kpis = React.useMemo<readonly KpiItem[]>(() => {
    const active = missions.filter((m) => m.status === "active").length;
    const paused = missions.filter((m) => m.status === "paused").length;
    const avg = (values: number[]) =>
      values.length === 0 ? 0 : Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    const goal = avg(missions.map((m) => computeKpiProgress(m.kpi_target, m.kpi_current)));
    const budget = avg(missions.map((m) => computeBudgetProgress(m.budget, m.budget_consumed)));
    return [
      { label: "attive", value: active },
      { label: "in pausa", value: paused },
      { label: "obiettivo medio", value: `${goal}%` },
      { label: "budget medio", value: `${budget}%`, tone: budget >= 80 ? "warning" : "neutral" },
    ];
  }, [missions]);

  const selected = missions.find((m) => m.id === selectedMission) ?? null;

  return (
    <StandardPageFrame
      actions={
        <Button size="sm" onClick={() => setWizardOpen(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Nuova missione
        </Button>
      }
    >
      {/* Toolbar contestuale: filtri di stato + conteggio */}
      <div className="h-9 flex items-center justify-between gap-3 px-4 border-b border-border/40 bg-card/40 shrink-0">
        <div className="flex items-center gap-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                "h-6 rounded-md px-2.5 text-[11px] font-medium transition-colors",
                statusFilter === f.value
                  ? "bg-primary/12 text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-muted-foreground">
          {visibleMissions.length} {visibleMissions.length === 1 ? "missione" : "missioni"}
        </span>
      </div>

      <div className="p-4 space-y-3">
        <KpiStrip items={kpis} />

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* Elenco missioni */}
          <section className="rounded-lg border border-border bg-card">
            <header className="px-4 py-2.5 border-b border-border/60">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Missioni</h2>
            </header>
            {isLoading ? (
              <div className="p-4 space-y-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-10 rounded-md bg-muted/30 animate-pulse" />
                ))}
              </div>
            ) : visibleMissions.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <Rocket className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm font-medium text-foreground">Nessuna missione</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {statusFilter === "all"
                    ? "Crea la prima missione autopilot."
                    : "Nessuna missione con questo stato."}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border/60">
                {visibleMissions.map((m) => (
                  <MissionRow
                    key={m.id}
                    mission={m}
                    isSelected={m.id === selectedMission}
                    onSelect={() => setSelectedMission(m.id === selectedMission ? null : m.id)}
                    onStatusChange={(status) => statusMut.mutate({ id: m.id, status })}
                  />
                ))}
              </ul>
            )}
          </section>

          {/* Pannello di dettaglio (livello 2) */}
          <MissionDetailPanel mission={selected} events={events} />
        </div>
      </div>

      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Crea missione autopilot</DialogTitle>
          </DialogHeader>
          <MissionWizard onSubmit={(m) => createMut.mutate(m)} isLoading={createMut.isPending} />
        </DialogContent>
      </Dialog>
    </StandardPageFrame>
  );
}

/** Riga di missione — 5 informazioni di livello 1. */
function MissionRow({
  mission: m,
  isSelected,
  onSelect,
  onStatusChange,
}: {
  mission: AgentMission;
  isSelected: boolean;
  onSelect: () => void;
  onStatusChange: (status: string) => void;
}) {
  const kpiProgress = computeKpiProgress(m.kpi_target, m.kpi_current);
  const meta = statusMeta(m.status);

  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect();
          }
        }}
        className={cn(
          "flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors hover:bg-muted/30",
          isSelected && "bg-muted/40",
        )}
      >
        <StatusDot tone={meta.tone} label={meta.label} />
        <span className="text-sm font-medium text-foreground truncate flex-1 min-w-0">{m.title}</span>

        <div className="hidden sm:flex items-center gap-2 w-32 shrink-0">
          <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-foreground/60" style={{ width: `${kpiProgress}%` }} />
          </div>
          <span className="text-[11px] text-muted-foreground tabular-nums w-8 text-right">{kpiProgress}%</span>
        </div>

        <span className="text-[11px] text-muted-foreground w-20 shrink-0 hidden md:block">{meta.label}</span>

        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Azioni missione ${m.title}`}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {m.status === "draft" && (
                <DropdownMenuItem onClick={() => onStatusChange("active")}>Avvia</DropdownMenuItem>
              )}
              {m.status === "active" && (
                <DropdownMenuItem onClick={() => onStatusChange("paused")}>Pausa</DropdownMenuItem>
              )}
              {m.status === "paused" && (
                <DropdownMenuItem onClick={() => onStatusChange("active")}>Riprendi</DropdownMenuItem>
              )}
              {(m.status === "active" || m.status === "paused") && (
                <DropdownMenuItem onClick={() => onStatusChange("failed")}>Stop</DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={onSelect}>
                {isSelected ? "Chiudi dettaglio" : "Apri dettaglio"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </li>
  );
}

type MissionEvent = { id: string; event_type: string; payload: unknown; created_at: string };

function MissionDetailPanel({
  mission,
  events,
}: {
  mission: AgentMission | null;
  events: readonly MissionEvent[];
}) {
  if (!mission) {
    return (
      <aside className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dettaglio</h2>
        <p className="mt-3 text-[11px] text-muted-foreground">Seleziona una missione per vederne obiettivo, budget ed eventi.</p>
      </aside>
    );
  }

  const kpiProgress = computeKpiProgress(mission.kpi_target, mission.kpi_current);
  const budgetProgress = computeBudgetProgress(mission.budget, mission.budget_consumed);
  const meta = statusMeta(mission.status);
  const budgetBar =
    budgetProgress >= 100 ? "bg-destructive" : budgetProgress > 80 ? "bg-warning" : "bg-foreground/60";

  return (
    <aside className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dettaglio</h2>
        <div className="mt-2 flex items-center gap-2">
          <StatusDot tone={meta.tone} label={meta.label} />
          <span className="text-sm font-medium text-foreground">{mission.title}</span>
        </div>
        {mission.goal_description && (
          <p className="mt-1.5 text-[11px] text-muted-foreground">{mission.goal_description}</p>
        )}
      </div>

      <dl className="space-y-2">
        <div className="flex items-center justify-between">
          <dt className="text-[11px] text-muted-foreground">Tipo obiettivo</dt>
          <dd className="text-sm font-medium text-foreground">
            {GOAL_TYPE_LABELS[mission.goal_type] ?? mission.goal_type}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-[11px] text-muted-foreground">Stato</dt>
          <dd className="text-sm font-medium text-foreground">{meta.label}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-[11px] text-muted-foreground">Autopilot</dt>
          <dd className="text-sm font-medium text-foreground">{mission.autopilot ? "Attivo" : "Disattivo"}</dd>
        </div>
      </dl>

      <div className="space-y-2">
        <ProgressLine label="Obiettivo" value={kpiProgress} barClass="bg-foreground/60" />
        <ProgressLine label="Budget" value={budgetProgress} barClass={budgetBar} />
      </div>

      <KeyValueList title="Obiettivo per chiave" target={mission.kpi_target} current={mission.kpi_current} />
      <KeyValueList title="Budget per chiave" target={mission.budget} current={mission.budget_consumed} />

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Eventi</h3>
        <ScrollArea className="mt-2 h-48">
          {events.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">Nessun evento ancora.</p>
          ) : (
            <ul className="space-y-1.5 pr-2">
              {events.map((e) => (
                <li key={e.id} className="text-[11px]">
                  <div className="flex items-baseline gap-2">
                    <span className="text-muted-foreground/80 tabular-nums shrink-0">
                      {new Date(e.created_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className="text-foreground">{EVENT_LABELS[e.event_type] ?? e.event_type}</span>
                  </div>
                  <details className="mt-0.5">
                    <summary className="cursor-pointer text-muted-foreground/80 hover:text-foreground">
                      Mostra dati tecnici
                    </summary>
                    <pre className="mt-1 whitespace-pre-wrap break-all text-muted-foreground/80">
                      {JSON.stringify(e.payload, null, 2)}
                    </pre>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </div>
    </aside>
  );
}

function ProgressLine({ label, value, barClass }: { label: string; value: number; barClass: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
        <span>{label}</span>
        <span className="tabular-nums">{value}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
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
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <dl className="mt-1.5 space-y-1">
        {keys.map((k) => (
          <div key={k} className="flex items-center justify-between">
            <dt className="text-[11px] text-muted-foreground">{k}</dt>
            <dd className="text-sm font-medium text-foreground tabular-nums">
              {current?.[k] ?? 0} / {String(target?.[k] ?? "—")}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Wizard a 3 passi — stessi campi, stessa submit. */
function MissionWizard({ onSubmit, isLoading }: { onSubmit: (m: Partial<AgentMission>) => void; isLoading: boolean }) {
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [goalType, setGoalType] = useState("get_replies");
  const [goalDesc, setGoalDesc] = useState("");
  const [kpiReplies, setKpiReplies] = useState("10");
  const [kpiPositive, setKpiPositive] = useState("3");
  const [budgetActions, setBudgetActions] = useState("100");
  const [budgetEmails, setBudgetEmails] = useState("50");
  const [budgetTokens, setBudgetTokens] = useState("50000");
  const [autopilot, setAutopilot] = useState(true);
  const [agentId, setAgentId] = useState("");

  const { data: agents = [] } = useQuery({
    queryKey: ["agents-for-mission"],
    queryFn: async () => {
      return await findAgentOptions(50);
    },
  });

  const handleSubmit = () => {
    onSubmit({
      agent_id: agentId || agents[0]?.id,
      title,
      goal_description: goalDesc,
      goal_type: goalType,
      kpi_target: {
        replies: Number(kpiReplies),
        positive_replies: Number(kpiPositive),
      },
      budget: {
        max_actions: Number(budgetActions),
        max_emails_sent: Number(budgetEmails),
        max_tokens: Number(budgetTokens),
      },
      autopilot,
      approval_only_for: ["send_email", "send_whatsapp"],
    });
  };

  const steps = ["Obiettivo", "Agente e target", "Budget e autopilot"];

  return (
    <div className="space-y-4">
      <ol className="flex items-center gap-1">
        {steps.map((s, i) => (
          <li key={s} className="flex-1">
            <button
              type="button"
              onClick={() => setStep(i)}
              className={cn(
                "w-full rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                i === step ? "bg-primary/12 text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {i + 1}. {s}
            </button>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="space-y-3">
          <div>
            <Label>Titolo</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Es. 10 risposte positive in 7 giorni"
            />
          </div>
          <div>
            <Label>Tipo obiettivo</Label>
            <Select value={goalType} onValueChange={setGoalType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GOAL_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Descrizione obiettivo</Label>
            <Textarea value={goalDesc} onChange={(e) => setGoalDesc(e.target.value)} rows={2} />
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-3">
          <div>
            <Label>Agente</Label>
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona agente" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Target risposte</Label>
              <Input type="number" value={kpiReplies} onChange={(e) => setKpiReplies(e.target.value)} />
            </div>
            <div>
              <Label>Target positive</Label>
              <Input type="number" value={kpiPositive} onChange={(e) => setKpiPositive(e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Max azioni</Label>
              <Input type="number" value={budgetActions} onChange={(e) => setBudgetActions(e.target.value)} />
            </div>
            <div>
              <Label>Max email</Label>
              <Input type="number" value={budgetEmails} onChange={(e) => setBudgetEmails(e.target.value)} />
            </div>
            <div>
              <Label>Max token</Label>
              <Input type="number" value={budgetTokens} onChange={(e) => setBudgetTokens(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={autopilot} onCheckedChange={setAutopilot} />
            <Label>Modalità Autopilot</Label>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
          Indietro
        </Button>
        {step < 2 ? (
          <Button size="sm" onClick={() => setStep((s) => Math.min(2, s + 1))}>
            Avanti
          </Button>
        ) : (
          <Button size="sm" onClick={handleSubmit} disabled={isLoading || !title}>
            {isLoading ? "Creazione..." : "Crea missione"}
          </Button>
        )}
      </div>
    </div>
  );
}

function computeKpiProgress(target: Record<string, number | string>, current: Record<string, number>): number {
  const numericKeys = Object.keys(target ?? {}).filter((k) => k !== "deadline" && typeof target[k] === "number");
  if (numericKeys.length === 0) return 0;
  const total = numericKeys.reduce((sum, key) => {
    const t = target[key] as number;
    const c = current?.[key] ?? 0;
    return sum + Math.min(1, t > 0 ? c / t : 0);
  }, 0);
  return Math.round((total / numericKeys.length) * 100);
}

function computeBudgetProgress(budget: Record<string, number>, consumed: Record<string, number>): number {
  const keys = Object.keys(budget ?? {});
  if (keys.length === 0) return 0;
  const maxRatio = keys.reduce((max, key) => {
    const limit = budget[key] ?? 1;
    const used = consumed?.[key] ?? 0;
    return Math.max(max, limit > 0 ? used / limit : 0);
  }, 0);
  return Math.round(Math.min(100, maxRatio * 100));
}
