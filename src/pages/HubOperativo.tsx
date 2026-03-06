import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Globe, Building2, Users, Mail, Phone, CalendarClock,
  Search, Sparkles, ArrowRight, CheckCircle2, Clock, AlertCircle,
  Zap, Send, Filter,
} from "lucide-react";
import { useAllActivities, useUpdateActivity, useDeleteActivities, type AllActivity } from "@/hooks/useActivities";
import { cn } from "@/lib/utils";

type SourceTab = "partner" | "prospect" | "contact";

const SOURCE_CONFIG: Record<SourceTab, { label: string; icon: typeof Globe; description: string }> = {
  partner: { label: "WCA Partners", icon: Globe, description: "Attività da Operations e Partner Hub" },
  prospect: { label: "Prospect RA", icon: Building2, description: "Attività da Report Aziende" },
  contact: { label: "Contatti Import", icon: Users, description: "Attività da file CSV importati" },
};

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Clock; className: string }> = {
  pending: { label: "In coda", icon: Clock, className: "text-muted-foreground" },
  in_progress: { label: "In corso", icon: AlertCircle, className: "text-warning" },
  completed: { label: "Completato", icon: CheckCircle2, className: "text-success" },
  cancelled: { label: "Annullato", icon: AlertCircle, className: "text-destructive" },
};

const TYPE_ICONS: Record<string, typeof Mail> = {
  send_email: Mail,
  phone_call: Phone,
  meeting: Users,
  follow_up: CalendarClock,
  add_to_campaign: Send,
};

function ActivityRow({ activity, onComplete }: { activity: AllActivity; onComplete: (id: string) => void }) {
  const TypeIcon = TYPE_ICONS[activity.activity_type] || CalendarClock;
  const statusCfg = STATUS_CONFIG[activity.status] || STATUS_CONFIG.pending;
  const StatusIcon = statusCfg.icon;

  const companyName = activity.partners?.company_name || activity.title.replace(/^(Email|Chiamata|Campagna Email) (a |- )/, "");

  return (
    <div className="flex items-center gap-3 px-3 py-2 hover:bg-accent/50 rounded-md transition-colors group">
      <div className={cn("w-7 h-7 rounded-md flex items-center justify-center shrink-0",
        activity.activity_type === "send_email" ? "bg-primary/10" : "bg-muted"
      )}>
        <TypeIcon className={cn("w-3.5 h-3.5", activity.activity_type === "send_email" ? "text-primary" : "text-muted-foreground")} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate">{companyName}</div>
        <div className="text-[10px] text-muted-foreground truncate">{activity.title}</div>
      </div>
      <StatusIcon className={cn("w-3.5 h-3.5 shrink-0", statusCfg.className)} />
      {activity.status === "pending" && (
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => { e.stopPropagation(); onComplete(activity.id); }}
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-success" />
        </Button>
      )}
    </div>
  );
}

function SourcePanel({ source, activities, navigate }: {
  source: SourceTab;
  activities: AllActivity[];
  navigate: ReturnType<typeof useNavigate>;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const updateActivity = useUpdateActivity();

  const filtered = useMemo(() => {
    let list = activities;
    if (statusFilter === "active") list = list.filter(a => a.status !== "completed" && a.status !== "cancelled");
    else if (statusFilter !== "all") list = list.filter(a => a.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(a =>
        a.title.toLowerCase().includes(q) ||
        a.partners?.company_name?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [activities, statusFilter, search]);

  const stats = useMemo(() => {
    const total = activities.length;
    const pending = activities.filter(a => a.status === "pending").length;
    const inProgress = activities.filter(a => a.status === "in_progress").length;
    const completed = activities.filter(a => a.status === "completed").length;
    const emails = activities.filter(a => a.activity_type === "send_email" && a.status !== "completed").length;
    return { total, pending, inProgress, completed, emails };
  }, [activities]);

  const handleComplete = useCallback((id: string) => {
    updateActivity.mutate({ id, status: "completed", completed_at: new Date().toISOString() });
  }, [updateActivity]);

  const cfg = SOURCE_CONFIG[source];

  return (
    <div className="flex flex-col h-full">
      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-2 p-3">
        <Card className="bg-card border-border">
          <CardContent className="p-3 flex flex-col items-center">
            <span className="text-lg font-bold text-foreground">{stats.total}</span>
            <span className="text-[10px] text-muted-foreground">Totale</span>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-3 flex flex-col items-center">
            <span className="text-lg font-bold text-warning">{stats.pending}</span>
            <span className="text-[10px] text-muted-foreground">In coda</span>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-3 flex flex-col items-center">
            <span className="text-lg font-bold text-success">{stats.completed}</span>
            <span className="text-[10px] text-muted-foreground">Completate</span>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-3 flex flex-col items-center">
            <span className="text-lg font-bold text-primary">{stats.emails}</span>
            <span className="text-[10px] text-muted-foreground">Email da fare</span>
          </CardContent>
        </Card>
      </div>

      {/* Progress */}
      {stats.total > 0 && (
        <div className="px-3 pb-2">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
            <span>Progresso</span>
            <span>{stats.completed}/{stats.total} ({stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%)</span>
          </div>
          <Progress value={stats.total > 0 ? (stats.completed / stats.total) * 100 : 0} className="h-1.5" />
        </div>
      )}

      {/* Quick actions */}
      <div className="flex gap-2 px-3 pb-2">
        <Button
          size="sm"
          className="h-7 text-xs gap-1.5 flex-1"
          onClick={() => navigate("/workspace")}
          disabled={stats.emails === 0}
        >
          <Sparkles className="w-3.5 h-3.5" />
          Apri Workspace ({stats.emails})
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1.5"
          onClick={() => navigate(source === "partner" ? "/partner-hub" : source === "prospect" ? "/prospects" : "/contacts")}
        >
          <ArrowRight className="w-3.5 h-3.5" />
          {cfg.label}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 px-3 pb-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca attività..."
            className="pl-7 h-7 text-xs"
          />
        </div>
        <div className="flex gap-0.5 bg-muted rounded-md p-0.5">
          {[
            { key: "active", label: "Attive" },
            { key: "completed", label: "Fatte" },
            { key: "all", label: "Tutte" },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={cn(
                "px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
                statusFilter === f.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Activity list */}
      <ScrollArea className="flex-1 px-1">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <cfg.icon className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-xs">Nessuna attività {statusFilter === "active" ? "attiva" : ""}</p>
            <p className="text-[10px] mt-1">{cfg.description}</p>
          </div>
        ) : (
          <div className="space-y-0.5 pb-4">
            {filtered.map(a => (
              <ActivityRow key={a.id} activity={a} onComplete={handleComplete} />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

export default function HubOperativo() {
  const [activeTab, setActiveTab] = useState<SourceTab>("partner");
  const navigate = useNavigate();
  const { data: allActivities } = useAllActivities();

  const bySource = useMemo(() => {
    const map: Record<SourceTab, AllActivity[]> = { partner: [], prospect: [], contact: [] };
    (allActivities || []).forEach(a => {
      const st = (a.source_type || "partner") as SourceTab;
      if (map[st]) map[st].push(a);
    });
    return map;
  }, [allActivities]);

  const counts = useMemo(() => ({
    partner: bySource.partner.filter(a => a.status !== "completed" && a.status !== "cancelled").length,
    prospect: bySource.prospect.filter(a => a.status !== "completed" && a.status !== "cancelled").length,
    contact: bySource.contact.filter(a => a.status !== "completed" && a.status !== "cancelled").length,
  }), [bySource]);

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 h-12 border-b border-border shrink-0">
        <Zap className="w-4.5 h-4.5 text-primary" />
        <h1 className="text-sm font-semibold text-foreground">Hub Operativo</h1>
        <span className="text-xs text-muted-foreground">Centro di smistamento job e campagne</span>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as SourceTab)} className="flex-1 flex flex-col min-h-0">
        <div className="px-4 pt-2 border-b border-border shrink-0">
          <TabsList className="h-9">
            {(["partner", "prospect", "contact"] as SourceTab[]).map(src => {
              const cfg = SOURCE_CONFIG[src];
              const Icon = cfg.icon;
              return (
                <TabsTrigger key={src} value={src} className="gap-1.5 text-xs px-4">
                  <Icon className="w-3.5 h-3.5" />
                  {cfg.label}
                  {counts[src] > 0 && (
                    <Badge variant="secondary" className="ml-1 h-4 min-w-[18px] text-[10px] px-1">
                      {counts[src]}
                    </Badge>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        {(["partner", "prospect", "contact"] as SourceTab[]).map(src => (
          <TabsContent key={src} value={src} className="flex-1 m-0 min-h-0">
            <SourcePanel source={src} activities={bySource[src]} navigate={navigate} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
