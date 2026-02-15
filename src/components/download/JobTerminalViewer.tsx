import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Terminal } from "lucide-react";

interface LogEntry {
  ts: string;
  type: string;
  msg: string;
}

const typeColors: Record<string, string> = {
  START: "text-sky-400",
  OK: "text-emerald-400",
  WAIT: "text-amber-400",
  PAUSE: "text-orange-400",
  RECOVERY: "text-violet-400",
  NIGHT: "text-indigo-400",
  DONE: "text-emerald-300",
  ERROR: "text-red-400",
  INFO: "text-slate-400",
  STOP: "text-red-500",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  jobStatus: string;
  countryName: string;
  isDark: boolean;
}

export function JobTerminalViewer({ open, onOpenChange, jobId, jobStatus, countryName, isDark }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const isActive = jobStatus === "running" || jobStatus === "pending";

  const { data: logs } = useQuery({
    queryKey: ["job-terminal-log", jobId],
    queryFn: async () => {
      const { data } = await supabase
        .from("download_jobs")
        .select("terminal_log")
        .eq("id", jobId)
        .single();
      return (data?.terminal_log as unknown as LogEntry[] | null) || [];
    },
    refetchInterval: isActive ? 2000 : false,
    enabled: open && !!jobId,
  });

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] p-0 overflow-hidden bg-slate-950 border-white/10">
        <DialogHeader className="px-4 pt-4 pb-2 border-b border-white/[0.06]">
          <DialogTitle className="flex items-center gap-2 text-emerald-400 font-mono text-sm">
            <Terminal className="w-4 h-4" />
            Terminal — {countryName}
            {isActive && (
              <span className="ml-auto flex items-center gap-1.5 text-[10px] text-emerald-400/70">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                LIVE
              </span>
            )}
          </DialogTitle>
          <DialogDescription className="text-slate-500 text-xs">
            Log di esecuzione del job
          </DialogDescription>
        </DialogHeader>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="h-[400px] overflow-y-auto p-3 font-mono text-[11px] leading-[1.7] scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent"
        >
          {entries.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-600 text-xs">
              Nessun log disponibile per questo job.
            </div>
          ) : (
            entries.map((entry, idx) => {
              const color = typeColors[entry.type] || typeColors.INFO;
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
      </DialogContent>
    </Dialog>
  );
}
