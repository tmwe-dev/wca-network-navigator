import { useState, useEffect, useCallback, useMemo } from "react";
import { Sun, Moon, Building2, Mail, Phone, Euro, FileText, Download, Search, X } from "lucide-react";
import { ThemeCtx, t } from "@/components/download/theme";
import { AtecoGrid } from "@/components/prospects/AtecoGrid";
import { ProspectListPanel } from "@/components/prospects/ProspectListPanel";
import { ProspectImporter } from "@/components/prospects/ProspectImporter";
import { ProspectAdvancedFilters, EMPTY_FILTERS, type ProspectFilters } from "@/components/prospects/ProspectAdvancedFilters";
import { Input } from "@/components/ui/input";
import { useProspectStats } from "@/hooks/useProspectStats";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PROVINCE_ITALIANE } from "@/data/italianProvinces";

function formatCurrency(n: number | null) {
  if (n == null) return "—";
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `€${(n / 1_000).toFixed(0)}K`;
  return `€${n.toFixed(0)}`;
}

function StatItem({ icon: Icon, label, value, color, isDark }: { icon: any; label: string; value: string | number; color: string; isDark: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className={`w-4 h-4 ${color}`} />
      <span className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>{label}</span>
      <span className={`text-sm font-mono font-bold ${isDark ? "text-white" : "text-slate-800"}`}>{value}</span>
    </div>
  );
}

export default function ProspectCenter() {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("dl_theme", next ? "dark" : "light");
    setIsDark(next);
  };

  const [selectedAteco, setSelectedAteco] = useState<string[]>([]);
  const [regionFilter, setRegionFilter] = useState<string[]>([]);
  const [provinceFilter, setProvinceFilter] = useState<string[]>([]);
  const [advFilters, setAdvFilters] = useState<ProspectFilters>(EMPTY_FILTERS);
  const [quickSearch, setQuickSearch] = useState("");

  const { data: stats } = useProspectStats();

  const toggleAteco = useCallback((code: string) => {
    setSelectedAteco(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);
  }, []);

  const removeAteco = useCallback((code: string) => {
    setSelectedAteco(prev => prev.filter(c => c !== code));
  }, []);

  const selectMultipleAteco = useCallback((codes: string[]) => {
    setSelectedAteco(prev => {
      const set = new Set(prev);
      for (const c of codes) set.add(c);
      return Array.from(set);
    });
  }, []);

  const th = t(isDark);

  // Convert array filters to single string for ProspectListPanel compatibility
  const regionFilterStr = regionFilter.join(",");
  const provinceFilterStr = provinceFilter.join(",");

  return (
    <ThemeCtx.Provider value={isDark}>
      <div className={`h-[calc(100vh-4rem)] relative overflow-hidden -m-6 ${th.pageBg}`} style={{ overscrollBehavior: 'contain' }}>
        <div className={`absolute inset-0 bg-gradient-to-br ${th.pageGrad1}`} />
        <div className={`absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] ${th.pageGrad2} via-transparent to-transparent`} />
        <div className={`absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] ${isDark ? "from-violet-500/[0.03]" : "from-sky-200/20"} via-transparent to-transparent animate-pulse`} style={{ animationDuration: '10s' }} />

        <div className="relative z-10 h-full flex flex-col">
          {/* TOP BAR */}
          <div className="flex items-center justify-between px-6 py-2 flex-shrink-0">
            <div className="flex items-center gap-3">
              <h1 className={`text-lg font-semibold ${th.h1}`}>Prospect Center</h1>
              <span className={`text-xs px-2.5 py-1 rounded-full ${isDark ? "bg-sky-500/15 text-sky-400 border border-sky-500/25" : "bg-sky-50 text-sky-600 border border-sky-200"}`}>
                Report Aziende
              </span>
            </div>
            <button onClick={toggleTheme} className={`p-2 rounded-xl transition-all ${isDark ? "bg-slate-800/60 hover:bg-slate-700/60 text-amber-400" : "bg-white/80 hover:bg-white shadow-sm text-sky-600"}`}>
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>

          {/* GLOBAL STATS BAR */}
          {stats && stats.total > 0 && (
            <div className="flex-shrink-0 mx-6 mb-3">
              <div className={`flex items-center justify-center gap-8 px-6 py-2.5 rounded-2xl border ${isDark ? "bg-white/[0.03] backdrop-blur-xl border-white/[0.08]" : "bg-white/50 backdrop-blur-xl border-white/80 shadow-sm"}`}>
                <StatItem icon={Building2} label="Prospect" value={stats.total.toLocaleString()} color={isDark ? "text-sky-400" : "text-sky-500"} isDark={isDark} />
                <div className={`w-px h-4 ${isDark ? "bg-white/10" : "bg-slate-200"}`} />
                <StatItem icon={Mail} label="Email" value={stats.withEmail.toLocaleString()} color={isDark ? "text-emerald-400" : "text-emerald-500"} isDark={isDark} />
                <div className={`w-px h-4 ${isDark ? "bg-white/10" : "bg-slate-200"}`} />
                <StatItem icon={Mail} label="PEC" value={stats.withPec.toLocaleString()} color={isDark ? "text-teal-400" : "text-teal-500"} isDark={isDark} />
                <div className={`w-px h-4 ${isDark ? "bg-white/10" : "bg-slate-200"}`} />
                <StatItem icon={Phone} label="Telefoni" value={stats.withPhone.toLocaleString()} color={isDark ? "text-sky-400" : "text-sky-500"} isDark={isDark} />
                <div className={`w-px h-4 ${isDark ? "bg-white/10" : "bg-slate-200"}`} />
                <StatItem icon={Euro} label="Fatturato Medio" value={formatCurrency(stats.avgFatturato)} color={isDark ? "text-amber-400" : "text-amber-500"} isDark={isDark} />
                <div className={`w-px h-4 ${isDark ? "bg-white/10" : "bg-slate-200"}`} />
                <StatItem icon={FileText} label="Settori ATECO" value={stats.atecoSections} color={isDark ? "text-violet-400" : "text-violet-500"} isDark={isDark} />
              </div>
            </div>
          )}

          {/* MAIN SPLIT */}
          <div className="flex-1 flex min-h-0 px-6 pb-4 gap-4">
            {/* LEFT: ATECO Grid (35%) */}
            <div className="w-[35%] min-h-0 flex flex-col">
              {/* Quick search by name / P.IVA */}
              <div className="relative mb-2">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? "text-sky-400/50" : "text-sky-500/50"}`} />
                <Input
                  placeholder="Cerca per nome o P.IVA..."
                  value={quickSearch}
                  onChange={e => setQuickSearch(e.target.value)}
                  className={`pl-9 pr-8 h-10 rounded-xl text-sm ${isDark ? "bg-white/5 border-white/10 text-white placeholder:text-slate-600" : "bg-white border-slate-200 placeholder:text-slate-400"}`}
                />
                {quickSearch && (
                  <button onClick={() => setQuickSearch("")} className={`absolute right-2.5 top-1/2 -translate-y-1/2 ${isDark ? "text-slate-500 hover:text-white" : "text-slate-400 hover:text-slate-700"}`}>
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <AtecoGrid
                selected={selectedAteco}
                onToggle={toggleAteco}
                onRemove={removeAteco}
                onSelectMultiple={selectMultipleAteco}
                isDark={isDark}
                regionFilter={regionFilter}
                onRegionChange={setRegionFilter}
                provinceFilter={provinceFilter}
                onProvinceChange={setProvinceFilter}
                rankingFilters={advFilters}
              />
              {/* Advanced Filters */}
              <div className="mt-2">
                <ProspectAdvancedFilters filters={advFilters} onChange={setAdvFilters} isDark={isDark} />
              </div>
            </div>

            {/* RIGHT: Contextual Panel (65%) */}
            <div className="flex-1 min-h-0 flex flex-col">
              <Tabs defaultValue="prospect" className="flex-1 min-h-0 flex flex-col">
                <TabsList className={`self-start mb-2 ${isDark ? "bg-white/[0.06] border border-white/[0.08]" : "bg-white/60 border border-white/80"}`}>
                  <TabsTrigger value="prospect" className={`text-xs gap-1.5 ${isDark ? "data-[state=active]:bg-white/10 data-[state=active]:text-white" : ""}`}>
                    <FileText className="w-3.5 h-3.5" /> Prospect
                  </TabsTrigger>
                  <TabsTrigger value="import" className={`text-xs gap-1.5 ${isDark ? "data-[state=active]:bg-white/10 data-[state=active]:text-white" : ""}`}>
                    <Download className="w-3.5 h-3.5" /> Importa
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="prospect" className="flex-1 min-h-0 mt-0">
                  {quickSearch.length >= 2 ? (
                    <div className={`h-full rounded-2xl border overflow-hidden ${isDark ? "bg-white/[0.02] backdrop-blur-xl border-white/[0.08]" : "bg-white/40 backdrop-blur-xl border-white/80"}`}>
                      <div className={`flex items-center gap-3 px-4 py-2 border-b ${isDark ? "border-white/[0.08]" : "border-slate-200/60"}`}>
                        <Search className={`w-4 h-4 ${isDark ? "text-sky-400" : "text-sky-500"}`} />
                        <span className={`text-sm font-semibold ${th.h2}`}>
                          Ricerca: "{quickSearch}"
                        </span>
                      </div>
                      <ProspectListPanel
                        atecoCodes={selectedAteco}
                        isDark={isDark}
                        regionFilter={regionFilterStr}
                        provinceFilter={provinceFilterStr}
                        quickSearch={quickSearch}
                        advFilters={advFilters}
                      />
                    </div>
                  ) : selectedAteco.length === 0 ? (
                    <div className={`h-full flex items-center justify-center rounded-2xl border ${isDark ? "bg-white/[0.03] backdrop-blur-xl border-white/[0.08]" : "bg-white/50 backdrop-blur-xl border-white/80 shadow-sm"}`}>
                      <div className="text-center space-y-3">
                        <FileText className={`w-20 h-20 mx-auto ${isDark ? "text-white/10" : "text-slate-200"}`} />
                        <p className={`text-lg ${th.h2}`}>Seleziona un codice ATECO</p>
                        <p className={`text-sm ${th.sub}`}>Clicca su uno o più codici ATECO per visualizzare i prospect associati</p>
                        <p className={`text-xs ${th.dim}`}>oppure usa la ricerca per nome / P.IVA</p>
                        {stats && stats.total === 0 && (
                          <div className={`mt-4 p-4 rounded-xl border text-xs ${isDark ? "bg-amber-500/10 border-amber-500/20 text-amber-300" : "bg-sky-50/80 border-sky-200/60 text-sky-700"}`}>
                            💡 Nessun prospect nel database. Vai su "Importa" per scaricare dati da Report Aziende.
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className={`h-full rounded-2xl border overflow-hidden ${isDark ? "bg-white/[0.02] backdrop-blur-xl border-white/[0.08]" : "bg-white/40 backdrop-blur-xl border-white/80"}`}>
                      <div className={`flex items-center gap-3 px-4 py-2 border-b ${isDark ? "border-white/[0.08]" : "border-slate-200/60"}`}>
                        <span className={`text-sm font-semibold ${th.h2}`}>
                          {selectedAteco.length === 1 ? `ATECO ${selectedAteco[0]}` : `${selectedAteco.length} codici ATECO`}
                        </span>
                      </div>
                      <ProspectListPanel
                        atecoCodes={selectedAteco}
                        isDark={isDark}
                        regionFilter={regionFilterStr}
                        provinceFilter={provinceFilterStr}
                        advFilters={advFilters}
                      />
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="import" className="flex-1 min-h-0 mt-0">
                  <div className={`h-full rounded-2xl border overflow-hidden ${isDark ? "bg-white/[0.02] backdrop-blur-xl border-white/[0.08]" : "bg-white/40 backdrop-blur-xl border-white/80"}`}>
                    <ProspectImporter isDark={isDark} atecoCodes={selectedAteco} regions={regionFilter} provinces={provinceFilter} filters={advFilters} />
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </div>
    </ThemeCtx.Provider>
  );
}
