import { useEffect, useRef, useState, useContext } from "react";
import { useDownloadJobs } from "@/hooks/useDownloadJobs";
import { ThemeCtx, t } from "@/components/download/theme";
import { Terminal } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface LogEntry {
  ts: string;
  type: "START" | "OK" | "WAIT" | "PAUSE" | "RECOVERY" | "NIGHT" | "DONE" | "ERROR" | "INFO";
  msg: string;
}

const typeColors: Record<string, { dark: string; light: string }> = {
  START: { dark: "text-muted-foreground", light: "text-muted-foreground" },
  OK: { dark: "text-emerald-400", light: "text-emerald-600" },
  WAIT: { dark: "text-primary", light: "text-primary" },
  PAUSE: { dark: "text-primary", light: "text-primary" },
  RECOVERY: { dark: "text-primary", light: "text-primary" },
  NIGHT: { dark: "text-muted-foreground", light: "text-muted-foreground" },
  DONE: { dark: "text-emerald-400", light: "text-emerald-600" },
  ERROR: { dark: "text-destructive", light: "text-destructive" },
  INFO: { dark: "text-muted-foreground", light: "text-muted-foreground" },
};

interface DownloadTerminalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function useTerminalData() {
  const { data: jobs } = useDownloadJobs();
  const activeJob = (jobs || []).find(j => j.status === "running" || j.status === "pending");
  const fallbackJob = !activeJob
    ? (jobs || []).find(j => j.status === "completed" || j.status === "cancelled" || j.status === "paused")
    : null;
  const targetJob = activeJob || fallbackJob;
  const entries: LogEntry[] = targetJob
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase JSON column type mismatch
    ? ((targetJob as any) // eslint-disable-line @typescript-eslint/no-explicit-any -- Supabase JSON).terminal_log as LogEntry[] || [])
    : [];
  return { activeJob, entries };
}

/** Embedded terminal view (no dialog wrapper) */
export function DownloadTerminalEmbed() {
  const isDark = useContext(ThemeCtx);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const { activeJob, entries } = useTerminalData();

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
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/30">
        <Terminal className="w-3.5 h-3.5 text-emerald-400" />
        <span className="text-xs font-mono font-medium text-emerald-400">Terminal</span>
        {activeJob && (
          <span className="ml-auto flex items-center gap-1.5 text-[10px] text-emerald-400/70 font-normal">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            LIVE
          </span>
        )}
      </div>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto px-3 pb-3 font-mono text-[11px] leading-[1.6] scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent bg-card/50"
      >
        {entries.length === 0 ? (
           <div className="h-full flex items-center justify-center text-muted-foreground/50 text-xs text-center px-4">
            {activeJob ? "In attesa di log..." : "Nessun job attivo."}
          </div>
        ) : (
          <>
            {entries.map((entry, idx) => {
              const colors = typeColors[entry.type] || typeColors.INFO;
              const color = isDark ? colors.dark : colors.light;
              return (
                <div key={idx} className="flex gap-2 hover:bg-white/[0.03] px-1 rounded">
                  <span className="text-muted-foreground/50 select-none shrink-0">{entry.ts}</span>
                  <span className={`${color} font-semibold w-[72px] shrink-0 text-right`}>{entry.type}</span>
                  <span className="text-foreground/80">{entry.msg}</span>
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

export function DownloadTerminalDialog({ open, onOpenChange }: DownloadTerminalDialogProps) {
  const isDark = useContext(ThemeCtx);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const { activeJob, entries } = useTerminalData();

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 bg-card border-border text-foreground overflow-hidden [&>button]:text-muted-foreground [&>button]:hover:text-foreground">
        <DialogHeader className="px-4 pt-4 pb-2 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-sm font-mono text-emerald-400">
            <Terminal className="w-4 h-4" />
            Download Terminal
            {activeJob && (
              <span className="ml-auto flex items-center gap-1.5 text-[10px] text-emerald-400/70 font-normal">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                LIVE
              </span>
            )}
            {!activeJob && entries.length > 0 && (
              <span className="ml-auto text-[10px] text-muted-foreground font-mono font-normal">ULTIMO JOB</span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="h-[400px] overflow-y-auto px-3 pb-3 font-mono text-[11px] leading-[1.6] scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent"
        >
          {entries.length === 0 ? (
           <div className="h-full flex items-center justify-center text-muted-foreground/50 text-xs text-center px-4">
              {activeJob ? "In attesa di log..." : "Nessun job attivo. Seleziona un paese e avvia un download."}
            </div>
          ) : (
            <>
              {entries.map((entry, idx) => {
                const colors = typeColors[entry.type] || typeColors.INFO;
                const color = isDark ? colors.dark : colors.light;
                return (
                  <div key={idx} className="flex gap-2 hover:bg-white/[0.03] px-1 rounded">
                  <span className="text-muted-foreground/50 select-none shrink-0">{entry.ts}</span>
                   <span className={`${color} font-semibold w-[72px] shrink-0 text-right`}>{entry.type}</span>
                    <span className="text-foreground/80">{entry.msg}</span>
                  </div>
                );
              })}
              <div ref={sentinelRef} />
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Keep backward-compatible named export
export const DownloadTerminal = DownloadTerminalDialog;
