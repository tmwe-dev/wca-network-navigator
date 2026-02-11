import { useState, useCallback } from "react";
import { Sun, Moon } from "lucide-react";
import { ThemeCtx, t } from "@/components/download/theme";
import { WcaSessionIndicator } from "@/components/download/WcaSessionIndicator";
import { CountryGrid } from "@/components/download/CountryGrid";
import { ActionPanel } from "@/components/download/ActionPanel";
import { JobMonitor } from "@/components/download/JobMonitor";
import { AdvancedTools } from "@/components/download/AdvancedTools";
import { ResyncConfigure } from "@/components/download/ResyncConfigure";

export default function DownloadManagement() {
  const [isDark, setIsDark] = useState(() => {
    const s = localStorage.getItem("dl_theme");
    return s !== null ? s === "dark" : true;
  });
  const toggleTheme = () => setIsDark(p => { const n = !p; localStorage.setItem("dl_theme", n ? "dark" : "light"); return n; });

  const [selectedCountries, setSelectedCountries] = useState<{ code: string; name: string }[]>([]);
  const [showResync, setShowResync] = useState(false);

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

  return (
    <ThemeCtx.Provider value={isDark}>
      <div className={`h-[calc(100vh-4rem)] relative overflow-hidden -m-6 ${th.pageBg}`}>
        <div className={`absolute inset-0 bg-gradient-to-br ${th.pageGrad1}`} />
        <div className={`absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] ${th.pageGrad2} via-transparent to-transparent`} />

        <div className="relative z-10 h-full flex flex-col">
          {/* Top bar */}
          <div className="flex items-center justify-between px-6 py-2 flex-shrink-0">
            <div className="flex items-center gap-3">
              <h1 className={`text-lg font-semibold ${th.h1}`}>Download Management</h1>
              <button
                onClick={() => setShowResync(!showResync)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                  showResync
                    ? isDark ? "bg-purple-500/20 border-purple-500/40 text-purple-300" : "bg-purple-50 border-purple-300 text-purple-700"
                    : isDark ? "bg-white/[0.04] border-white/[0.1] text-slate-400 hover:bg-white/[0.08]" : "bg-white/60 border-slate-200 text-slate-500 hover:bg-white/80"
                }`}
              >
                {showResync ? "← Scarica Partner" : "Aggiorna Contatti"}
              </button>
            </div>
            <div className="flex items-center gap-3">
              <WcaSessionIndicator />
              <button onClick={toggleTheme} className={`p-2 rounded-xl transition-all ${isDark ? "bg-slate-800/60 hover:bg-slate-700/60 text-amber-400" : "bg-white/80 hover:bg-white shadow-sm text-sky-600"}`}>
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 flex flex-col lg:flex-row min-h-0 px-6 pb-4 gap-4">
            {showResync ? (
              // Resync mode — full width
              <div className="flex-1 overflow-auto">
                <ResyncConfigure isDark={isDark} onStartRunning={() => setShowResync(false)} />
              </div>
            ) : (
              // Download mode — two columns
              <>
                {/* Left: Country Grid */}
                <div className="flex-[3] min-h-0 flex flex-col">
                  <CountryGrid
                    selected={selectedCountries}
                    onToggle={toggleCountry}
                    onRemove={removeCountry}
                  />
                </div>

                {/* Right: Action Panel + Job Monitor */}
                <div className="flex-[2] min-h-0 overflow-auto space-y-4">
                  <ActionPanel selectedCountries={selectedCountries} />
                  <JobMonitor />
                </div>
              </>
            )}
          </div>

          {/* Advanced tools */}
          <div className="px-6 pb-4 flex-shrink-0">
            <AdvancedTools isDark={isDark} />
          </div>
        </div>
      </div>
    </ThemeCtx.Provider>
  );
}
