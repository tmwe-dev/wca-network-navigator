import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

// Mock data for Report Aziende dashboard
const mockStats = {
  totalProspects: 12847,
  withEmail: 8923,
  withPEC: 4156,
  withPhone: 7234,
};

const mockTopSectors = [
  { ateco: "45.20", name: "Manutenzione e riparazione di veicoli", count: 1240 },
  { ateco: "47.11", name: "Commercio al dettaglio in negozi", count: 1089 },
  { ateco: "41.20", name: "Costruzione di edifici", count: 956 },
  { ateco: "70.22", name: "Consulenza gestionale aziendale", count: 843 },
  { ateco: "62.01", name: "Programmazione informatica", count: 721 },
];

const mockRecentCompanies = [
  {
    id: "1",
    name: "TechSolutions S.p.A.",
    city: "Milano",
    ateco: "62.01",
    timestamp: new Date(Date.now() - 1000 * 60 * 5),
  },
  {
    id: "2",
    name: "BuildRight Costruzioni",
    city: "Roma",
    ateco: "41.20",
    timestamp: new Date(Date.now() - 1000 * 60 * 23),
  },
  {
    id: "3",
    name: "VeicAuto Manutenzione",
    city: "Torino",
    ateco: "45.20",
    timestamp: new Date(Date.now() - 1000 * 60 * 47),
  },
  {
    id: "4",
    name: "ConsultaGest Pro",
    city: "Firenze",
    ateco: "70.22",
    timestamp: new Date(Date.now() - 1000 * 60 * 92),
  },
  {
    id: "5",
    name: "RetailStore Premium",
    city: "Bologna",
    ateco: "47.11",
    timestamp: new Date(Date.now() - 1000 * 60 * 145),
  },
];

const mockActiveJobs = [
  {
    id: "job-1",
    name: "Scraping Settore Informatica",
    progress: 85,
    status: "running",
    startedAt: new Date(Date.now() - 1000 * 60 * 12),
  },
  {
    id: "job-2",
    name: "Update Email Addresses",
    progress: 60,
    status: "running",
    startedAt: new Date(Date.now() - 1000 * 60 * 28),
  },
  {
    id: "job-3",
    name: "Validazione PEC",
    progress: 100,
    status: "completed",
    startedAt: new Date(Date.now() - 1000 * 60 * 180),
  },
];

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "ora";
  if (diffMins < 60) return `${diffMins}m fa`;
  if (diffHours < 24) return `${diffHours}h fa`;
  return `${diffDays}d fa`;
}

interface KPICardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}

function KPICard({ icon, label, value, color }: KPICardProps) {
  return (
    <Card className="bg-slate-900/50 border-slate-800 hover:border-slate-700 transition-colors">
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className={`${color} text-lg`}>{icon}</span>
          <Badge variant="secondary" className="text-xs">
            {color === "text-emerald-400" ? "+2.4%" : "+0.8%"}
          </Badge>
        </div>
        <div className="text-2xl font-bold text-white mb-1">
          {value.toLocaleString()}
        </div>
        <div className="text-xs text-slate-400">{label}</div>
      </div>
    </Card>
  );
}

export default function RADashboard() {
  const [activeJobsFilter, setActiveJobsFilter] = useState<
    "all" | "running" | "completed"
  >("all");

  const filteredJobs =
    activeJobsFilter === "all"
      ? mockActiveJobs
      : mockActiveJobs.filter((j) => j.status === activeJobsFilter);

  return (
    <div className="h-full overflow-auto bg-background">
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
            value={mockStats.totalProspects}
            color="text-blue-400"
          />
          <KPICard
            icon={<Mail className="w-5 h-5" />}
            label="Con Email"
            value={mockStats.withEmail}
            color="text-emerald-400"
          />
          <KPICard
            icon={<FileText className="w-5 h-5" />}
            label="Con PEC"
            value={mockStats.withPEC}
            color="text-teal-400"
          />
          <KPICard
            icon={<Phone className="w-5 h-5" />}
            label="Con Telefono"
            value={mockStats.withPhone}
            color="text-amber-400"
          />
        </div>

        {/* Two Column Grid */}
        <div className="grid grid-cols-2 gap-6">
          {/* Left: Top Sectors */}
          <Card className="bg-slate-900/50 border-slate-800">
            <div className="p-6 border-b border-slate-800">
              <div className="flex items-center gap-2 mb-0.5">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <h2 className="text-lg font-semibold text-white">SETTORI TOP</h2>
              </div>
              <p className="text-xs text-slate-400">Top 5 ATECO by prospect</p>
            </div>
            <div className="divide-y divide-slate-800">
              {mockTopSectors.map((sector) => (
                <div
                  key={sector.ateco}
                  className="px-6 py-3 hover:bg-slate-800/50 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-white group-hover:text-emerald-300 transition-colors">
                        {sector.name}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        ATECO {sector.ateco}
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="secondary" className="text-xs">
                        {sector.count.toLocaleString()}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Right: Latest Acquisitions */}
          <Card className="bg-slate-900/50 border-slate-800">
            <div className="p-6 border-b border-slate-800">
              <div className="flex items-center gap-2 mb-0.5">
                <Clock className="w-4 h-4 text-blue-400" />
                <h2 className="text-lg font-semibold text-white">
                  ULTIME ACQUISIZIONI
                </h2>
              </div>
              <p className="text-xs text-slate-400">
                Ultimi 5 aziende scrape
              </p>
            </div>
            <div className="divide-y divide-slate-800">
              {mockRecentCompanies.map((company) => (
                <div
                  key={company.id}
                  className="px-6 py-3 hover:bg-slate-800/50 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium text-white group-hover:text-blue-300 transition-colors">
                      {company.name}
                    </div>
                    <span className="text-xs text-slate-500">
                      {formatRelativeTime(company.timestamp)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-xs">
                      {company.city}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {company.ateco}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Quick Actions Row */}
        <div className="flex gap-3">
          <Button size="lg" className="gap-2 bg-emerald-600 hover:bg-emerald-700">
            <Zap className="w-4 h-4" />
            Nuova Ricerca
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="gap-2 border-slate-700 hover:bg-slate-800/50"
          >
            <Activity className="w-4 h-4" />
            Scraping Batch
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
        <Card className="bg-slate-900/50 border-slate-800">
          <div className="p-6 border-b border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-amber-400" />
                <h2 className="text-lg font-semibold text-white">JOB IN CORSO</h2>
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
              filteredJobs.map((job) => (
                <div key={job.id} className="px-6 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="text-sm font-medium text-white">
                          {job.name}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Iniziato {formatRelativeTime(job.startedAt)}
                        </div>
                      </div>
                    </div>
                    <Badge
                      variant={
                        job.status === "running" ? "secondary" : "outline"
                      }
                      className={`text-xs ${
                        job.status === "running"
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                          : "bg-slate-500/20 text-slate-300 border-slate-500/30"
                      }`}
                    >
                      {job.status === "running" ? "In Corso" : "Completato"}
                    </Badge>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        job.status === "running"
                          ? "bg-emerald-500"
                          : "bg-slate-600"
                      }`}
                      style={{ width: `${job.progress}%` }}
                    />
                  </div>
                  <div className="text-xs text-slate-400 mt-2 text-right">
                    {job.progress}%
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
