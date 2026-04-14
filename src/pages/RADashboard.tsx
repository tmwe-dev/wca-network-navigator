import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRADashboard } from "@/hooks/useRADashboard";
import {
  Building2, Mail, FileText, Phone, TrendingUp,
  Zap, Download, Filter, Clock, Activity,
} from "lucide-react";

function formatRelativeTime(date: string | Date): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "ora";
  if (diffMins < 60) return `${diffMins}m fa`;
  if (diffHours < 24) return `${diffHours}h fa`;
  return `${diffDays}d fa`;
}

function calculateJobProgress(job: Record<string, unknown>): number {
  if (job.total_items === 0) return 0;
  return Math.round((job.processed_items / job.total_items) * 100);
}

interface KPICardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}

function KPICard({ icon, label, value, color }: KPICardProps) {
  return (
    <div className="rounded-lg p-4 bg-card/60 backdrop-blur-sm border border-border/40 hover:border-primary/20 transition-all duration-300 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <span className={`${color} text-lg`}>{icon}</span>
          <Badge variant="secondary" className="text-xs">
            {color === "text-emerald-400" ? "+2.4%" : "+0.8%"}
          </Badge>
        </div>
        <div className="text-2xl font-bold text-foreground mb-1 font-mono">
          {value.toLocaleString("it-IT")}
        </div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="h-full overflow-auto bg-background">
      <div className="p-6 space-y-6">
        <div className="border-b border-border pb-6">
          <div className="h-8 bg-muted rounded w-1/3 mb-2 animate-pulse" />
          <div className="h-4 bg-muted rounded w-1/2 animate-pulse" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-lg p-4 bg-card/60 border border-border/40 animate-pulse">
              <div className="h-6 bg-muted rounded w-1/2 mb-3" />
              <div className="h-8 bg-muted rounded mb-2" />
              <div className="h-4 bg-muted rounded w-1/3" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ErrorState({ error }: { error: Error }) {
  return (
    <div className="h-full overflow-auto flex items-center justify-center bg-background">
      <div className="text-center">
        <p className="text-destructive mb-4">Errore nel caricamento del dashboard</p>
        <p className="text-sm text-muted-foreground">{error.message}</p>
      </div>
    </div>
  );
}

export default function RADashboard() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useRADashboard();
  const [activeJobsFilter, setActiveJobsFilter] = useState<"all" | "running" | "completed">("all");

  const stats = data ?? {
    totalProspects: 0, withEmail: 0, withPec: 0, withPhone: 0,
    topAteco: [], recentProspects: [], activeJobs: [],
  };

  const filteredJobs = useMemo(() => {
    const jobs = stats.activeJobs ?? [];
    if (activeJobsFilter === "all") return jobs;
    return jobs.filter((j) => j.status === activeJobsFilter);
  }, [stats.activeJobs, activeJobsFilter]);

  if (isLoading) return <LoadingSkeleton />;
  if (error) return <ErrorState error={error as Error} />;

  return (
    <div className="h-full overflow-auto bg-background">
      <style>{`
        @keyframes breathe { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
        .status-dot-active { animation: breathe 2s ease-in-out infinite; }
      `}</style>

      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="border-b border-border pb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">Report Aziende — Dashboard</h1>
          <p className="text-sm text-muted-foreground">Gestione e monitoraggio prospect da reportaziende.it</p>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-4 gap-4">
          <KPICard icon={<Building2 className="w-5 h-5" />} label="Prospect Totali" value={stats.totalProspects} color="text-primary" />
          <KPICard icon={<Mail className="w-5 h-5" />} label="Con Email" value={stats.withEmail} color="text-emerald-400" />
          <KPICard icon={<FileText className="w-5 h-5" />} label="Con PEC" value={stats.withPec} color="text-emerald-400" />
          <KPICard icon={<Phone className="w-5 h-5" />} label="Con Telefono" value={stats.withPhone} color="text-primary" />
        </div>

        {/* Two Column Grid */}
        <div className="grid grid-cols-2 gap-6">
          {/* Left: Top Sectors */}
          <div className="rounded-lg overflow-hidden bg-card/60 backdrop-blur-sm border border-border/40">
            <div className="p-6 border-b border-border">
              <div className="flex items-center gap-2 mb-0.5">
                <TrendingUp className="w-4 h-4 text-primary" />
                <h2 className="text-lg font-semibold text-foreground font-mono">SETTORI TOP</h2>
              </div>
              <p className="text-xs text-muted-foreground">Top 5 ATECO by prospect</p>
            </div>
            <div className="divide-y divide-border">
              {(stats.topAteco ?? []).map((sector) => (
                <div key={sector.code} className="px-6 py-3 hover:bg-primary/5 transition-colors cursor-pointer group">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{sector.description}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 font-mono">ATECO {sector.code}</div>
                    </div>
                    <Badge variant="secondary" className="text-xs">{sector.count.toLocaleString("it-IT")}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Latest Acquisitions */}
          <div className="rounded-lg overflow-hidden bg-card/60 backdrop-blur-sm border border-border/40">
            <div className="p-6 border-b border-border">
              <div className="flex items-center gap-2 mb-0.5">
                <Clock className="w-4 h-4 text-primary" />
                <h2 className="text-lg font-semibold text-foreground font-mono">ULTIME ACQUISIZIONI</h2>
              </div>
              <p className="text-xs text-muted-foreground">Ultimi prospect importati</p>
            </div>
            <div className="divide-y divide-border">
              {(stats.recentProspects ?? []).map((prospect) => (
                <div key={prospect.id} className="px-6 py-3 hover:bg-primary/5 transition-colors cursor-pointer group" onClick={() => navigate(`/ra/company/${prospect.id}`)}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{prospect.company_name}</div>
                    <span className="text-xs text-muted-foreground">{formatRelativeTime(prospect.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-xs">{prospect.city || "—"}</Badge>
                    <Badge variant="secondary" className="text-xs">{prospect.codice_ateco || "—"}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Actions Row */}
        <div className="flex gap-3">
          <Button size="lg" className="gap-2" onClick={() => navigate("/v2/research/scraping")}>
            <Zap className="w-4 h-4" /> Nuova Ricerca
          </Button>
          <Button size="lg" variant="outline" className="gap-2" onClick={() => navigate("/v2/research/explorer")}>
            <Activity className="w-4 h-4" /> Explorer ATECO
          </Button>
          <Button size="lg" variant="outline" className="gap-2">
            <Download className="w-4 h-4" /> Export CSV
          </Button>
          <Button size="lg" variant="outline" className="gap-2">
            <Filter className="w-4 h-4" /> Filtri ATECO
          </Button>
        </div>

        {/* Bottom Section: Active Jobs */}
        <div className="rounded-lg overflow-hidden bg-card/60 backdrop-blur-sm border border-border/40">
          <div className="p-6 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                <h2 className="text-lg font-semibold text-foreground font-mono">JOB IN CORSO</h2>
              </div>
              <div className="flex gap-2">
                {(["all", "running", "completed"] as const).map(f => (
                  <Button key={f} size="sm" variant={activeJobsFilter === f ? "default" : "ghost"} onClick={() => setActiveJobsFilter(f)} className="text-xs">
                    {f === "all" ? "Tutti" : f === "running" ? "In Corso" : "Completati"}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <div className="divide-y divide-border">
            {filteredJobs.length === 0 ? (
              <div className="px-6 py-8 text-center text-muted-foreground">Nessun job trovato</div>
            ) : (
              filteredJobs.map((job) => {
                const progress = calculateJobProgress(job);
                const isRunning = job.status === "running";
                return (
                  <div key={job.id} className="px-6 py-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${isRunning ? "status-dot-active bg-emerald-400" : "bg-muted-foreground/40"}`} />
                        <div>
                          <div className="text-sm font-medium text-foreground">{job.job_type.replace(/_/g, " ").toUpperCase()}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {job.started_at ? `Iniziato ${formatRelativeTime(job.started_at)}` : "In attesa..."}
                          </div>
                        </div>
                      </div>
                      <Badge variant={isRunning ? "secondary" : "outline"} className={`text-xs ${isRunning ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : ""}`}>
                        {isRunning ? "In Corso" : "Completato"}
                      </Badge>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${isRunning ? "bg-primary" : "bg-muted-foreground/40"}`} style={{ width: `${progress}%` }} />
                    </div>
                    <div className="text-xs text-muted-foreground mt-2 text-right">
                      {job.processed_items.toLocaleString("it-IT")} / {job.total_items.toLocaleString("it-IT")} ({progress}%)
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
