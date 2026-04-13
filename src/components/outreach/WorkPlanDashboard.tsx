import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  RefreshCw, Play, Eye, X, Zap, Users, Clock, AlertTriangle,
  Building2, Contact, CreditCard, ArrowRight
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface WorkPlan {
  priority: number;
  title: string;
  description: string;
  source_type: string;
  goal: string;
  recommended_template: string;
  contact_count: number;
  urgency: "alta" | "media" | "bassa";
  filter?: Record<string, unknown>;
  reason: string;
}

interface WorkPlanResult {
  generated_at: string;
  summary: {
    total_actionable: number;
    total_never_contacted: number;
    urgent_followups: number;
    stale_reactivations: number;
  };
  plans: WorkPlan[];
}

const CACHE_KEY = "workplan_cache";
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24h

function getCachedPlan(): WorkPlanResult | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (Date.now() - new Date(cached.generated_at).getTime() > CACHE_DURATION) return null;
    return cached;
  } catch { return null; }
}

async function fetchWorkPlan(): Promise<WorkPlanResult> {
  const cached = getCachedPlan();
  if (cached) return cached;

  const { data, error } = await supabase.functions.invoke("generate-work-plan", { body: {} });
  if (error) throw error;
  localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  return data as WorkPlanResult;
}

const urgencyConfig = {
  alta: { color: "bg-red-500/10 text-red-400 border-red-500/30", label: "Alta" },
  media: { color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30", label: "Media" },
  bassa: { color: "bg-green-500/10 text-green-400 border-green-500/30", label: "Bassa" },
};

const sourceIcons: Record<string, typeof Building2> = {
  wca_partners: Building2,
  contacts: Contact,
  business_cards: CreditCard,
  mixed: Zap,
};

const goalLabels: Record<string, string> = {
  primo_contatto: "Primo Contatto",
  follow_up: "Follow-Up",
  event_followup: "Post Evento",
  reactivation: "Riattivazione",
  nurturing: "Nurturing",
};

function PriorityBadge({ priority }: { priority: number }) {
  const bg = priority <= 2 ? "bg-red-500" : priority <= 4 ? "bg-orange-500" : "bg-blue-500";
  return (
    <div className={cn("flex items-center justify-center w-8 h-8 rounded-full text-white text-sm font-bold shrink-0", bg)}>
      {priority}
    </div>
  );
}

function SummaryCard({ title, value, icon: Icon, color }: {
  title: string; value: number; icon: typeof Zap; color: string;
}) {
  return (
    <Card className="border-border/40">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn("p-2 rounded-lg", color)}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function PlanCard({ plan, onDismiss }: {
  plan: WorkPlan;
  onDismiss: (priority: number) => void;
}) {
  const urg = urgencyConfig[plan.urgency];
  const SourceIcon = sourceIcons[plan.source_type] || Zap;

  return (
    <Card className="border-border/40 hover:border-border/60 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <PriorityBadge priority={plan.priority} />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-sm leading-tight">{plan.title}</h3>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => onDismiss(plan.priority)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Ignora</TooltipContent>
              </Tooltip>
            </div>

            <p className="text-xs text-muted-foreground">{plan.description}</p>

            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline" className="text-[10px] gap-1 h-5">
                <SourceIcon className="w-3 h-3" />
                {plan.source_type.replace("_", " ")}
              </Badge>
              <Badge variant="outline" className="text-[10px] h-5">
                {goalLabels[plan.goal] || plan.goal}
              </Badge>
              <Badge variant="outline" className={cn("text-[10px] h-5 border", urg.color)}>
                {urg.label}
              </Badge>
              <Badge variant="secondary" className="text-[10px] h-5">
                {plan.contact_count} contatti
              </Badge>
            </div>

            <div className="bg-muted/30 rounded-md px-3 py-2 text-[11px] text-muted-foreground italic">
              💡 {plan.reason}
            </div>

            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <ArrowRight className="w-3 h-3" />
              Template consigliato: <span className="font-medium text-foreground">{plan.recommended_template}</span>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button size="sm" className="h-7 text-xs gap-1">
                <Play className="w-3 h-3" /> Avvia
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                <Eye className="w-3 h-3" /> Vedi Contatti
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function WorkPlanDashboard() {
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  const { data, isLoading, refetch, isFetching } = useQuery<WorkPlanResult>({
    queryKey: ["work-plan"],
    queryFn: fetchWorkPlan,
    staleTime: CACHE_DURATION,
  });

  const handleRefresh = useCallback(() => {
    localStorage.removeItem(CACHE_KEY);
    refetch();
    toast.info("Aggiornamento piano lavori...");
  }, [refetch]);

  const handleDismiss = useCallback((priority: number) => {
    setDismissed(prev => new Set(prev).add(priority));
  }, []);

  const visiblePlans = data?.plans.filter(p => !dismissed.has(p.priority)) ?? [];
  const summary = data?.summary;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Analisi dati in corso...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-border/30 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Piano Lavori AI</h2>
          {data?.generated_at && (
            <p className="text-[10px] text-muted-foreground">
              Generato: {new Date(data.generated_at).toLocaleString("it-IT")}
            </p>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1"
          onClick={handleRefresh}
          disabled={isFetching}
        >
          <RefreshCw className={cn("w-3 h-3", isFetching && "animate-spin")} />
          Aggiorna Piano
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Summary Cards */}
          {summary && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <SummaryCard title="Azioni Totali" value={summary.total_actionable} icon={Zap} color="bg-primary/10 text-primary" />
              <SummaryCard title="Mai Contattati" value={summary.total_never_contacted} icon={Users} color="bg-blue-500/10 text-blue-400" />
              <SummaryCard title="Follow-up Urgenti" value={summary.urgent_followups} icon={AlertTriangle} color="bg-red-500/10 text-red-400" />
              <SummaryCard title="Da Riattivare" value={summary.stale_reactivations} icon={Clock} color="bg-orange-500/10 text-orange-400" />
            </div>
          )}

          {/* Plans */}
          {visiblePlans.length === 0 ? (
            <Card className="border-border/40">
              <CardContent className="p-8 text-center">
                <p className="text-sm text-muted-foreground">Nessun piano da proporre. Tutti i contatti sono gestiti! 🎉</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {visiblePlans.map(plan => (
                <PlanCard key={plan.priority} plan={plan} onDismiss={handleDismiss} />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Quick Actions */}
      {visiblePlans.length > 0 && (
        <div className="shrink-0 px-4 py-3 border-t border-border/30 flex items-center gap-2">
          <Button size="sm" className="h-8 text-xs gap-1">
            <Play className="w-3 h-3" /> Avvia Top 3 Piani
          </Button>
          <span className="text-[10px] text-muted-foreground">
            {visiblePlans.length} piani disponibili
          </span>
        </div>
      )}
    </div>
  );
}
