/**
 * MissionsPage — Agent Autopilot Missions
 * Lists, creates, and monitors autonomous agent missions with KPI tracking.
 */
import * as React from "react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { untypedFrom } from "@/lib/supabaseUntyped";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Plus, Play, Pause, Square, Rocket, Clock, Target, Zap, AlertTriangle } from "lucide-react";

interface AgentMission {
  id: string;
  agent_id: string;
  title: string;
  goal_description: string | null;
  goal_type: string;
  kpi_target: Record<string, number | string>;
  kpi_current: Record<string, number>;
  budget: Record<string, number>;
  budget_consumed: Record<string, number>;
  approval_only_for: string[];
  status: string;
  autopilot: boolean;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

interface MissionEvent {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-primary/20 text-primary",
  paused: "bg-accent text-accent-foreground",
  completed: "bg-primary/30 text-primary",
  failed: "bg-destructive/20 text-destructive",
  budget_exhausted: "bg-destructive/10 text-destructive",
};

const GOAL_TYPES = [
  { value: "get_replies", label: "Ottenere risposte" },
  { value: "book_meetings", label: "Prenotare meeting" },
  { value: "qualify_prospects", label: "Qualificare prospect" },
  { value: "custom", label: "Obiettivo custom" },
];

export function MissionsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedMission, setSelectedMission] = useState<string | null>(null);

  // Fetch missions
  const { data: missions = [], isLoading } = useQuery({
    queryKey: ["agent-missions"],
    queryFn: async () => {
      const { data, error } = await untypedFrom("agent_missions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AgentMission[];
    },
  });

  // Fetch events for selected mission
  const { data: events = [] } = useQuery({
    queryKey: ["agent-mission-events", selectedMission],
    queryFn: async () => {
      if (!selectedMission) return [];
      const { data, error } = await untypedFrom("agent_mission_events")
        .select("*")
        .eq("mission_id", selectedMission)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as MissionEvent[];
    },
    enabled: !!selectedMission,
  });

  // Status mutation
  const statusMut = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: Record<string, unknown> = { status };
      if (status === "active") updates.started_at = new Date().toISOString();
      const { error } = await untypedFrom("agent_missions").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent-missions"] });
      toast({ title: "Stato missione aggiornato" });
    },
  });

  // Create mission
  const createMut = useMutation({
    mutationFn: async (mission: Partial<AgentMission>) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await untypedFrom("agent_missions").insert({
        ...mission,
        owner_user_id: userData.user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent-missions"] });
      setWizardOpen(false);
      toast({ title: "Missione creata" });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Agent Missions</h1>
          <p className="text-muted-foreground">Missioni autonome con KPI e budget vincolato</p>
        </div>
        <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Nuova Missione</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Crea Missione Autopilot</DialogTitle>
            </DialogHeader>
            <MissionWizard onSubmit={(m) => createMut.mutate(m)} isLoading={createMut.isPending} />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Caricamento...</div>
      ) : missions.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <Rocket className="mx-auto mb-4 h-12 w-12 opacity-30" />
          <p>Nessuna missione. Crea la prima missione autopilot.</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {missions.map((m) => (
            <MissionCard
              key={m.id}
              mission={m}
              isSelected={m.id === selectedMission}
              onSelect={() => setSelectedMission(m.id === selectedMission ? null : m.id)}
              onStatusChange={(status) => statusMut.mutate({ id: m.id, status })}
            />
          ))}
        </div>
      )}

      {selectedMission && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4" /> Timeline Eventi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              {events.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nessun evento ancora.</p>
              ) : (
                <div className="space-y-2">
                  {events.map((e) => (
                    <div key={e.id} className="flex gap-3 text-sm border-l-2 border-muted pl-3 py-1">
                      <Badge variant="outline" className="shrink-0">{e.event_type}</Badge>
                      <span className="text-muted-foreground truncate">
                        {JSON.stringify(e.payload).substring(0, 120)}
                      </span>
                      <span className="ml-auto text-xs text-muted-foreground shrink-0">
                        {new Date(e.created_at).toLocaleTimeString("it-IT")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MissionCard({
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
  const budgetProgress = computeBudgetProgress(m.budget, m.budget_consumed);

  return (
    <Card
      className={`cursor-pointer transition-colors ${isSelected ? "ring-2 ring-primary" : ""}`}
      onClick={onSelect}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-base">{m.title}</CardTitle>
          <Badge className={STATUS_COLORS[m.status] ?? ""}>{m.status}</Badge>
        </div>
        {m.goal_description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{m.goal_description}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="flex items-center gap-1"><Target className="h-3 w-3" /> KPI</span>
            <span>{kpiProgress}%</span>
          </div>
          <Progress value={kpiProgress} className="h-2" />
        </div>
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="flex items-center gap-1"><Zap className="h-3 w-3" /> Budget</span>
            <span>{budgetProgress}%</span>
          </div>
          <Progress value={budgetProgress} className="h-2" />
          {budgetProgress > 80 && (
            <div className="flex items-center gap-1 text-xs text-destructive mt-1">
              <AlertTriangle className="h-3 w-3" /> Budget quasi esaurito
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 pt-1" onClick={(e) => e.stopPropagation()}>
          {m.status === "draft" && (
            <Button size="sm" variant="default" onClick={() => onStatusChange("active")}>
              <Play className="h-3 w-3 mr-1" /> Avvia
            </Button>
          )}
          {m.status === "active" && (
            <Button size="sm" variant="secondary" onClick={() => onStatusChange("paused")}>
              <Pause className="h-3 w-3 mr-1" /> Pausa
            </Button>
          )}
          {m.status === "paused" && (
            <Button size="sm" variant="default" onClick={() => onStatusChange("active")}>
              <Play className="h-3 w-3 mr-1" /> Riprendi
            </Button>
          )}
          {(m.status === "active" || m.status === "paused") && (
            <Button size="sm" variant="destructive" onClick={() => onStatusChange("failed")}>
              <Square className="h-3 w-3 mr-1" /> Stop
            </Button>
          )}
          {m.autopilot && (
            <Badge variant="outline" className="ml-auto text-xs">⚡ Autopilot</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function MissionWizard({
  onSubmit,
  isLoading,
}: {
  onSubmit: (m: Partial<AgentMission>) => void;
  isLoading: boolean;
}) {
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
      const { data } = await untypedFrom("ai_agents").select("id, name").limit(50);
      return data ?? [];
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

  return (
    <div className="space-y-4">
      <div>
        <Label>Titolo</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Es. 10 risposte positive in 7 giorni" />
      </div>
      <div>
        <Label>Tipo obiettivo</Label>
        <Select value={goalType} onValueChange={setGoalType}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {GOAL_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Descrizione obiettivo</Label>
        <Textarea value={goalDesc} onChange={(e) => setGoalDesc(e.target.value)} rows={2} />
      </div>
      <div>
        <Label>Agente</Label>
        <Select value={agentId} onValueChange={setAgentId}>
          <SelectTrigger><SelectValue placeholder="Seleziona agente" /></SelectTrigger>
          <SelectContent>
            {agents.map((a: Record<string, string>) => (
              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
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
      <Button onClick={handleSubmit} disabled={isLoading || !title} className="w-full">
        {isLoading ? "Creazione..." : "Crea Missione"}
      </Button>
    </div>
  );
}

function computeKpiProgress(
  target: Record<string, number | string>,
  current: Record<string, number>
): number {
  const numericKeys = Object.keys(target).filter((k) => k !== "deadline" && typeof target[k] === "number");
  if (numericKeys.length === 0) return 0;
  const total = numericKeys.reduce((sum, key) => {
    const t = target[key] as number;
    const c = current[key] ?? 0;
    return sum + Math.min(1, t > 0 ? c / t : 0);
  }, 0);
  return Math.round((total / numericKeys.length) * 100);
}

function computeBudgetProgress(
  budget: Record<string, number>,
  consumed: Record<string, number>
): number {
  const keys = Object.keys(budget);
  if (keys.length === 0) return 0;
  const maxRatio = keys.reduce((max, key) => {
    const limit = budget[key] ?? 1;
    const used = consumed[key] ?? 0;
    return Math.max(max, limit > 0 ? used / limit : 0);
  }, 0);
  return Math.round(Math.min(100, maxRatio * 100));
}
