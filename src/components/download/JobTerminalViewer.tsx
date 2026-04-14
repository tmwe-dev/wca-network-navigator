import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { queryKeys } from "@/lib/queryKeys";
import {
  Terminal, Building2, Mail, Phone, FileText,
  CheckCircle, XCircle, AlertTriangle, SkipForward, Zap, Clock,
} from "lucide-react";

interface LogEntry {
  ts: string;
  type: string;
  msg: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  jobStatus: string;
  countryName: string;
  isDark: boolean;
}

/* ── Parse structured info from log message ── */
function parseLogEntry(entry: LogEntry) {
  const { type, msg } = entry;

  const companyMatch = msg.match(/^(.+?)\s+\(#(\d+)\)\s*—\s*(.+)$/);
  if (companyMatch) {
    const companyName = companyMatch[1];
    const wcaId = companyMatch[2];
    const indicators = companyMatch[3];

    const hasProfile = indicators.includes("Profilo ✓");
    const hasEmail = indicators.includes("Email ✓");
    const hasPhone = indicators.includes("Tel ✓");
    const emailCount = indicators.match(/Email ✓ \((\d+)\)/)?.[1] || "0";
    const phoneCount = indicators.match(/Tel ✓ \((\d+)\)/)?.[1] || "0";

    return {
      kind: "result" as const,
      companyName, wcaId, hasProfile, hasEmail, hasPhone,
      emailCount, phoneCount,
      success: hasEmail || hasPhone,
    };
  }

  const startMatch = msg.match(/Profilo #(\d+) \((\d+)\/(\d+)\)/);
  if (startMatch && type === "START") {
    return { kind: "start" as const, wcaId: startMatch[1], current: startMatch[2], total: startMatch[3] };
  }

  if (type === "SKIP") {
    const skipMatch = msg.match(/#(\d+)/);
    return { kind: "skip" as const, wcaId: skipMatch?.[1] || "", message: msg };
  }

  return { kind: "generic" as const };
}

/* ── Company initial avatar ── */
function CompanyAvatar({ name, success }: { name: string; success: boolean }) {
  const initials = name
    .split(/[\s&]+/)
    .filter(w => w.length > 1)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join("");

  return (
    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${
      success
        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
        : "bg-destructive/15 text-destructive border border-destructive/20"
    }`}>
      {initials || <Building2 className="w-3.5 h-3.5" />}
    </div>
  );
}

/* ── Result card for a processed company ── */
function ResultRow({ entry, parsed }: { entry: LogEntry; parsed: ReturnType<typeof parseLogEntry> & { kind: "result" } }) {
  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all ${
      parsed.success
        ? "bg-emerald-500/[0.06] border border-emerald-500/10"
        : "bg-destructive/[0.04] border border-destructive/10"
    }`}>
      <CompanyAvatar name={parsed.companyName} success={parsed.success} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground truncate">{parsed.companyName}</span>
          <span className="text-[10px] text-muted-foreground font-mono shrink-0">#{parsed.wcaId}</span>
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          {parsed.hasProfile && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <FileText className="w-3 h-3" /> Profilo
            </span>
          )}
          {parsed.hasEmail ? (
            <span className="flex items-center gap-1 text-[10px] text-emerald-400">
              <Mail className="w-3 h-3" /> {parsed.emailCount}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Mail className="w-3 h-3" /> 0
            </span>
          )}
          {parsed.hasPhone ? (
            <span className="flex items-center gap-1 text-[10px] text-emerald-400">
              <Phone className="w-3 h-3" /> {parsed.phoneCount}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Phone className="w-3 h-3" /> 0
            </span>
          )}
        </div>
      </div>
      <div className="shrink-0">
        {parsed.success ? (
          <CheckCircle className="w-4 h-4 text-emerald-400" />
        ) : (
          <XCircle className="w-4 h-4 text-destructive/60" />
        )}
      </div>
      <span className="text-[10px] text-muted-foreground font-mono shrink-0">{entry.ts}</span>
    </div>
  );
}

/* ── Processing indicator (START) ── */
function StartRow({ entry, parsed }: { entry: LogEntry; parsed: ReturnType<typeof parseLogEntry> & { kind: "start" } }) {
  return (
    <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10 border border-primary/20 shrink-0">
        <Zap className="w-3.5 h-3.5 text-primary animate-pulse" />
      </div>
      <span className="text-xs text-muted-foreground">
        Estrazione <span className="font-mono text-primary">#{parsed.wcaId}</span>
        <span className="ml-2 text-muted-foreground/60">{parsed.current}/{parsed.total}</span>
      </span>
      <span className="ml-auto text-[10px] text-muted-foreground font-mono">{entry.ts}</span>
    </div>
  );
}

/* ── Skip row ── */
function SkipRow({ entry, parsed }: { entry: LogEntry; parsed: ReturnType<typeof parseLogEntry> & { kind: "skip" } }) {
  return (
    <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-primary/[0.04] border border-primary/10">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10 border border-primary/20 shrink-0">
        <SkipForward className="w-3.5 h-3.5 text-primary/80" />
      </div>
      <span className="text-xs text-primary/80 truncate flex-1">{parsed.message}</span>
      <span className="text-[10px] text-muted-foreground font-mono shrink-0">{entry.ts}</span>
    </div>
  );
}

/* ── Generic log line ── */
function GenericRow({ entry }: { entry: LogEntry }) {
  const typeStyles: Record<string, { icon: typeof Terminal; color: string }> = {
    INFO: { icon: Terminal, color: "text-muted-foreground" },
    DONE: { icon: CheckCircle, color: "text-emerald-400" },
    ERROR: { icon: AlertTriangle, color: "text-destructive" },
    STOP: { icon: XCircle, color: "text-destructive" },
    WARN: { icon: AlertTriangle, color: "text-primary/80" },
  };
  const style = typeStyles[entry.type] || typeStyles.INFO;
  const Icon = style.icon;

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg">
      <div className="w-8 flex items-center justify-center shrink-0">
        <Icon className={`w-3.5 h-3.5 ${style.color}`} />
      </div>
      <span className={`text-xs ${style.color}`}>{entry.msg}</span>
      <span className="ml-auto text-[10px] text-muted-foreground font-mono shrink-0">{entry.ts}</span>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════ */
export function JobTerminalViewer({ open, onOpenChange, jobId, jobStatus, countryName, isDark }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const isActive = jobStatus === "running" || jobStatus === "pending";

  const { data: logs } = useQuery({
    queryKey: queryKeys.downloads.terminalLog(jobId),
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
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      });
    }
  }, [logs, autoScroll]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 60);
  };

  const entries = (logs || []).filter(e => e.type !== "GATE");

  const results = entries.filter(e => {
    const p = parseLogEntry(e);
    return p.kind === "result";
  });
  const successCount = results.filter(e => {
    const p = parseLogEntry(e);
    return p.kind === "result" && p.success;
  }).length;
  const failCount = results.length - successCount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] p-0 overflow-hidden bg-background border-border">
        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/40">
          <DialogTitle className="flex items-center gap-3 text-sm">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Terminal className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <span className="text-foreground font-semibold">{countryName}</span>
              {isActive && (
                <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-emerald-400/70 font-normal">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  LIVE
                </span>
              )}
            </div>
          </DialogTitle>
          <DialogDescription className="sr-only">Log di esecuzione del job</DialogDescription>

          {results.length > 0 && (
            <div className="flex items-center gap-4 mt-2 text-[11px]">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <CheckCircle className="w-3 h-3" /> {successCount} con contatti
              </span>
              <span className="flex items-center gap-1.5 text-destructive/70">
                <XCircle className="w-3 h-3" /> {failCount} senza contatti
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="w-3 h-3" /> {results.length} processati
              </span>
            </div>
          )}
        </DialogHeader>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
          style={{ maxHeight: "calc(85vh - 120px)" }}
        >
          {entries.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
              <div className="text-center space-y-2">
                <Terminal className="w-8 h-8 mx-auto text-muted-foreground/30" />
                <p>In attesa dei log...</p>
              </div>
            </div>
          ) : (
            entries.map((entry, idx) => {
              const parsed = parseLogEntry(entry);
              if (parsed.kind === "result") return <ResultRow key={idx} entry={entry} parsed={parsed} />;
              if (parsed.kind === "start") return <StartRow key={idx} entry={entry} parsed={parsed} />;
              if (parsed.kind === "skip") return <SkipRow key={idx} entry={entry} parsed={parsed} />;
              return <GenericRow key={idx} entry={entry} />;
            })
          )}
        </div>

        {!autoScroll && isActive && (
          <button
            onClick={() => {
              setAutoScroll(true);
              if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }}
            className="absolute bottom-4 right-4 px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[11px] border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors"
          >
            ↓ Torna in fondo
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
}
