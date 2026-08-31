/**
 * MissionsPage — Agent Autopilot Missions.
 *
 * Maschera OPERATIVA (non cruscotto), secondo il piano
 * "Missioni Autopilot — maschera operativa, non cruscotto":
 *   rail SX = elenco missioni + ricerca · centro = missione, prompt, thread
 *   agente e canvas · rail DX = parametri e azioni · riepiloghi dietro
 *   l'icona 📊 nell'header.
 *
 * Query, mutation, calcoli KPI/budget e wizard di creazione sono invariati.
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
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { PanelLeft, PanelRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { StandardPageFrame } from "@/v2/ui/templates/StandardPageFrame";
import { MissionRail } from "./missions/MissionRail";
import { MissionWorkspace } from "./missions/MissionWorkspace";
import { MissionContextRail } from "./missions/MissionContextRail";
import { MissionSummaryPopover } from "./missions/MissionSummaryPopover";
import { GOAL_TYPES } from "./missions/missionMeta";
import { useMissionWorkspaceChat } from "@/v2/hooks/useMissionWorkspaceChat";

type AgentMission = AgentMissionRow;

export function MissionsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedMission, setSelectedMission] = useState<string | null>(null);
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [goalDraft, setGoalDraft] = useState("");

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

  // Prompt/obiettivo della missione
  const goalMut = useMutation({
    mutationFn: async ({ id, goal }: { id: string; goal: string }) => {
      await updateAgentMissionFields(id, { goal_description: goal });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent-missions"] });
      toast({ title: "Prompt della missione aggiornato" });
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

  const selected = missions.find((m) => m.id === selectedMission) ?? null;

  // Allinea la bozza del prompt alla missione aperta.
  React.useEffect(() => {
    setGoalDraft(selected?.goal_description ?? "");
  }, [selected?.id, selected?.goal_description]);

  const chat = useMissionWorkspaceChat();

  const handleSelect = (id: string) => {
    setSelectedMission(id);
    setLeftOpen(false);
  };

  const rail = (
    <MissionRail
      missions={missions}
      isLoading={isLoading}
      selectedId={selectedMission}
      onSelect={handleSelect}
      onCreate={() => setWizardOpen(true)}
    />
  );

  const contextRail = (
    <MissionContextRail
      mission={selected}
      onStatusChange={(status) => selected && statusMut.mutate({ id: selected.id, status })}
    />
  );

  const workspace = (
    <MissionWorkspace
      mission={selected}
      events={events}
      messages={chat.messagesFor(selectedMission)}
      isSending={chat.isSending}
      onSend={(text) => {
        if (!selected) return;
        void chat.send(
          {
            id: selected.id,
            title: selected.title,
            goalType: selected.goal_type,
            goalDescription: selected.goal_description ?? null,
            status: selected.status,
          },
          text,
        );
      }}
      goalDraft={goalDraft}
      onGoalDraftChange={setGoalDraft}
      onGoalSave={() => selected && goalMut.mutate({ id: selected.id, goal: goalDraft })}
      isSavingGoal={goalMut.isPending}
      onCreate={() => setWizardOpen(true)}
    />
  );

  return (
    <StandardPageFrame
      contentOverflow="contain"
      actions={
        <>
          <MissionSummaryPopover missions={missions} />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 lg:hidden"
            aria-label="Elenco missioni"
            onClick={() => setLeftOpen(true)}
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 lg:hidden"
            aria-label="Contesto missione"
            onClick={() => setRightOpen(true)}
          >
            <PanelRight className="h-4 w-4" />
          </Button>
        </>
      }
    >
      <div className="flex h-full min-h-0">
        {/* Rail sinistro (desktop) */}
        <div className="hidden w-64 shrink-0 border-r border-border/40 lg:block">{rail}</div>

        {/* Centro */}
        <div className={cn("min-w-0 flex-1")}>{workspace}</div>

        {/* Rail destro (desktop) */}
        <div className="hidden w-64 shrink-0 border-l border-border/40 xl:block">{contextRail}</div>
      </div>

      {/* Drawer mobile/tablet */}
      <Sheet open={leftOpen} onOpenChange={setLeftOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Elenco missioni</SheetTitle>
          {rail}
        </SheetContent>
      </Sheet>
      <Sheet open={rightOpen} onOpenChange={setRightOpen}>
        <SheetContent side="right" className="w-72 p-0">
          <SheetTitle className="sr-only">Contesto missione</SheetTitle>
          {contextRail}
        </SheetContent>
      </Sheet>

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
