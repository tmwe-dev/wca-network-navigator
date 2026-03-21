import { useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Radar, Network, Users, CalendarCheck, Activity, Download, Loader2, CheckCircle2, AlertTriangle, Pause, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { HomeAIPrompt } from "@/components/home/HomeAIPrompt";
import { OperativeBriefing } from "@/components/home/OperativeBriefing";
import { AgentStatusPanel } from "@/components/home/AgentStatusPanel";
import { useAllActivities } from "@/hooks/useActivities";
import { useDownloadJobs, type DownloadJob } from "@/hooks/useDownloadJobs";
import { useProspectStats } from "@/hooks/useProspectStats";
import { useCockpitContacts } from "@/hooks/useCockpitContacts";
import { useDailyBriefing, type BriefingAction } from "@/hooks/useDailyBriefing";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";

function useCount(table: "partners" | "partner_contacts" | "email_drafts") {
  return useQuery({
    queryKey: ["super-home-count", table],
    queryFn: async () => {
      const { count, error } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 60_000,
  });
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("it-IT", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function countryFlag(code: string) {
  if (!code || code.length < 2) return "🏳️";
  const upper = code.toUpperCase().slice(0, 2);
  return String.fromCodePoint(...[...upper].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

const NAV_CARDS = [
  {
    key: "outreach",
    title: "Outreach",
    description: "Cockpit AI, workspace e invio email",
    route: "/outreach",
    icon: Radar,
  },
  {
    key: "network",
    title: "Network",
    description: "Rubrica partner e download directory",
    route: "/network",
    icon: Network,
  },
  {
    key: "crm",
    title: "CRM",
    description: "Prospect, contatti e opportunità",
    route: "/crm",
    icon: Users,
  },
  {
    key: "agenda",
    title: "Agenda",
    description: "Attività, scadenze e follow-up",
    route: "/agenda",
    icon: CalendarCheck,
  },
] as const;

function JobStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "running":
      return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
    case "completed":
      return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
    case "failed":
      return <AlertTriangle className="h-4 w-4 text-destructive" />;
    case "paused":
      return <Pause className="h-4 w-4 text-amber-400" />;
    default:
      return <Download className="h-4 w-4 text-muted-foreground" />;
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "running": return "In corso";
    case "completed": return "Completato";
    case "failed": return "Errore";
    case "paused": return "In pausa";
    case "pending": return "In coda";
    default: return status;
  }
}

function ActiveJobsPanel({ jobs }: { jobs: DownloadJob[] }) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("dismissed_job_cards");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });

  const dismiss = useCallback((id: string) => {
    setDismissedIds(prev => {
      const next = new Set(prev);
      next.add(id);
      localStorage.setItem("dismissed_job_cards", JSON.stringify([...next]));
      return next;
    });
  }, []);

  const activeJobs = jobs.filter((j) => ["running", "pending"].includes(j.status));
  const recentCompleted = jobs.filter((j) => j.status === "completed").slice(0, 2);
  const recentFailed = jobs.filter((j) => j.status === "failed").slice(0, 2);
  const allDisplay = [...activeJobs, ...recentFailed, ...recentCompleted].slice(0, 5);
  const displayJobs = allDisplay.filter(j => !dismissedIds.has(j.id) || ["running", "pending"].includes(j.status));

  if (displayJobs.length === 0) return null;

  return (
    <section className="glass-panel rounded-xl border border-border/60 p-4 space-y-3">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        <Download className="h-3.5 w-3.5 text-primary/70" />
        Download attivi
      </div>
      <div className="space-y-2.5">
        {displayJobs.map((job) => {
          const progress = job.total_count > 0 ? Math.round((job.current_index / job.total_count) * 100) : 0;
          const isActive = job.status === "running";
          const isDismissable = ["completed", "failed", "cancelled"].includes(job.status);

          return (
            <div
              key={job.id}
              className={cn(
                "rounded-lg border p-3 space-y-2 transition-colors",
                isActive ? "border-primary/30 bg-primary/5" : "border-border/40 bg-muted/20"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">{countryFlag(job.country_code)}</span>
                  <div>
                    <div className="text-sm font-medium text-foreground">
                      {job.country_name}
                      {job.network_name && job.network_name !== "Tutti" && (
                        <span className="ml-1.5 text-xs text-muted-foreground">· {job.network_name}</span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {job.current_index}/{job.total_count} profili · {job.contacts_found_count} contatti trovati
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <JobStatusIcon status={job.status} />
                  <span className={cn(
                    "text-[10px] font-medium",
                    job.status === "running" ? "text-primary" :
                    job.status === "failed" ? "text-destructive" :
                    job.status === "completed" ? "text-emerald-400" :
                    "text-muted-foreground"
                  )}>
                    {statusLabel(job.status)}
                  </span>
                  {isDismissable && (
                    <button
                      onClick={() => dismiss(job.id)}
                      className="ml-1 p-0.5 rounded hover:bg-muted/40 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                      title="Chiudi notifica"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>

              {(isActive || job.status === "pending") && (
                <div className="space-y-1">
                  <Progress value={progress} className="h-1.5" />
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{progress}%</span>
                    {job.last_processed_company && (
                      <span className="truncate ml-2">{job.last_processed_company}</span>
                    )}
                  </div>
                </div>
              )}

              {job.last_contact_result && isActive && (
                <div className="text-[10px] text-muted-foreground/70 truncate font-mono">
                  Ultimo risultato: {job.last_contact_result}
                </div>
              )}

              {job.error_message && (
                <div className="text-[10px] text-destructive/80 truncate">
                  ⚠️ {job.error_message}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function SuperHome3D() {
  const navigate = useNavigate();

  const { data: activities = [] } = useAllActivities();
  const { data: jobs = [] } = useDownloadJobs();
  const { data: prospectStats } = useProspectStats();
  const { contacts = [] } = useCockpitContacts();
  const { data: partnerCount = 0 } = useCount("partners");

  const readyContacts = useMemo(
    () => contacts.filter((c) => Boolean(c.email)).length,
    [contacts]
  );
  const openActivities = useMemo(
    () => activities.filter((a) => !["completed", "cancelled"].includes(a.status)).length,
    [activities]
  );
  const activeJobs = useMemo(
    () => jobs.filter((j) => ["pending", "running"].includes(j.status)).length,
    [jobs]
  );

  const greeting = new Date().getHours() < 13 ? "Buongiorno" : "Buonasera";

  const statForCard = (key: string) => {
    switch (key) {
      case "outreach": return `${formatCompact(readyContacts)} contatti pronti`;
      case "network": return `${formatCompact(partnerCount)} partner`;
      case "crm": return `${formatCompact(prospectStats?.total ?? 0)} prospect`;
      case "agenda": return `${formatCompact(openActivities)} attività aperte`;
      default: return "";
    }
  };

  const signals = useMemo(() => {
    const s: { label: string; value: string }[] = [];
    if (activeJobs > 0) s.push({ label: "Job download attivi", value: String(activeJobs) });
    if (readyContacts > 0) s.push({ label: "Contatti pronti all'outreach", value: formatCompact(readyContacts) });
    if (openActivities > 0) s.push({ label: "Attività aperte", value: formatCompact(openActivities) });
    return s;
  }, [activeJobs, readyContacts, openActivities]);

  return (
    <div className="h-[calc(100vh-3.5rem)] overflow-y-auto bg-background text-foreground">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">

        {/* Greeting + AI Prompt */}
        <section className="space-y-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {greeting}. <span className="text-muted-foreground">Cosa vuoi fare oggi?</span>
          </h1>
          <HomeAIPrompt systemStats={{
            activeJobs,
            pendingActivities: openActivities,
            totalPartners: partnerCount,
          }} />
        </section>

        {/* Active downloads — always visible when jobs exist */}
        <ActiveJobsPanel jobs={jobs} />

        {/* Navigation cards */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {NAV_CARDS.map((card) => (
            <button
              key={card.key}
              onClick={() => navigate(card.route)}
              className={cn(
                "glass-panel group flex flex-col justify-between rounded-xl border border-border/60 p-4 text-left transition-all hover:border-primary/40 hover:shadow-[0_0_20px_hsl(var(--primary)/0.1)]",
                "min-h-[130px]"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="rounded-lg border border-border/60 bg-muted/40 p-2">
                  <card.icon className="h-4 w-4 text-foreground/80" />
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </div>
              <div className="mt-3 space-y-1">
                <div className="text-sm font-semibold text-foreground">{card.title}</div>
                <div className="text-[11px] leading-snug text-muted-foreground">{card.description}</div>
              </div>
              <div className="mt-2 text-xs font-medium text-primary/80">{statForCard(card.key)}</div>
            </button>
          ))}
        </section>

        {/* System status */}
        {signals.length > 0 && (
          <section className="glass-panel rounded-xl border border-border/60 p-4">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              <Activity className="h-3.5 w-3.5 text-primary/70" />
              Stato del sistema
            </div>
            <ul className="space-y-1.5">
              {signals.map((s) => (
                <li key={s.label} className="flex items-center gap-2 text-sm text-foreground/80">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
                  <span className="font-medium">{s.value}</span>
                  <span className="text-muted-foreground">{s.label}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
