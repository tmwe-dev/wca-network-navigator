import { useEffect, useRef, useState, useContext } from "react";
import { useDownloadJobs } from "@/hooks/useDownloadJobs";
import { ThemeCtx, t } from "@/components/download/theme";
import { Terminal } from "lucide-react";

interface LogEntry {
  ts: string;
  type: "START" | "OK" | "WAIT" | "PAUSE" | "RECOVERY" | "NIGHT" | "DONE" | "ERROR" | "INFO";
  msg: string;
}

const typeColors: Record<string, { dark: string; light: string }> = {
  START: { dark: "text-sky-400", light: "text-sky-600" },
  OK: { dark: "text-emerald-400", light: "text-emerald-600" },
  WAIT: { dark: "text-amber-400", light: "text-amber-600" },
  PAUSE: { dark: "text-orange-400", light: "text-orange-600" },
  RECOVERY: { dark: "text-violet-400", light: "text-violet-600" },
  NIGHT: { dark: "text-indigo-400", light: "text-indigo-600" },
  DONE: { dark: "text-emerald-300", light: "text-emerald-700" },
  ERROR: { dark: "text-red-400", light: "text-red-600" },
  INFO: { dark: "text-slate-400", light: "text-slate-500" },
};

export function DownloadTerminal() {
  const isDark = useContext(ThemeCtx);
  const th = t(isDark);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Use the SHARED download jobs query — NO independent queries
  const { data: jobs } = useDownloadJobs();

  // Find active or most recent job from shared data
  const activeJob = (jobs || []).find(j => j.status === "running" || j.status === "pending");
  const fallbackJob = !activeJob
    ? (jobs || []).find(j => j.status === "completed" || j.status === "cancelled" || j.status === "paused")
    : null;

  const targetJob = activeJob || fallbackJob;

  // Extract terminal_log directly from the job data (already in the shared query)
  const entries: LogEntry[] = targetJob
    ? ((targetJob as any).terminal_log as LogEntry[] || [])
    : [];

  // Auto-scroll using sentinel div (more reliable than scrollTop)
  useEffect(() => {
    if (autoScroll && sentinelRef.current) {
      sentinelRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [entries.length, autoScroll]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 40);
  };

  return (
    <div className={`rounded-xl border overflow-hidden flex flex-col ${isDark ? "bg-slate-950/80 border-white/[0.08]" : "bg-slate-900/95 border-slate-700/50"}`}>
      {/* Header */}
      <div className={`flex items-center gap-2 px-3 py-1.5 border-b ${isDark ? "bg-slate-900/80 border-white/[0.06]" : "bg-slate-800 border-slate-700/50"}`}>
        <Terminal className="w-3.5 h-3.5 text-emerald-400" />
        <span className="text-xs font-mono text-emerald-400 font-medium">Download Terminal</span>
        {activeJob && (
          <span className="ml-auto flex items-center gap-1.5 text-[10px] text-emerald-400/70">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            LIVE
          </span>
        )}
        {!activeJob && entries.length > 0 && (
          <span className="ml-auto text-[10px] text-slate-500 font-mono">ULTIMO JOB</span>
        )}
      </div>

      {/* Log area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="h-[280px] flex-1 overflow-y-auto p-2 font-mono text-[11px] leading-[1.6] scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent"
      >
        {entries.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-600 text-xs text-center px-4">
            {activeJob ? "In attesa di log..." : "Nessun job attivo. Seleziona un paese e avvia un download."}
          </div>
        ) : (
          <>
            {entries.map((entry, idx) => {
              const colors = typeColors[entry.type] || typeColors.INFO;
              const color = isDark ? colors.dark : colors.light;
              return (
                <div key={idx} className="flex gap-2 hover:bg-white/[0.03] px-1 rounded">
                  <span className="text-slate-600 select-none shrink-0">{entry.ts}</span>
                  <span className={`${color} font-semibold w-[72px] shrink-0 text-right`}>{entry.type}</span>
                  <span className="text-slate-300">{entry.msg}</span>
                </div>
              );
            })}
            <div ref={sentinelRef} />
          </>
        )}
      </div>
    </div>
  );
}
