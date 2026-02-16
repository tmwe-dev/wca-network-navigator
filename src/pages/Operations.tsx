import { useState, useCallback, useMemo } from "react";
import { Sun, Moon, Globe, Users, Mail, Phone, Download, Zap, ExternalLink, FolderDown, Play, FileText, UserCheck } from "lucide-react";
import { SpeedGauge } from "@/components/download/SpeedGauge";
import { ThemeCtx, t } from "@/components/download/theme";
import { WcaSessionIndicator } from "@/components/download/WcaSessionIndicator";
import { CountryGrid } from "@/components/download/CountryGrid";
import { ActionPanel } from "@/components/download/ActionPanel";
import { JobMonitor } from "@/components/download/JobMonitor";
import { DownloadTerminal } from "@/components/download/DownloadTerminal";
import { ActiveJobBar } from "@/components/download/ActiveJobBar";
import { AdvancedTools } from "@/components/download/AdvancedTools";
import { ResyncConfigure } from "@/components/download/ResyncConfigure";
import { PartnerListPanel } from "@/components/operations/PartnerListPanel";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDownloadJobs, useEmergencyStop, useResumeAllJobs } from "@/hooks/useDownloadJobs";
import { useDownloadProcessor } from "@/hooks/useDownloadProcessor";
import { useCountryStats } from "@/hooks/useCountryStats";
import { getCountryFlag } from "@/lib/countries";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

function useDirectoryTotal() {
  return useQuery({
    queryKey: ["ops-directory-total"],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_directory_counts");
      const rows = (data || []) as any[];
      return {
        scannedCountries: rows.length,
        totalDirectory: rows.reduce((sum: number, r: any) => sum + (Number(r.member_count) || 0), 0),
      };
    },
    staleTime: 60_000,
  });
}

export default function Operations() {
  const [isDark, setIsDark] = useState(() => {
    const s = localStorage.getItem("dl_theme");
    return s !== null ? s === "dark" : true;
  });
  const toggleTheme = () => setIsDark(p => { const n = !p; localStorage.setItem("dl_theme", n ? "dark" : "light"); return n; });

  const [selectedCountries, setSelectedCountries] = useState<{ code: string; name: string }[]>([]);
  const [activeTab, setActiveTab] = useState("partner");
  const [directoryOnly, setDirectoryOnly] = useState(false);
  const { data: countryStatsData } = useCountryStats();
  const { data: dirData } = useDirectoryTotal();
  const globalStats = countryStatsData ? {
    totalPartners: countryStatsData.global.total,
    withEmail: countryStatsData.global.withEmail,
    withPhone: countryStatsData.global.withPhone,
    withProfile: countryStatsData.global.withProfile,
    withoutProfile: countryStatsData.global.withoutProfile,
    scannedCountries: dirData?.scannedCountries || 0,
    totalDirectory: dirData?.totalDirectory || 0,
  } : null;
  const { data: jobs } = useDownloadJobs();
  const emergencyStopMutation = useEmergencyStop();
  const resumeAllMutation = useResumeAllJobs();
  const { emergencyStop: stopProcessor, resetStop } = useDownloadProcessor();

  const activeJobs = useMemo(() => (jobs || []).filter(j => j.status === "running" || j.status === "pending"), [jobs]);
  const cancelledIncompleteJobs = useMemo(() => (jobs || []).filter(j => j.status === "cancelled" && j.current_index < j.total_count), [jobs]);
  const countryJobs = useMemo(() => {
    if (selectedCountries.length === 0) return jobs || [];
    const codes = new Set(selectedCountries.map(c => c.code));
    return (jobs || []).filter(j => codes.has(j.country_code));
  }, [jobs, selectedCountries]);

  const toggleCountry = useCallback((code: string, name: string) => {
    setSelectedCountries(prev =>
      prev.some(c => c.code === code)
        ? prev.filter(c => c.code !== code)
        : [...prev, { code, name }]
    );
  }, []);

  const removeCountry = useCallback((code: string) => {
    setSelectedCountries(prev => prev.filter(c => c.code !== code));
  }, []);

  const th = t(isDark);

  const countryLabel = selectedCountries.length === 0
    ? "Seleziona un paese"
    : selectedCountries.length === 1
      ? `${getCountryFlag(selectedCountries[0].code)} ${selectedCountries[0].name}`
      : `${selectedCountries.length} paesi selezionati`;

  return (
    <ThemeCtx.Provider value={isDark}>
      <div className={`h-[calc(100vh-4rem)] relative overflow-hidden -m-6 ${th.pageBg}`} style={{ overscrollBehavior: 'contain' }}>
        <div className={`absolute inset-0 bg-gradient-to-br ${th.pageGrad1}`} />
        <div className={`absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] ${th.pageGrad2} via-transparent to-transparent`} />
        <div className={`absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] ${isDark ? "from-violet-500/[0.03]" : "from-sky-200/20"} via-transparent to-transparent animate-pulse`} style={{ animationDuration: '10s' }} />

        <div className="relative z-10 h-full flex flex-col">
          {/* ═══ TOP BAR ═══ */}
          <div className="flex items-center justify-between px-6 py-2 flex-shrink-0">
            <div className="flex items-center gap-3">
              <h1 className={`text-lg font-semibold ${th.h1}`}>Operations Center</h1>
              {activeJobs.length > 0 && (
                <span className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${isDark ? "bg-amber-500/15 text-amber-400 border border-amber-500/25" : "bg-sky-50 text-sky-600 border border-sky-200"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isDark ? "bg-amber-400" : "bg-sky-500"}`} />
                  {activeJobs.length} job attivi
                </span>
              )}
              <SpeedGauge
                lastUpdatedAt={activeJobs.find(j => j.status === "running")?.updated_at ?? activeJobs[0]?.updated_at ?? null}
                onStop={() => { stopProcessor(); emergencyStopMutation.mutate(); }}
                idle={activeJobs.length === 0}
              />
            </div>
            <div className="flex items-center gap-3">
              <WcaSessionIndicator />
              {cancelledIncompleteJobs.length > 0 && activeJobs.length === 0 && (
                <button
                  onClick={() => { resetStop(); resumeAllMutation.mutate(); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${isDark ? "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30" : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200"}`}
                >
                  <Play className="w-3.5 h-3.5" />
                  RIAVVIA TUTTI ({cancelledIncompleteJobs.length})
                </button>
              )}
              <button onClick={toggleTheme} className={`p-2 rounded-xl transition-all ${isDark ? "bg-slate-800/60 hover:bg-slate-700/60 text-amber-400" : "bg-white/80 hover:bg-white shadow-sm text-sky-600"}`}>
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* ═══ DASHBOARD 6 CARDS ═══ */}
          <div className="flex-shrink-0 mx-6 mb-3">
            {globalStats ? (
              <div className="grid grid-cols-6 gap-2.5">
                <DashCard icon={Globe} label="Paesi scansionati" value={globalStats.scannedCountries} isDark={isDark} color={isDark ? "text-sky-400" : "text-sky-500"} />
                <DashCard icon={Users} label="Partner nel DB" value={globalStats.totalPartners.toLocaleString()} isDark={isDark} color={isDark ? "text-emerald-400" : "text-emerald-500"} />
                <DashCard icon={FileText} label="Con profilo" value={globalStats.withProfile.toLocaleString()} isDark={isDark} color={isDark ? "text-violet-400" : "text-violet-500"}
                  progress={globalStats.totalPartners > 0 ? Math.round((globalStats.withProfile / globalStats.totalPartners) * 100) : 0}
                  progressColor="from-violet-400 to-purple-500" />
                <DashCard icon={Mail} label="Email trovate" value={globalStats.withEmail.toLocaleString()} isDark={isDark} color={isDark ? "text-sky-400" : "text-sky-500"}
                  progress={globalStats.totalPartners > 0 ? Math.round((globalStats.withEmail / globalStats.totalPartners) * 100) : 0}
                  progressColor="from-sky-400 to-blue-500" />
                <DashCard icon={Phone} label="Telefoni" value={globalStats.withPhone.toLocaleString()} isDark={isDark} color={isDark ? "text-teal-400" : "text-teal-500"}
                  progress={globalStats.totalPartners > 0 ? Math.round((globalStats.withPhone / globalStats.totalPartners) * 100) : 0}
                  progressColor="from-teal-400 to-emerald-500" />
                <DashCard icon={FolderDown} label="In directory WCA" value={(globalStats.totalDirectory ?? 0).toLocaleString()} isDark={isDark} color={isDark ? "text-amber-400" : "text-amber-500"} />
              </div>
            ) : (
              <div className="grid grid-cols-6 gap-2.5">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className={`h-20 rounded-xl ${isDark ? "bg-white/[0.06]" : ""}`} />
                ))}
              </div>
            )}
          </div>

          {/* ═══ MAIN SPLIT ═══ */}
          <div className="flex-1 flex min-h-0 px-6 pb-4 gap-4">
            {/* LEFT: Country Grid (35%) */}
            <div className="w-[35%] min-h-0 flex flex-col">
              <CountryGrid
                selected={selectedCountries}
                onToggle={toggleCountry}
                onRemove={removeCountry}
                directoryOnly={directoryOnly}
                onDirectoryOnlyChange={setDirectoryOnly}
              />
            </div>

            {/* RIGHT: Contextual Panel (65%) */}
            <div className="flex-1 min-h-0 flex flex-col">
          {selectedCountries.length === 0 ? (
                /* ── No country: Global Overview with always-visible monitoring ── */
                <div className="flex-1 flex flex-col gap-3 overflow-auto">
                  {/* Active Job Bar always visible */}
                  <ActiveJobBar />
                  {/* Terminal always visible */}
                  <DownloadTerminal />
                  {/* Job Monitor always visible */}
                  <JobMonitor />
                  {/* Empty state hint if no jobs */}
                  {!jobs?.some(j => j.status === "running" || j.status === "pending" || j.status === "paused") && (
                    <div className={`flex-1 flex items-center justify-center rounded-2xl border ${isDark ? "bg-white/[0.03] backdrop-blur-xl border-white/[0.08]" : "bg-white/50 backdrop-blur-xl border-white/80 shadow-sm"}`}>
                      <div className="text-center space-y-3">
                        <Globe className={`w-16 h-16 mx-auto ${isDark ? "text-white/10" : "text-slate-200"}`} />
                        <p className={`text-sm ${th.sub}`}>Seleziona un paese per visualizzare partner o avviare download</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* ── Country selected: Tabbed Panel ── */
                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
                  {/* Tab header with country info */}
                  <div className={`flex items-center gap-3 px-4 py-2 rounded-t-2xl border border-b-0 ${isDark ? "bg-white/[0.04] backdrop-blur-xl border-white/[0.08]" : "bg-white/60 backdrop-blur-xl border-white/80"}`}>
                    <span className={`text-sm font-semibold ${th.h2}`}>{countryLabel}</span>
                    <TabsList className={`ml-auto ${isDark ? "bg-white/[0.06]" : "bg-slate-100/80"}`}>
                      <TabsTrigger value="partner" className="gap-1.5 text-xs">
                        <Users className="w-3.5 h-3.5" />Partner
                      </TabsTrigger>
                      <TabsTrigger value="download" className="gap-1.5 text-xs">
                        <Download className="w-3.5 h-3.5" />Scarica
                      </TabsTrigger>
                      <TabsTrigger value="acquire" className="gap-1.5 text-xs">
                        <Zap className="w-3.5 h-3.5" />Acquisisci
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  {/* Always-visible ActiveJobBar */}
                  <ActiveJobBar />

                  {/* Tab Content */}
                  <div className={`flex-1 min-h-0 rounded-b-2xl border border-t-0 overflow-hidden ${isDark ? "bg-white/[0.02] backdrop-blur-xl border-white/[0.08]" : "bg-white/40 backdrop-blur-xl border-white/80"}`}>
                    <TabsContent value="partner" className="h-full m-0 data-[state=inactive]:hidden">
                      <PartnerListPanel
                        countryCodes={selectedCountries.map(c => c.code)}
                        countryNames={selectedCountries.map(c => c.name)}
                        isDark={isDark}
                      />
                    </TabsContent>

                    <TabsContent value="download" className="h-full m-0 overflow-auto p-4 space-y-4 data-[state=inactive]:hidden">
                      <ActionPanel selectedCountries={selectedCountries} directoryOnly={directoryOnly} onDirectoryOnlyChange={setDirectoryOnly} onJobStarting={resetStop} />
                      <DownloadTerminal />
                      <JobMonitor />
                      <AdvancedTools isDark={isDark} />
                    </TabsContent>

                    <TabsContent value="acquire" className="h-full m-0 data-[state=inactive]:hidden">
                      <AcquisitionLink isDark={isDark} />
                    </TabsContent>
                  </div>
                </Tabs>
              )}
            </div>
          </div>
        </div>
      </div>
    </ThemeCtx.Provider>
  );
}

function DashCard({ icon: Icon, label, value, color, isDark, progress, progressColor }: {
  icon: any; label: string; value: string | number; color: string; isDark: boolean;
  progress?: number; progressColor?: string;
}) {
  return (
    <div className={`rounded-xl border p-3 ${isDark ? "bg-white/[0.04] backdrop-blur-xl border-white/[0.08]" : "bg-white/60 backdrop-blur-xl border-white/80 shadow-sm"}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-5 h-5 ${color}`} />
        <span className={`text-[10px] uppercase tracking-wider font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>{label}</span>
      </div>
      <span className={`text-xl font-mono font-extrabold ${isDark ? "text-white" : "text-slate-800"}`}>{value}</span>
      {progress !== undefined && (
        <div className="mt-1.5 flex items-center gap-1.5">
          <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${isDark ? "bg-white/[0.06]" : "bg-slate-200/60"}`}>
            <div className={`h-full rounded-full bg-gradient-to-r ${progressColor || "from-sky-400 to-blue-500"}`} style={{ width: `${progress}%` }} />
          </div>
          <span className={`text-[10px] font-mono font-bold ${color}`}>{progress}%</span>
        </div>
      )}
    </div>
  );
}

/* ── Acquisition Link (replaces old iframe embed) ── */
function AcquisitionLink({ isDark }: { isDark: boolean }) {
  const th = t(isDark);
  return (
    <div className="h-full flex items-center justify-center p-6">
      <div className="text-center space-y-4 max-w-md">
        <Zap className={`w-16 h-16 mx-auto ${isDark ? "text-white/10" : "text-slate-200"}`} />
        <h3 className={`text-lg font-semibold ${th.h2}`}>Pipeline di Acquisizione</h3>
        <p className={`text-sm ${th.sub}`}>
          L'acquisizione utilizza l'estensione Chrome per estrarre i contatti direttamente dal browser WCA. Assicurati che sia installata e la sessione WCA attiva.
        </p>
        <div className={`p-3 rounded-xl border text-xs ${isDark ? "bg-amber-500/10 border-amber-500/20 text-amber-300" : "bg-sky-50/80 border-sky-200/60 text-sky-700"}`}>
          💡 Per avviare l'acquisizione, usa la pagina dedicata con tutti i controlli avanzati.
        </div>
        <Link
          to="/acquisizione"
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${th.btnPri}`}
        >
          <ExternalLink className="w-4 h-4" />
          Apri Acquisizione Partner
        </Link>
      </div>
    </div>
  );
}
