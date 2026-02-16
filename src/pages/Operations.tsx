import { useState, useCallback, useMemo } from "react";
import { Sun, Moon, Globe, Users, Mail, Phone, Download, FolderDown, Play, FileText } from "lucide-react";
import { SpeedGauge } from "@/components/download/SpeedGauge";
import { ThemeCtx, t } from "@/components/download/theme";
import { WcaSessionIndicator } from "@/components/download/WcaSessionIndicator";
import { CountryGrid, type FilterKey } from "@/components/download/CountryGrid";
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
import { useDownloadJobs, useEmergencyStop, useResumeAllJobs } from "@/hooks/useDownloadJobs";
import { useDownloadProcessor } from "@/hooks/useDownloadProcessor";
import { useCountryStats } from "@/hooks/useCountryStats";
import { getCountryFlag } from "@/lib/countries";
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
  const [filterMode, setFilterMode] = useState<FilterKey>("all");
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
          {/* ═══ TOP BAR (compact) ═══ */}
          <div className="flex items-center justify-between px-4 py-1.5 flex-shrink-0">
            <div className="flex items-center gap-3">
              <h1 className={`text-sm font-semibold ${th.h1}`}>Operations</h1>
              {activeJobs.length > 0 && (
                <span className={`flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full ${isDark ? "bg-amber-500/15 text-amber-400 border border-amber-500/25" : "bg-sky-50 text-sky-600 border border-sky-200"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isDark ? "bg-amber-400" : "bg-sky-500"}`} />
                  {activeJobs.length} attivi
                </span>
              )}
              <SpeedGauge
                lastUpdatedAt={activeJobs.find(j => j.status === "running")?.updated_at ?? activeJobs[0]?.updated_at ?? null}
                onStop={() => { stopProcessor(); emergencyStopMutation.mutate(); }}
                idle={activeJobs.length === 0}
              />
            </div>
            <div className="flex items-center gap-2">
              <WcaSessionIndicator />
              {cancelledIncompleteJobs.length > 0 && activeJobs.length === 0 && (
                <button
                  onClick={() => { resetStop(); resumeAllMutation.mutate(); }}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all ${isDark ? "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30" : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200"}`}
                >
                  <Play className="w-3 h-3" />
                  RIAVVIA ({cancelledIncompleteJobs.length})
                </button>
              )}
              <button onClick={toggleTheme} className={`p-1.5 rounded-lg transition-all ${isDark ? "bg-slate-800/60 hover:bg-slate-700/60 text-amber-400" : "bg-white/80 hover:bg-white shadow-sm text-sky-600"}`}>
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* ═══ MAIN 3-COLUMN LAYOUT ═══ */}
          <div className="flex-1 flex min-h-0 px-4 pb-3 gap-3">
            {/* ── COL 1: Stats sidebar (narrow vertical) ── */}
            <div className={`w-[140px] flex-shrink-0 flex flex-col gap-2 overflow-auto rounded-xl border p-2 ${isDark ? "bg-white/[0.03] backdrop-blur-xl border-white/[0.08]" : "bg-white/50 backdrop-blur-xl border-white/80 shadow-sm"}`}>
              {globalStats ? (
                <>
                  <StatItem icon={Globe} label="Paesi" value={globalStats.scannedCountries} isDark={isDark} color={isDark ? "text-sky-400" : "text-sky-500"}
                    onClick={() => setFilterMode("all")} active={filterMode === "all"} />
                  <StatItem icon={Users} label="Partner" value={globalStats.totalPartners.toLocaleString()} isDark={isDark} color={isDark ? "text-emerald-400" : "text-emerald-500"}
                    onClick={() => setFilterMode("todo")} active={filterMode === "todo"} />
                  <StatItem icon={FileText} label="Profili" value={globalStats.withProfile.toLocaleString()} isDark={isDark} color={isDark ? "text-violet-400" : "text-violet-500"}
                    progress={globalStats.totalPartners > 0 ? Math.round((globalStats.withProfile / globalStats.totalPartners) * 100) : 0}
                    progressColor="from-violet-400 to-purple-500"
                    onClick={() => setFilterMode("no_profile")} active={filterMode === "no_profile"} />
                  <StatItem icon={Mail} label="Email" value={globalStats.withEmail.toLocaleString()} isDark={isDark} color={isDark ? "text-sky-400" : "text-sky-500"}
                    progress={globalStats.totalPartners > 0 ? Math.round((globalStats.withEmail / globalStats.totalPartners) * 100) : 0}
                    progressColor="from-sky-400 to-blue-500" />
                  <StatItem icon={Phone} label="Telefoni" value={globalStats.withPhone.toLocaleString()} isDark={isDark} color={isDark ? "text-teal-400" : "text-teal-500"}
                    progress={globalStats.totalPartners > 0 ? Math.round((globalStats.withPhone / globalStats.totalPartners) * 100) : 0}
                    progressColor="from-teal-400 to-emerald-500" />
                  <StatItem icon={FolderDown} label="Directory" value={(globalStats.totalDirectory ?? 0).toLocaleString()} isDark={isDark} color={isDark ? "text-amber-400" : "text-amber-500"}
                    onClick={() => setFilterMode("missing")} active={filterMode === "missing"} />
                </>
              ) : (
                Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className={`h-14 rounded-lg ${isDark ? "bg-white/[0.06]" : ""}`} />
                ))
              )}
            </div>

            {/* ── COL 2: Country Grid (responsive) ── */}
            <div className="min-w-[280px] w-[35%] max-w-[400px] flex-shrink-0 min-h-0 flex flex-col">
              <CountryGrid
                selected={selectedCountries}
                onToggle={toggleCountry}
                onRemove={removeCountry}
                filterMode={filterMode}
                directoryOnly={directoryOnly}
                onDirectoryOnlyChange={setDirectoryOnly}
              />
            </div>

            {/* ── COL 3: Contextual Panel (rest) ── */}
            <div className="flex-1 min-h-0 flex flex-col">
              {selectedCountries.length === 0 ? (
                <div className="flex-1 flex flex-col gap-3 overflow-auto">
                  <ActiveJobBar />
                  <DownloadTerminal />
                  <JobMonitor />
                  {!jobs?.some(j => j.status === "running" || j.status === "pending" || j.status === "paused") && (
                    <div className={`flex-1 flex items-center justify-center rounded-2xl border ${isDark ? "bg-white/[0.03] backdrop-blur-xl border-white/[0.08]" : "bg-white/50 backdrop-blur-xl border-white/80 shadow-sm"}`}>
                      <div className="text-center space-y-3">
                        <Globe className={`w-16 h-16 mx-auto ${isDark ? "text-white/10" : "text-slate-200"}`} />
                        <p className={`text-sm ${th.sub}`}>Seleziona un paese per iniziare</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
                  <div className={`flex items-center gap-3 px-4 py-2 rounded-t-2xl border border-b-0 ${isDark ? "bg-white/[0.04] backdrop-blur-xl border-white/[0.08]" : "bg-white/60 backdrop-blur-xl border-white/80"}`}>
                    <span className={`text-sm font-semibold ${th.h2}`}>{countryLabel}</span>
                    <TabsList className={`ml-auto ${isDark ? "bg-white/[0.06]" : "bg-slate-100/80"}`}>
                      <TabsTrigger value="partner" className="gap-1.5 text-xs">
                        <Users className="w-3.5 h-3.5" />Partner
                      </TabsTrigger>
                      <TabsTrigger value="download" className="gap-1.5 text-xs">
                        <Download className="w-3.5 h-3.5" />Scarica
                      </TabsTrigger>
                    </TabsList>
                  </div>
                  <ActiveJobBar />
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

/* ── Vertical Stat Item ── */
function StatItem({ icon: Icon, label, value, color, isDark, progress, progressColor, onClick, active }: {
  icon: any; label: string; value: string | number; color: string; isDark: boolean;
  progress?: number; progressColor?: string;
  onClick?: () => void; active?: boolean;
}) {
  const isClickable = !!onClick;
  const activeBorder = active
    ? isDark ? "border-sky-400/40 ring-1 ring-sky-400/20" : "border-sky-400 ring-1 ring-sky-300/40"
    : isDark ? "border-white/[0.06]" : "border-slate-200/60";
  const activeBg = active
    ? isDark ? "bg-sky-950/40" : "bg-sky-50/80"
    : isDark ? "bg-white/[0.03]" : "bg-white/40";

  return (
    <div
      onClick={onClick}
      className={`rounded-lg border p-2 transition-all duration-150 ${activeBg} ${activeBorder} ${isClickable ? "cursor-pointer hover:scale-[1.02]" : ""} ${isClickable && !active ? (isDark ? "hover:bg-white/[0.06]" : "hover:bg-white/60") : ""}`}
    >
      <div className="flex items-center gap-1.5 mb-0.5">
        <Icon className={`w-3.5 h-3.5 ${color}`} />
        <span className={`text-[9px] uppercase tracking-wider font-semibold ${isDark ? "text-slate-500" : "text-slate-400"}`}>{label}</span>
      </div>
      <span className={`text-lg font-mono font-extrabold leading-tight ${isDark ? "text-white" : "text-slate-800"}`}>{value}</span>
      {progress !== undefined && (
        <div className="mt-1 flex items-center gap-1">
          <div className={`flex-1 h-1 rounded-full overflow-hidden ${isDark ? "bg-white/[0.06]" : "bg-slate-200/60"}`}>
            <div className={`h-full rounded-full bg-gradient-to-r ${progressColor || "from-sky-400 to-blue-500"}`} style={{ width: `${progress}%` }} />
          </div>
          <span className={`text-[9px] font-mono font-bold ${color}`}>{progress}%</span>
        </div>
      )}
    </div>
  );
}

