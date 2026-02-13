import { useEffect, useRef, useState, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  const [autoScroll, setAutoScroll] = useState(true);

  // Find active job
  const { data: activeJob } = useQuery({
    queryKey: ["terminal-active-job"],
    queryFn: async () => {
      const { data } = await supabase
        .from("download_jobs")
        .select("id, status")
        .in("status", ["running", "pending"])
        .order("created_at", { ascending: true })
        .limit(1);
      return data?.[0] || null;
    },
    refetchInterval: 3000,
  });

  // If no active job, show the most recent completed/cancelled
  const { data: fallbackJob } = useQuery({
    queryKey: ["terminal-fallback-job"],
    queryFn: async () => {
      if (activeJob) return null;
      const { data } = await supabase
        .from("download_jobs")
        .select("id, status")
        .in("status", ["completed", "cancelled", "paused"])
        .order("updated_at", { ascending: false })
        .limit(1);
      return data?.[0] || null;
    },
    refetchInterval: 5000,
    enabled: !activeJob,
  });

  const jobId = activeJob?.id || fallbackJob?.id;

  // Poll terminal_log from job
  const { data: logs } = useQuery({
    queryKey: ["terminal-log", jobId],
    queryFn: async () => {
      if (!jobId) return [];
      const { data } = await supabase
        .from("download_jobs")
        .select("terminal_log")
        .eq("id", jobId)
        .single();
      return (data?.terminal_log as unknown as LogEntry[] | null) || [];
    },
    refetchInterval: activeJob ? 2000 : 10000,
    enabled: !!jobId,
  });

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 40);
  };

  const entries = logs || [];

  return (
    <div className={`rounded-xl border overflow-hidden ${isDark ? "bg-slate-950/80 border-white/[0.08]" : "bg-slate-900/95 border-slate-700/50"}`}>
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
        className="h-[220px] overflow-y-auto p-2 font-mono text-[11px] leading-[1.6] scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent"
      >
        {entries.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-600 text-xs">
            Nessun log disponibile. Avvia un download per vedere l'attività.
          </div>
        ) : (
          entries.map((entry, idx) => {
            const colors = typeColors[entry.type] || typeColors.INFO;
            const color = isDark ? colors.dark : colors.light;
            return (
              <div key={idx} className="flex gap-2 hover:bg-white/[0.03] px-1 rounded">
                <span className="text-slate-600 select-none shrink-0">{entry.ts}</span>
                <span className={`${color} font-semibold w-[72px] shrink-0 text-right`}>{entry.type}</span>
                <span className="text-slate-300">{entry.msg}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
