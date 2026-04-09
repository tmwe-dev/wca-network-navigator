import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { resolveAgentAvatar } from "@/data/agentAvatars";
import { useAgentDashboard, type AgentTaskRow, type AgentWithTasks } from "@/hooks/useAgentDashboard";
import {
  Clock, CheckCircle, XCircle, Loader2, Zap, TrendingUp,
  Activity, BarChart3, Timer, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  pending: { icon: <Clock className="w-3 h-3" />, color: "text-amber-400", label: "In attesa" },
  proposed: { icon: <Sparkles className="w-3 h-3" />, color: "text-purple-400", label: "Proposto" },
  running: { icon: <Loader2 className="w-3 h-3 animate-spin" />, color: "text-blue-400", label: "In corso" },
  completed: { icon: <CheckCircle className="w-3 h-3" />, color: "text-emerald-400", label: "Completato" },
  failed: { icon: <XCircle className="w-3 h-3" />, color: "text-red-400", label: "Fallito" },
};

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={cn("flex items-center gap-3 rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-3 min-w-[120px]")}
    >
      <div className={cn("flex items-center justify-center w-9 h-9 rounded-lg", color)}>
        {icon}
      </div>
      <div>
        <div className="text-xl font-bold tabular-nums">{value}</div>
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
      </div>
    </motion.div>
  );
}

function TaskRow({ task, showAgent }: { task: AgentTaskRow; showAgent?: string }) {
  const cfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
  const timeAgo = formatDistanceToNow(new Date(task.created_at), { addSuffix: true, locale: it });

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8 }}
      className={cn(
        "flex items-start gap-2.5 p-3 rounded-lg border transition-all",
        task.status === "running"
          ? "border-blue-500/30 bg-blue-500/5 shadow-sm shadow-blue-500/10"
          : task.status === "proposed"
            ? "border-purple-500/30 bg-purple-500/5"
            : "border-border/40 bg-card/30"
      )}
    >
      <span className={cn("mt-0.5", cfg.color)}>{cfg.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium leading-snug">{task.description}</p>
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
          <Badge variant="outline" className="text-[9px] h-4 px-1.5 uppercase">
            {task.task_type}
          </Badge>
          <Badge variant="outline" className={cn("text-[9px] h-4 px-1.5", cfg.color)}>
            {cfg.label}
          </Badge>
          {showAgent && (
            <span className="text-[9px] text-muted-foreground">{showAgent}</span>
          )}
          <span className="text-[9px] text-muted-foreground ml-auto">{timeAgo}</span>
        </div>
        {task.result_summary && (
          <p className="text-[10px] text-muted-foreground/70 mt-1 italic truncate">{task.result_summary}</p>
        )}
      </div>
    </motion.div>
  );
}

function LivePulse() {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
    </span>
  );
}

function AgentCard({ agent }: { agent: AgentWithTasks }) {
  const avatarSrc = resolveAgentAvatar(agent.name, agent.avatar_emoji);
  const running = agent.tasks.filter(t => t.status === "running").length;
  const pending = agent.tasks.filter(t => t.status === "pending" || t.status === "proposed").length;
  const completed = agent.tasks.filter(t => t.status === "completed").length;
  const isWorking = running > 0;

  return (
    <div className={cn(
      "rounded-xl border p-3 transition-all",
      isWorking ? "border-blue-500/40 bg-blue-500/5 shadow-sm" : "border-border/50 bg-card/30"
    )}>
      <div className="flex items-center gap-2.5 mb-2">
        {avatarSrc ? (
          <Avatar className={cn("h-8 w-8 ring-2 ring-offset-1 ring-offset-background", isWorking ? "ring-primary" : "ring-transparent")}>
            <AvatarImage src={avatarSrc} alt={agent.name} />
            <AvatarFallback className="text-xs">{agent.avatar_emoji}</AvatarFallback>
          </Avatar>
        ) : (
          <span className="text-xl">{agent.avatar_emoji}</span>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold truncate">{agent.name}</span>
            {isWorking && <LivePulse />}
          </div>
          <span className="text-[10px] text-muted-foreground uppercase">{agent.role}</span>
        </div>
      </div>
      <div className="flex gap-3 text-[10px]">
        {running > 0 && <span className="text-blue-400">⚡ {running} attivi</span>}
        {pending > 0 && <span className="text-amber-400">⏳ {pending} in coda</span>}
        <span className="text-emerald-400">✓ {completed}</span>
      </div>
    </div>
  );
}

function GlobalTab({ agents, tasks, stats }: { agents: AgentWithTasks[]; tasks: AgentTaskRow[]; stats: any }) {
  const activeTasks = tasks.filter(t => t.status === "running" || t.status === "pending" || t.status === "proposed");
  const recentCompleted = tasks.filter(t => t.status === "completed").slice(0, 15);
  const agentMap = new Map(agents.map(a => [a.id, a.name]));

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="flex flex-wrap gap-2">
        <StatCard label="Totali" value={stats.total} icon={<BarChart3 className="w-4 h-4" />} color="bg-muted/50" />
        <StatCard label="In attesa" value={stats.pending} icon={<Timer className="w-4 h-4 text-amber-400" />} color="bg-amber-500/10" />
        <StatCard label="Attivi" value={stats.running} icon={<Zap className="w-4 h-4 text-blue-400" />} color="bg-blue-500/10" />
        <StatCard label="Completati" value={stats.completed} icon={<TrendingUp className="w-4 h-4 text-emerald-400" />} color="bg-emerald-500/10" />
      </div>

      {/* Agent Grid */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">👥 Team</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {agents.map(a => <AgentCard key={a.id} agent={a} />)}
        </div>
      </div>

      {/* Active Tasks */}
      {activeTasks.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <LivePulse />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Attività in corso</h3>
          </div>
          <div className="space-y-1.5">
            <AnimatePresence mode="popLayout">
              {activeTasks.slice(0, 20).map(t => (
                <TaskRow key={t.id} task={t} showAgent={agentMap.get(t.agent_id)} />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Recent completed */}
      {recentCompleted.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">✅ Completate di recente</h3>
          <div className="space-y-1.5 opacity-80">
            {recentCompleted.map(t => (
              <TaskRow key={t.id} task={t} showAgent={agentMap.get(t.agent_id)} />
            ))}
          </div>
        </div>
      )}

      {tasks.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Activity className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nessuna attività registrata</p>
          <p className="text-xs mt-1">Il ciclo autonomo crea task ogni 10 minuti</p>
        </div>
      )}
    </div>
  );
}

function AgentTab({ agent }: { agent: AgentWithTasks }) {
  const pending = agent.tasks.filter(t => t.status === "pending" || t.status === "proposed");
  const running = agent.tasks.filter(t => t.status === "running");
  const completed = agent.tasks.filter(t => t.status === "completed");
  const failed = agent.tasks.filter(t => t.status === "failed");

  return (
    <div className="space-y-4">
      <AgentCard agent={agent} />

      {running.length > 0 && (
        <Section title="⚡ In esecuzione" tasks={running} />
      )}
      {pending.length > 0 && (
        <Section title="⏳ In coda" tasks={pending} />
      )}
      {completed.length > 0 && (
        <Section title="✅ Completate" tasks={completed.slice(0, 20)} />
      )}
      {failed.length > 0 && (
        <Section title="❌ Fallite" tasks={failed.slice(0, 10)} />
      )}
      {agent.tasks.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">Nessun task per {agent.name}</p>
        </div>
      )}
    </div>
  );
}

function Section({ title, tasks }: { title: string; tasks: AgentTaskRow[] }) {
  return (
    <div>
      <h4 className="text-xs font-semibold mb-2">{title} ({tasks.length})</h4>
      <div className="space-y-1.5">
        <AnimatePresence mode="popLayout">
          {tasks.map(t => <TaskRow key={t.id} task={t} />)}
        </AnimatePresence>
      </div>
    </div>
  );
}

export function AgentOperationsDashboard({ open, onOpenChange }: Props) {
  const { agents, tasks, stats, isLoading } = useAgentDashboard();
  const [tab, setTab] = useState("global");

  // Auto-refresh visual heartbeat
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    if (!open) return;
    const iv = setInterval(() => setPulse(p => !p), 5000);
    return () => clearInterval(iv);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-2 border-b border-border/50">
          <div className="flex items-center gap-2">
            <motion.div
              animate={{ rotate: pulse ? 360 : 0 }}
              transition={{ duration: 1, ease: "easeInOut" }}
            >
              <Activity className="w-5 h-5 text-primary" />
            </motion.div>
            <DialogTitle className="text-base">Centro Operazioni Agenti</DialogTitle>
            {stats.running > 0 && (
              <div className="flex items-center gap-1.5 ml-2">
                <LivePulse />
                <span className="text-xs text-blue-400 font-medium">{stats.running} attivi</span>
              </div>
            )}
          </div>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex flex-col flex-1 min-h-0">
          <div className="px-4 pt-2 border-b border-border/30">
            <TabsList className="h-8 bg-muted/30">
              <TabsTrigger value="global" className="text-xs px-3 h-7 gap-1">
                <BarChart3 className="w-3 h-3" /> Globale
              </TabsTrigger>
              {agents.map(a => (
                <TabsTrigger key={a.id} value={a.id} className="text-xs px-2.5 h-7 gap-1 max-w-[100px]">
                  <span className="truncate">{a.name}</span>
                  {a.tasks.filter(t => t.status === "running").length > 0 && <LivePulse />}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <ScrollArea className="flex-1 min-h-0">
            <div className="p-4">
              <TabsContent value="global" className="mt-0">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <GlobalTab agents={agents} tasks={tasks} stats={stats} />
                )}
              </TabsContent>
              {agents.map(a => (
                <TabsContent key={a.id} value={a.id} className="mt-0">
                  <AgentTab agent={a} />
                </TabsContent>
              ))}
            </div>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
