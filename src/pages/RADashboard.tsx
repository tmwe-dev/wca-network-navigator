import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRADashboard } from "@/hooks/useRADashboard";
import {
  Building2,
  Mail,
  FileText,
  Phone,
  TrendingUp,
  Zap,
  Download,
  Filter,
  Clock,
  Activity,
} from "lucide-react";

// Glassmorphism and dark lab design tokens
const GLASS_CARD_STYLE = {
  background: "rgba(11, 13, 23, 0.6)",
  backdropFilter: "blur(12px)",
  border: "1px solid rgba(255, 255, 255, 0.05)",
};

const KPI_GRADIENT_BORDER = {
  background: `linear-gradient(180deg, rgba(0, 255, 255, 0.1) 0%, rgba(11, 13, 23, 0.6) 100%)`,
};

const DARK_BG = "hsl(240, 6%, 3%)"; // #0b0d17
const CYAN_ACCENT = "hsl(210, 100%, 66%)"; // #00ddff
const PURPLE_ACCENT = "hsl(270, 60%, 62%)"; // #bb68ff

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

function calculateJobProgress(job: any): number {
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
    <div
      style={{
        ...GLASS_CARD_STYLE,
        position: "relative",
        overflow: "hidden",
      }}
      className="rounded-lg p-4 hover:border-cyan-400/20 transition-all duration-300"
    >
      {/* Gradient top border */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "2px",
          background: `linear-gradient(90deg, transparent, ${CYAN_ACCENT}, transparent)`,
        }}
      />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <span className={`${color} text-lg`}>{icon}</span>
          <Badge variant="secondary" className="text-xs">
            {color === "text-emerald-400" ? "+2.4%" : "+0.8%"}
          </Badge>
        </div>
        <div className="text-2xl font-bold text-white mb-1" style={{ fontFamily: "JetBrains Mono" }}>
          {value.toLocaleString("it-IT")}
        </div>
        <div className="text-xs text-slate-400" style={{ fontFamily: "Inter" }}>
          {label}
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="h-full overflow-auto" style={{ backgroundColor: DARK_BG }}>
      <div className="p-6 space-y-6">
        <div className="border-b border-slate-800 pb-6">
          <div className="h-8 bg-slate-700 rounded w-1/3 mb-2 animate-pulse" />
          <div className="h-4 bg-slate-700 rounded w-1/2 animate-pulse" />
        </div>

        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              style={GLASS_CARD_STYLE}
              className="rounded-lg p-4 animate-pulse"
            >
              <div className="h-6 bg-slate-700 rounded w-1/2 mb-3" />
              <div className="h-8 bg-slate-700 rounded mb-2" />
              <div className="h-4 bg-slate-700 rounded w-1/3" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ErrorState({ error }: { error: Error }) {
  return (
    <div className="h-full overflow-auto flex items-center justify-center" style={{ backgroundColor: DARK_BG }}>
      <div className="text-center">
        <p className="text-red-400 mb-4">Errore nel caricamento del dashboard</p>
        <p className="text-sm text-slate-400">{error.message}</p>
      </div>
    </div>
  );
}

export default function RADashboard() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useRADashboard();
  const [activeJobsFilter, setActiveJobsFilter] = useState<
    "all" | "running" | "completed"
  >("all");

  const stats = data ?? {
    totalProspects: 0,
    withEmail: 0,
    withPec: 0,
    withPhone: 0,
    topAteco: [],
    recentProspects: [],
    activeJobs: [],
  };

  const filteredJobs = useMemo(() => {
    const jobs = stats.activeJobs ?? [];
    if (activeJobsFilter === "all") return jobs;
    return jobs.filter((j) => j.status === activeJobsFilter);
  }, [stats.activeJobs, activeJobsFilter]);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return <ErrorState error={error as Error} />;
  }

  const handleRecentCompanyClick = (id: string) => {
    navigate(`/ra/company/${id}`);
  };

  return (
    <div className="h-full overflow-auto" style={{ backgroundColor: DARK_BG }}>
      <style>{`
        @keyframes breathe {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        .status-dot-active {
          animation: breathe 2s ease-in-out infinite;
        }
      `}</style>

      {/* Page Container */}
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="border-b border-slate-800 pb-6">
          <h1 className="text-3xl font-bold text-white mb-2">
            Report Aziende — Dashboard
          </h1>
          <p className="text-sm text-slate-400">
            Gestione e monitoraggio prospect da reportaziende.it
          </p>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-4 gap-4">
          <KPICard
            icon={<Building2 className="w-5 h-5" />}
            label="Prospect Totali"
            value={stats.totalProspects}
            color="text-blue-400"
          />
          <KPICard
            icon={<Mail className="w-5 h-5" />}
            label="Con Email"
            value={stats.withEmail}
            color="text-emerald-400"
          />
          <KPICard
            icon={<FileText className="w-5 h-5" />}
            label="Con PEC"
            value={stats.withPec}
            color="text-teal-400"
          />
          <KPICard
            icon={<Phone className="w-5 h-5" />}
            label="Con Telefono"
            value={stats.withPhone}
            color="text-amber-400"
          />
        </div>

        {/* Two Column Grid */}
        <div className="grid grid-cols-2 gap-6">
          {/* Left: Top Sectors */}
          <div
            style={GLASS_CARD_STYLE}
            className="rounded-lg overflow-hidden"
          >
            <div className="p-6 border-b border-slate-800">
              <div className="flex items-center gap-2 mb-0.5">
                <TrendingUp className="w-4 h-4" style={{ color: CYAN_ACCENT }} />
                <h2 className="text-lg font-semibold text-white" style={{ fontFamily: "JetBrains Mono" }}>
                  SETTORI TOP
                </h2>
              </div>
              <p className="text-xs text-slate-400">Top 5 ATECO by prospect</p>
            </div>
            <div className="divide-y divide-slate-800">
              {(stats.topAteco ?? []).map((sector) => (
                <div
                  key={sector.code}
                  className="px-6 py-3 hover:bg-cyan-500/5 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-white group-hover:text-cyan-300 transition-colors" style={{ fontFamily: "Inter" }}>
                        {sector.description}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5" style={{ fontFamily: "JetBrains Mono" }}>
                        ATECO {sector.code}
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="secondary" className="text-xs">
                        {sector.count.toLocaleString("it-IT")}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Latest Acquisitions */}
          <div
            style={GLASS_CARD_STYLE}
            className="rounded-lg overflow-hidden"
          >
            <div className="p-6 border-b border-slate-800">
              <div className="flex items-center gap-2 mb-0.5">
                <Clock className="w-4 h-4" style={{ color: CYAN_ACCENT }} />
                <h2 className="text-lg font-semibold text-white" style={{ fontFamily: "JetBrains Mono" }}>
                  ULTIME ACQUISIZIONI
                </h2>
              </div>
              <p className="text-xs text-slate-400">
                Ultimi prospect importati
              </p>
            </div>
            <div className="divide-y divide-slate-800">
              {(stats.recentProspects ?? []).map((prospect) => (
                <div
                  key={prospect.id}
                  className="px-6 py-3 hover:bg-cyan-500/5 transition-colors cursor-pointer group"
                  onClick={() => handleRecentCompanyClick(prospect.id)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium text-white group-hover:text-cyan-300 transition-colors" style={{ fontFamily: "Inter" }}>
                      {prospect.company_name}
                    </div>
                    <span className="text-xs text-slate-500">
                      {formatRelativeTime(prospect.created_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-xs">
                      {prospect.city || "—"}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {prospect.codice_ateco || "—"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Actions Row */}
        <div className="flex gap-3">
          <Button
            size="lg"
            className="gap-2"
            style={{ backgroundColor: CYAN_ACCENT, color: "black" }}
            onClick={() => navigate("/v2/research/scraping")}
          >
            <Zap className="w-4 h-4" />
            Nuova Ricerca
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="gap-2 border-slate-700 hover:bg-slate-800/50"
            onClick={() => navigate("/v2/research/explorer")}
          >
            <Activity className="w-4 h-4" />
            Explorer ATECO
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="gap-2 border-slate-700 hover:bg-slate-800/50"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="gap-2 border-slate-700 hover:bg-slate-800/50"
          >
            <Filter className="w-4 h-4" />
            Filtri ATECO
          </Button>
        </div>

        {/* Bottom Section: Active Jobs */}
        <div
          style={GLASS_CARD_STYLE}
          className="rounded-lg overflow-hidden"
        >
          <div className="p-6 border-b border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4" style={{ color: PURPLE_ACCENT }} />
                <h2 className="text-lg font-semibold text-white" style={{ fontFamily: "JetBrains Mono" }}>
                  JOB IN CORSO
                </h2>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={activeJobsFilter === "all" ? "default" : "ghost"}
                  onClick={() => setActiveJobsFilter("all")}
                  className="text-xs"
                >
                  Tutti
                </Button>
                <Button
                  size="sm"
                  variant={activeJobsFilter === "running" ? "default" : "ghost"}
                  onClick={() => setActiveJobsFilter("running")}
                  className="text-xs"
                >
                  In Corso
                </Button>
                <Button
                  size="sm"
                  variant={activeJobsFilter === "completed" ? "default" : "ghost"}
                  onClick={() => setActiveJobsFilter("completed")}
                  className="text-xs"
                >
                  Completati
                </Button>
              </div>
            </div>
          </div>
          <div className="divide-y divide-slate-800">
            {filteredJobs.length === 0 ? (
              <div className="px-6 py-8 text-center text-slate-400">
                Nessun job trovato
              </div>
            ) : (
              filteredJobs.map((job) => {
                const progress = calculateJobProgress(job);
                const isRunning = job.status === "running";
                return (
                  <div key={job.id} className="px-6 py-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            isRunning ? "status-dot-active" : ""
                          }`}
                          style={{
                            backgroundColor: isRunning ? CYAN_ACCENT : "#666",
                          }}
                        />
                        <div>
                          <div className="text-sm font-medium text-white" style={{ fontFamily: "Inter" }}>
                            {job.job_type.replace(/_/g, " ").toUpperCase()}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {job.started_at
                              ? `Iniziato ${formatRelativeTime(job.started_at)}`
                              : "In attesa..."}
                          </div>
                        </div>
                      </div>
                      <Badge
                        variant={isRunning ? "secondary" : "outline"}
                        className={`text-xs ${
                          isRunning
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                            : "bg-slate-500/20 text-slate-300 border-slate-500/30"
                        }`}
                      >
                        {isRunning ? "In Corso" : "Completato"}
                      </Badge>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${progress}%`,
                          backgroundColor: isRunning ? CYAN_ACCENT : "#888",
                        }}
                      />
                    </div>
                    <div className="text-xs text-slate-400 mt-2 text-right">
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
