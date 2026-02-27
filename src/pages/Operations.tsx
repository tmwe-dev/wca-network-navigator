import { useState, useCallback, useMemo } from "react";
import { Sun, Moon, Users, Bot, X } from "lucide-react";
import { AiAssistantDialog } from "@/components/operations/AiAssistantDialog";
import { SpeedGauge } from "@/components/download/SpeedGauge";
import { ThemeCtx, t } from "@/components/download/theme";
import { WcaSessionIndicator } from "@/components/download/WcaSessionIndicator";
import { CountryGrid, type FilterKey } from "@/components/download/CountryGrid";
import { ActiveJobBar } from "@/components/download/ActiveJobBar";
import { DownloadTerminal } from "@/components/download/DownloadTerminal";
import { JobMonitor } from "@/components/download/JobMonitor";
import { PartnerListPanel } from "@/components/operations/PartnerListPanel";
import { PartnerDetailCompact } from "@/components/partners/PartnerDetailCompact";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useDownloadJobs } from "@/hooks/useDownloadJobs";
import { useDownloadProcessor } from "@/hooks/useDownloadProcessor";
import { useCountryStats } from "@/hooks/useCountryStats";
import { usePartner, useToggleFavorite } from "@/hooks/usePartners";
import { getCountryFlag } from "@/lib/countries";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Read directory totals */
function useDirectoryTotal() {
  return useQuery({
    queryKey: ["cache-data-by-country"],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_directory_counts");
      const result: Record<string, { count: number; verified: boolean }> = {};
      (data || []).forEach((r: any) => {
        result[r.country_code] = { count: Number(r.member_count) || 0, verified: r.is_verified === true };
      });
      return result;
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

  const [activeCountry, setActiveCountry] = useState<{ code: string; name: string } | null>(null);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [directoryOnly, setDirectoryOnly] = useState(false);
  const [filterMode, setFilterMode] = useState<FilterKey>("all");
  const [aiOpen, setAiOpen] = useState(false);
  const [deepSearchRunning, setDeepSearchRunning] = useState(false);
  const [aliasGenerating, setAliasGenerating] = useState(false);
  const queryClient = useQueryClient();
  const { data: countryStatsData } = useCountryStats();
  const { data: dirData } = useDirectoryTotal();
  const dirTotals = dirData ? {
    scannedCountries: Object.keys(dirData).length,
    totalDirectory: Object.values(dirData).reduce((sum, v) => sum + v.count, 0),
  } : null;
  const globalStats = countryStatsData ? {
    totalPartners: countryStatsData.global.total,
    withEmail: countryStatsData.global.withEmail,
    withPhone: countryStatsData.global.withPhone,
    withProfile: countryStatsData.global.withProfile,
    withoutProfile: countryStatsData.global.withoutProfile,
    scannedCountries: dirTotals?.scannedCountries || 0,
    totalDirectory: dirTotals?.totalDirectory || 0,
  } : null;
  const { data: jobs } = useDownloadJobs();
  const { emergencyStop, startJob } = useDownloadProcessor();
  const toggleFavorite = useToggleFavorite();

  const activeJobs = useMemo(() => (jobs || []).filter(j => j.status === "running" || j.status === "pending"), [jobs]);

  const activeCountryCode = activeCountry?.code || "";

  const { data: selectedPartner } = usePartner(selectedPartnerId || "");

  const handleCountryClick = useCallback((code: string, name: string) => {
    setActiveCountry(prev => prev?.code === code ? null : { code, name });
    setSelectedPartnerId(null);
  }, []);

  const handleDeepSearch = useCallback(async (partnerIds: string[]) => {
    if (deepSearchRunning || partnerIds.length === 0) return;
    setDeepSearchRunning(true);
    let done = 0;
    try {
      for (const id of partnerIds) {
        done++;
        toast.loading(`Deep Search ${done}/${partnerIds.length}...`, { id: "deep-search-ops" });
        const { error } = await supabase.functions.invoke("deep-search-partner", { body: { partnerId: id } });
        if (error) console.error("Deep search error for", id, error);
      }
      toast.success(`Deep Search completata: ${done} partner`, { id: "deep-search-ops" });
      queryClient.invalidateQueries({ queryKey: ["partners"] });
    } catch (e: any) {
      toast.error(e?.message || "Errore Deep Search", { id: "deep-search-ops" });
    } finally {
      setDeepSearchRunning(false);
    }
  }, [deepSearchRunning, queryClient]);

  const handleGenerateAliases = useCallback(async (codes: string[], type: "company" | "contact") => {
    if (aliasGenerating) return;
    setAliasGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-aliases", { body: { countryCodes: codes } });
      if (error) throw error;
      if (data?.success) {
        toast.success(`Alias generati: ${data.processed} aziende, ${data.contacts} contatti`);
        queryClient.invalidateQueries({ queryKey: ["partners"] });
      } else {
        toast.error(data?.error || "Errore generazione alias");
      }
    } catch (e: any) {
      toast.error(e?.message || "Errore");
    } finally {
      setAliasGenerating(false);
    }
  }, [aliasGenerating, queryClient]);

  const th = t(isDark);

  return (
    <ThemeCtx.Provider value={isDark}>
      <div className={`h-full relative flex flex-col ${th.pageBg}`} style={{ overscrollBehavior: 'contain' }}>
        <div className={`absolute inset-0 bg-gradient-to-br ${th.pageGrad1}`} />
        <div className={`absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] ${th.pageGrad2} via-transparent to-transparent`} />
        <div className={`absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] ${isDark ? "from-violet-500/[0.03]" : "from-sky-200/20"} via-transparent to-transparent animate-pulse`} style={{ animationDuration: '10s' }} />

        <div className="relative z-10 flex-1 min-h-0 flex flex-col">
          {/* ═══ TOP BAR ═══ */}
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
                onStop={() => emergencyStop()}
                idle={activeJobs.length === 0}
              />
            </div>
            <div className="flex items-center gap-2">
              <WcaSessionIndicator />
              <button onClick={() => setAiOpen(true)} className={`p-1.5 rounded-lg transition-all ${isDark ? "bg-violet-500/20 hover:bg-violet-500/30 text-violet-400" : "bg-violet-50 hover:bg-violet-100 text-violet-600 shadow-sm"}`} title="Assistente AI">
                <Bot className="w-4 h-4" />
              </button>
              <button onClick={toggleTheme} className={`p-1.5 rounded-lg transition-all ${isDark ? "bg-slate-800/60 hover:bg-slate-700/60 text-amber-400" : "bg-white/80 hover:bg-white shadow-sm text-sky-600"}`}>
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* ═══ STATS STRIP ═══ */}
          {globalStats && (() => {
            const missingProfile = globalStats.totalPartners - globalStats.withProfile;
            const missingEmail = globalStats.totalPartners - globalStats.withEmail;
            const missingPhone = globalStats.totalPartners - globalStats.withPhone;
            const dot = isDark ? "text-white/10" : "text-slate-200";
            return (
            <div className={cn("flex items-center gap-3 px-4 py-1 flex-shrink-0 text-sm", isDark ? "text-slate-500" : "text-slate-400")}>
              <StatsChip emoji="🌍" value={globalStats.scannedCountries} label="paesi" isDark={isDark} onClick={() => setFilterMode("all")} active={filterMode === "all"} />
              <span className={dot}>·</span>
              <StatsChip emoji="👥" value={globalStats.totalPartners.toLocaleString()} label="partner" isDark={isDark} onClick={() => setFilterMode("todo")} active={filterMode === "todo"} />
              <span className={dot}>·</span>
              <MissingChip emoji="📄" label="Profilo" missing={missingProfile} isDark={isDark} onClick={() => setFilterMode("no_profile")} active={filterMode === "no_profile"} />
              <span className={dot}>·</span>
              <MissingChip emoji="✉️" label="Email" missing={missingEmail} isDark={isDark} />
              <span className={dot}>·</span>
              <MissingChip emoji="📞" label="Tel" missing={missingPhone} isDark={isDark} />
              <span className={dot}>·</span>
              <StatsChip emoji="📁" value={(globalStats.totalDirectory ?? 0).toLocaleString()} label="directory" isDark={isDark} onClick={() => setFilterMode("missing")} active={filterMode === "missing"} />
            </div>);
          })()}

          {/* ═══ MAIN: Country Grid + Partner List + Detail ═══ */}
          <div className="flex-1 min-h-0 px-4 pb-3 flex gap-3">
            {/* LEFT: Country Grid (fixed width) */}
            <div className={cn(
              "flex-shrink-0 min-h-0 flex flex-col gap-2 transition-all duration-200",
              activeCountry ? "w-[260px]" : "w-full"
            )}>
              <CountryGrid
                selected={activeCountry ? [activeCountry] : []}
                onToggle={handleCountryClick}
                onRemove={() => { setActiveCountry(null); setSelectedPartnerId(null); }}
                filterMode={filterMode}
                directoryOnly={directoryOnly}
                onDirectoryOnlyChange={setDirectoryOnly}
              />
              {activeJobs.length > 0 && !activeCountry && (
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <ActiveJobBar />
                  <DownloadTerminal />
                  <JobMonitor />
                </div>
              )}
            </div>

            {/* CENTER: Partner List + Detail overlay */}
            {activeCountry && (
              <div className="flex-1 min-w-0 min-h-0 flex flex-col gap-2 animate-in fade-in slide-in-from-right-4 duration-200">
                <ActiveJobBar />
                <div className={cn(
                  "flex-1 min-h-0 rounded-2xl border overflow-hidden relative",
                  isDark ? "bg-white/[0.02] backdrop-blur-xl border-white/[0.08]" : "bg-white/40 backdrop-blur-xl border-white/80 shadow-sm"
                )}>
                  <PartnerListPanel
                    countryCode={activeCountryCode}
                    countryName={activeCountry.name}
                    isDark={isDark}
                    onDeepSearch={handleDeepSearch}
                    onGenerateAliases={handleGenerateAliases}
                    deepSearchRunning={deepSearchRunning}
                    aliasGenerating={aliasGenerating}
                    onJobCreated={startJob}
                    directoryOnly={directoryOnly}
                    onDirectoryOnlyChange={setDirectoryOnly}
                    onSelectPartner={setSelectedPartnerId}
                    selectedPartnerId={selectedPartnerId}
                  />

                  {/* Detail overlay slide-in */}
                  {selectedPartnerId && selectedPartner && (
                    <div className={cn(
                      "absolute inset-0 z-20 flex flex-col animate-in slide-in-from-right-8 duration-200",
                      isDark ? "bg-slate-950/95 backdrop-blur-xl" : "bg-white/95 backdrop-blur-xl"
                    )}>
                      <div className={cn("flex items-center px-3 py-1.5 flex-shrink-0 border-b", isDark ? "border-white/[0.08]" : "border-slate-200/60")}>
                        <button onClick={() => setSelectedPartnerId(null)}
                          className={cn("flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-lg transition-colors",
                            isDark ? "text-slate-400 hover:text-slate-200 hover:bg-white/[0.06]" : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                          )}>
                          <X className="w-4 h-4" /> Chiudi
                        </button>
                      </div>
                      <div className="flex-1 min-h-0 overflow-auto">
                        <PartnerDetailCompact
                          partner={selectedPartner}
                          onBack={() => setSelectedPartnerId(null)}
                          onToggleFavorite={() => toggleFavorite.mutate({ id: selectedPartner.id, isFavorite: !selectedPartner.is_favorite })}
                          isDark={isDark}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <AiAssistantDialog open={aiOpen} onClose={() => setAiOpen(false)} context={{ selectedCountries: activeCountry ? [activeCountry] : [], filterMode }} />
    </ThemeCtx.Provider>
  );
}

/* ── Inline Stats Chip ── */
function StatsChip({ emoji, value, label, isDark, pct, onClick, active }: {
  emoji: string; value: string | number; label: string; isDark: boolean;
  pct?: number; onClick?: () => void; active?: boolean;
}) {
  const isClickable = !!onClick;
  return (
    <span
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap transition-all duration-150",
        isClickable ? "cursor-pointer hover:opacity-80" : "",
        active ? (isDark ? "text-sky-400" : "text-sky-600") : ""
      )}
    >
      <span>{emoji}</span>
      <span className={cn("font-semibold tabular-nums", isDark ? "text-slate-200" : "text-slate-700")}>{value}</span>
      <span>{label}</span>
      {pct !== undefined && (
        <span className={cn("tabular-nums", isDark ? "text-slate-600" : "text-slate-300")}>({pct}%)</span>
      )}
    </span>
  );
}

/* ── Missing Chip (shows count of MISSING items, green checkmark when 0) ── */
function MissingChip({ emoji, label, missing, isDark, onClick, active }: {
  emoji: string; label: string; missing: number; isDark: boolean;
  onClick?: () => void; active?: boolean;
}) {
  const isClickable = !!onClick;
  const isComplete = missing === 0;
  return (
    <span
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap transition-all duration-150",
        isClickable ? "cursor-pointer hover:opacity-80" : "",
        active ? (isDark ? "text-sky-400" : "text-sky-600") : ""
      )}
    >
      <span>{emoji}</span>
      {isComplete ? (
        <span className={isDark ? "text-emerald-400 font-semibold" : "text-emerald-600 font-semibold"}>✓ {label}</span>
      ) : (
        <>
          <span className={isDark ? "text-slate-500" : "text-slate-400"}>Senza {label}</span>
          <span className={cn("font-semibold tabular-nums", isDark ? "text-slate-200" : "text-slate-700")}>{missing.toLocaleString()}</span>
        </>
      )}
    </span>
  );
}
