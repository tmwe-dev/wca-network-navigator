import { useState, useMemo } from "react";
import { useOperationsCenter, type AgentTaskLive, type EmailQueueItem, type ActivityLive } from "@/hooks/useOperationsCenter";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Activity, Bot, Mail, Download, Clock, CheckCircle2,
  AlertTriangle, Loader2, Pause, Send, Eye, Calendar
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isToday, isPast } from "date-fns";
import { it } from "date-fns/locale";
import type { DownloadJob } from "@/hooks/useDownloadJobs";

// ── Status helpers ──
const STATUS_COLORS: Record<string, string> = {
  running: "text-primary", pending: "text-primary", completed: "text-emerald-400",
  failed: "text-destructive", paused: "text-primary", sent: "text-emerald-400",
  sending: "text-primary", cancelled: "text-muted-foreground",
};

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "running": case "sending": return <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />;
    case "completed": case "sent": return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />;
    case "failed": return <AlertTriangle className="h-3.5 w-3.5 text-destructive" />;
    case "paused": return <Pause className="h-3.5 w-3.5 text-primary" />;
    default: return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

function StatCard({ label, value, icon: Icon, accent }: { label: string; value: number; icon: React.ElementType; accent?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm p-3">
      <div className={cn("rounded-lg p-2 bg-muted/40", accent)}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className="text-lg font-bold text-foreground">{value}</div>
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
      </div>
    </div>
  );
}

function TimeLabel({ date }: { date: string | null }) {
  if (!date) return null;
  const d = new Date(date);
  return (
    <span className="text-[10px] text-muted-foreground">
      {isToday(d) ? format(d, "HH:mm") : format(d, "dd MMM HH:mm", { locale: it })}
    </span>
  );
}

// ── Sub-panels ──
function DownloadPanel({ jobs }: { jobs: DownloadJob[] }) {
  const sorted = useMemo(() => [...jobs].sort((a, b) => {
    const order: Record<string, number> = { running: 0, pending: 1, paused: 2, failed: 3, completed: 4 };
    return (order[a.status] ?? 5) - (order[b.status] ?? 5);
  }), [jobs]);

  return (
    <div className="space-y-2">
      {sorted.length === 0 && <div className="text-sm text-muted-foreground text-center py-8">Nessun download job</div>}
      {sorted.map(job => {
        const progress = job.total_count > 0 ? Math.round((job.current_index / job.total_count) * 100) : 0;
        return (
          <div key={job.id} className={cn(
            "rounded-lg border p-3 space-y-2",
            job.status === "running" ? "border-primary/30 bg-primary/5" : "border-border/40 bg-muted/10"
          )}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <StatusIcon status={job.status} />
                <span className="text-sm font-medium">{job.country_name}</span>
                {job.network_name !== "Tutti" && (
                  <span className="text-xs text-muted-foreground">· {job.network_name}</span>
                )}
              </div>
              <Badge variant="outline" className={cn("text-[10px]", STATUS_COLORS[job.status])}>
                {job.status}
              </Badge>
            </div>
            {["running", "pending", "paused"].includes(job.status) && (
              <>
                <Progress value={progress} className="h-1.5" />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>{job.current_index}/{job.total_count} ({progress}%)</span>
                  {job.last_processed_company && <span className="truncate ml-2">{job.last_processed_company}</span>}
                </div>
              </>
            )}
            {job.error_message && <div className="text-[10px] text-destructive/80">⚠️ {job.error_message}</div>}
            <div className="text-[10px] text-muted-foreground">
              {job.contacts_found_count} contatti trovati · <TimeLabel date={job.created_at} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AgentTasksPanel({ tasks }: { tasks: AgentTaskLive[] }) {
  return (
    <div className="space-y-2">
      {tasks.length === 0 && <div className="text-sm text-muted-foreground text-center py-8">Nessun task agente</div>}
      {tasks.map(task => (
        <div key={task.id} className={cn(
          "rounded-lg border p-3 space-y-1.5",
          ["pending", "running"].includes(task.status) ? "border-primary/30 bg-primary/5" : "border-border/40 bg-muted/10"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">{task.agent_emoji}</span>
              <span className="text-xs font-semibold">{task.agent_name}</span>
              <StatusIcon status={task.status} />
            </div>
            <Badge variant="outline" className="text-[10px]">{task.task_type}</Badge>
          </div>
          <div className="text-xs text-foreground/80">{task.description}</div>
          {task.result_summary && (
            <div className="text-[10px] text-muted-foreground italic truncate">{task.result_summary}</div>
          )}
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <TimeLabel date={task.created_at} />
            {task.completed_at && <span>Completato: <TimeLabel date={task.completed_at} /></span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function EmailQueuePanel({ emails }: { emails: EmailQueueItem[] }) {
  const [filter, setFilter] = useState<string>("all");
  const filtered = useMemo(() => {
    if (filter === "all") return emails;
    if (filter === "scheduled") return emails.filter(e => e.scheduled_at && e.status === "pending");
    if (filter === "opened") return emails.filter(e => (e.open_count || 0) > 0);
    return emails.filter(e => e.status === filter);
  }, [emails, filter]);

  return (
    <div className="space-y-3">
      <div className="flex gap-1 flex-wrap">
        {["all", "pending", "sent", "failed", "scheduled", "opened"].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors",
              filter === f ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground hover:bg-muted/60"
            )}
          >
            {f === "all" ? "Tutti" : f === "pending" ? "In coda" : f === "sent" ? "Inviati" : f === "failed" ? "Errori" : f === "scheduled" ? "Programmati" : "Letti"}
          </button>
        ))}
      </div>
      {filtered.length === 0 && <div className="text-sm text-muted-foreground text-center py-8">Nessuna email</div>}
      {filtered.map(email => (
        <div key={email.id} className={cn(
          "rounded-lg border p-3 space-y-1",
          email.status === "sent" && (email.open_count || 0) > 0 ? "border-emerald-500/30 bg-emerald-500/5" :
          email.status === "failed" ? "border-destructive/30 bg-destructive/5" :
          "border-border/40 bg-muted/10"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <StatusIcon status={email.status} />
              <span className="text-xs font-medium truncate max-w-[200px]">{email.recipient_name || email.recipient_email}</span>
            </div>
            <div className="flex items-center gap-1.5">
              {(email.open_count || 0) > 0 && (
                <span className="flex items-center gap-0.5 text-[10px] text-emerald-400">
                  <Eye className="h-3 w-3" /> {email.open_count}
                </span>
              )}
              {email.scheduled_at && email.status === "pending" && (
                <span className="flex items-center gap-0.5 text-[10px] text-primary">
                  <Calendar className="h-3 w-3" />
                </span>
              )}
            </div>
          </div>
          <div className="text-[11px] text-foreground/70 truncate">{email.subject}</div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{email.recipient_email}</span>
            {email.scheduled_at && email.status === "pending" ? (
              <span>Invio: {format(new Date(email.scheduled_at), "dd/MM HH:mm")}</span>
            ) : email.sent_at ? (
              <span>Inviato: <TimeLabel date={email.sent_at} /></span>
            ) : (
              <TimeLabel date={email.created_at} />
            )}
          </div>
          {email.error_message && <div className="text-[10px] text-destructive/80">⚠️ {email.error_message}</div>}
        </div>
      ))}
    </div>
  );
}

function ActivitiesPanel({ activities }: { activities: ActivityLive[] }) {
  return (
    <div className="space-y-2">
      {activities.length === 0 && <div className="text-sm text-muted-foreground text-center py-8">Nessuna attività</div>}
      {activities.map(act => (
        <div key={act.id} className={cn(
          "rounded-lg border p-3 space-y-1",
          act.status === "pending" && act.due_date && isPast(new Date(act.due_date)) ? "border-destructive/30 bg-destructive/5" :
          act.status === "pending" ? "border-primary/30 bg-primary/5" :
          "border-border/40 bg-muted/10"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <StatusIcon status={act.status} />
              <span className="text-xs font-medium">{act.title}</span>
            </div>
            <Badge variant="outline" className="text-[10px]">{act.activity_type}</Badge>
          </div>
          {act.partner_name && <div className="text-[10px] text-muted-foreground">{act.partner_name}</div>}
          <div className="flex justify-between text-[10px] text-muted-foreground">
            {act.scheduled_at ? (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(new Date(act.scheduled_at), "dd/MM HH:mm")}
              </span>
            ) : act.due_date ? (
              <span className={cn(isPast(new Date(act.due_date)) && act.status === "pending" && "text-destructive")}>
                Scadenza: {format(new Date(act.due_date), "dd/MM/yyyy")}
              </span>
            ) : null}
            <TimeLabel date={act.created_at} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Component ──
export function OperationsCenter() {
  const { downloadJobs, agentTasks, emailQueue, activities, stats } = useOperationsCenter();
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-background">
      {/* Stats Bar */}
      <div className="flex-shrink-0 p-4 border-b border-border/50">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
          <StatCard label="Download attivi" value={stats.activeDownloads} icon={Download} accent="text-primary" />
          <StatCard label="Task agenti" value={stats.runningTasks} icon={Bot} accent="text-primary" />
          <StatCard label="Email in coda" value={stats.pendingEmails} icon={Mail} accent="text-primary" />
          <StatCard label="Email inviate" value={stats.sentEmails} icon={Send} accent="text-emerald-400" />
          <StatCard label="Email lette" value={stats.openedEmails} icon={Eye} accent="text-muted-foreground" />
          <StatCard label="Attività aperte" value={stats.pendingActivities} icon={Activity} accent="text-primary" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 px-4 pt-2">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-muted/40">
            <TabsTrigger value="overview" className="gap-1.5 text-xs">
              <Activity className="w-3.5 h-3.5" /> Panoramica
            </TabsTrigger>
            <TabsTrigger value="downloads" className="gap-1.5 text-xs">
              <Download className="w-3.5 h-3.5" /> Download
              {stats.activeDownloads > 0 && <Badge variant="secondary" className="ml-1 h-4 px-1 text-[9px]">{stats.activeDownloads}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="agents" className="gap-1.5 text-xs">
              <Bot className="w-3.5 h-3.5" /> Agenti
              {stats.runningTasks > 0 && <Badge variant="secondary" className="ml-1 h-4 px-1 text-[9px]">{stats.runningTasks}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="emails" className="gap-1.5 text-xs">
              <Mail className="w-3.5 h-3.5" /> Email
              {stats.pendingEmails > 0 && <Badge variant="secondary" className="ml-1 h-4 px-1 text-[9px]">{stats.pendingEmails}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="activities" className="gap-1.5 text-xs">
              <Calendar className="w-3.5 h-3.5" /> Attività
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Download className="h-3.5 w-3.5" /> Download attivi
              </h3>
              <DownloadPanel jobs={downloadJobs.filter(j => ["running", "pending", "paused"].includes(j.status))} />
              
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mt-4">
                <Bot className="h-3.5 w-3.5" /> Task agenti recenti
              </h3>
              <AgentTasksPanel tasks={agentTasks.filter(t => ["pending", "running"].includes(t.status)).slice(0, 5)} />
            </div>
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" /> Email recenti
              </h3>
              <EmailQueuePanel emails={emailQueue.slice(0, 10)} />

              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mt-4">
                <Calendar className="h-3.5 w-3.5" /> Prossime attività
              </h3>
              <ActivitiesPanel activities={activities.filter(a => a.status === "pending").slice(0, 5)} />
            </div>
          </div>
        )}

        {activeTab === "downloads" && <DownloadPanel jobs={downloadJobs} />}
        {activeTab === "agents" && <AgentTasksPanel tasks={agentTasks} />}
        {activeTab === "emails" && <EmailQueuePanel emails={emailQueue} />}
        {activeTab === "activities" && <ActivitiesPanel activities={activities} />}
      </div>
    </div>
  );
}
