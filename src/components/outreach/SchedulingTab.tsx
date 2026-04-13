/**
 * SchedulingTab — Template library, active schedules, and scheduling wizard
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Library, Activity, Rocket, Copy, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { fetchTimingTemplates, duplicateTimingTemplate, deleteTimingTemplate } from "@/data/outreachTimingTemplates";
import { SequenceVisualizer } from "./scheduling/SequenceVisualizer";
import { TemplateBuilderDialog } from "./scheduling/TemplateBuilderDialog";
import { SchedulingWizard } from "./scheduling/SchedulingWizard";
import { supabase } from "@/integrations/supabase/client";

const GOAL_COLORS: Record<string, string> = {
  primo_contatto: "bg-primary/15 text-primary",
  follow_up: "bg-emerald-500/15 text-emerald-500",
  nurturing: "bg-blue-500/15 text-blue-400",
  reactivation: "bg-amber-500/15 text-amber-500",
  event_followup: "bg-purple-500/15 text-purple-400",
  partnership_proposal: "bg-rose-500/15 text-rose-400",
  info_request: "bg-cyan-500/15 text-cyan-400",
};

const GOAL_LABELS: Record<string, string> = {
  primo_contatto: "Primo Contatto",
  follow_up: "Follow-Up",
  nurturing: "Nurturing",
  reactivation: "Riattivazione",
  event_followup: "Evento",
  partnership_proposal: "Partnership",
  info_request: "Info Request",
};

const SOURCE_LABELS: Record<string, string> = {
  wca_partners: "WCA",
  contacts: "Contatti",
  business_cards: "BCA",
  mixed: "Misto",
};

export function SchedulingTab() {
  const qc = useQueryClient();
  const [section, setSection] = useState("templates");
  const [builderOpen, setBuilderOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["timing-templates"],
    queryFn: fetchTimingTemplates,
  });

  // Active schedules (mission_actions with cadence_rule)
  const { data: activeSchedules = [] } = useQuery({
    queryKey: ["active-schedules"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase
        .from("mission_actions")
        .select("*")
        .eq("user_id", user.id)
        .not("cadence_rule", "is", null)
        .in("status", ["planned", "approved", "executing"])
        .order("scheduled_at", { ascending: true })
        .limit(50);
      return data ?? [];
    },
  });

  const handleDuplicate = async (id: string) => {
    try {
      await duplicateTimingTemplate(id);
      qc.invalidateQueries({ queryKey: ["timing-templates"] });
      toast.success("Template duplicato");
    } catch { toast.error("Errore duplicazione"); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Eliminare questo template?")) return;
    try {
      await deleteTimingTemplate(id);
      qc.invalidateQueries({ queryKey: ["timing-templates"] });
      toast.success("Template eliminato");
    } catch { toast.error("Errore eliminazione"); }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-4 py-2 border-b border-border/30 flex items-center gap-2">
        <Tabs value={section} onValueChange={setSection}>
          <TabsList className="bg-muted/40 h-8">
            <TabsTrigger value="templates" className="gap-1.5 text-xs h-7">
              <Library className="w-3 h-3" /> Template
            </TabsTrigger>
            <TabsTrigger value="active" className="gap-1.5 text-xs h-7">
              <Activity className="w-3 h-3" /> Attive
              {activeSchedules.length > 0 && (
                <Badge className="text-[8px] h-3.5 px-1 ml-1 bg-primary/15 text-primary">{activeSchedules.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="ml-auto flex items-center gap-1.5">
          <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={() => setBuilderOpen(true)}>
            <Plus className="w-3 h-3" /> Nuovo Template
          </Button>
          <Button size="sm" className="h-7 text-[11px] gap-1" onClick={() => setWizardOpen(true)}>
            <Rocket className="w-3 h-3" /> Avvia Programmazione
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        {section === "templates" && (
          isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="p-3 grid grid-cols-2 gap-2.5">
              {templates.map((tpl) => (
                <div key={tpl.id} className="p-3 rounded-lg border border-border/30 bg-card/40 hover:bg-card/60 transition-colors space-y-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium flex-1 truncate">{tpl.template_name}</span>
                    {tpl.is_system ? (
                      <Badge className="text-[7px] h-3.5 px-1 bg-muted text-muted-foreground">Sistema</Badge>
                    ) : (
                      <Badge className="text-[7px] h-3.5 px-1 bg-primary/15 text-primary">Custom</Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className={cn("text-[8px] px-1.5 py-0.5 rounded-full font-medium", GOAL_COLORS[tpl.goal] || "bg-muted text-muted-foreground")}>
                      {GOAL_LABELS[tpl.goal] || tpl.goal}
                    </span>
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground font-medium">
                      {SOURCE_LABELS[tpl.source_type] || tpl.source_type}
                    </span>
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {tpl.sequence.length} step · {tpl.total_duration_days}g
                    </span>
                  </div>

                  <SequenceVisualizer steps={tpl.sequence} compact />

                  {tpl.description && (
                    <p className="text-[10px] text-muted-foreground line-clamp-2">{tpl.description}</p>
                  )}

                  <div className="flex items-center gap-1 pt-1">
                    <Button size="sm" className="h-5 text-[9px] gap-1 px-2" onClick={() => setWizardOpen(true)}>
                      <Rocket className="w-2.5 h-2.5" /> Usa
                    </Button>
                    <Button size="sm" variant="outline" className="h-5 text-[9px] gap-1 px-2" onClick={() => handleDuplicate(tpl.id)}>
                      <Copy className="w-2.5 h-2.5" /> Duplica
                    </Button>
                    {!tpl.is_system && (
                      <Button size="sm" variant="ghost" className="h-5 text-[9px] gap-1 px-2 text-destructive" onClick={() => handleDelete(tpl.id)}>
                        <Trash2 className="w-2.5 h-2.5" /> Elimina
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {section === "active" && (
          activeSchedules.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Nessuna sequenza attiva. Usa "Avvia Programmazione" per iniziare.
            </div>
          ) : (
            <div className="p-3 space-y-2">
              {activeSchedules.map((action) => {
                const cadence = (action.cadence_rule as Record<string, unknown>[]) || [];
                const currentStep = cadence.findIndex((s) => s.step === (action.position ?? 1)) + 1;

                return (
                  <div key={action.id} className="p-2.5 rounded-lg border border-border/20 bg-card/40 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Activity className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium block truncate">{action.action_label || "Sequenza cadence"}</span>
                      <span className="text-[10px] text-muted-foreground">
                        Step {currentStep} di {cadence.length} · {action.status}
                      </span>
                    </div>
                    {action.scheduled_at && (
                      <Badge variant="outline" className="text-[10px] h-5 shrink-0">
                        {new Date(action.scheduled_at).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}
      </ScrollArea>

      <TemplateBuilderDialog open={builderOpen} onOpenChange={setBuilderOpen} />
      <SchedulingWizard open={wizardOpen} onOpenChange={setWizardOpen} templates={templates} />
    </div>
  );
}
