import { useEffect, useRef } from "react";
import { X, Square, Download, Loader2, CheckCircle2, AlertTriangle, FileText, Mail, Phone, Users, SkipForward } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { getCountryFlag } from "@/lib/countries";

/* ── Types ── */
export interface DownloadResult {
  partnerId: string;
  companyName: string;
  countryCode?: string;
  profileSaved: boolean;
  emailCount: number;
  phoneCount: number;
  contactCount: number;
  skipped?: boolean;
  error?: string;
}

export interface DownloadCurrent {
  partnerId: string;
  companyName: string;
  countryCode?: string;
  index: number;
  total: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onStop: () => void;
  current: DownloadCurrent | null;
  results: DownloadResult[];
  running: boolean;
  isDark: boolean;
}

export function DownloadCanvas({ open, onClose, onStop, current, results, running, _isDark }: Props) {
  const historyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [results.length]);

  if (!open) return null;

  const done = results.length;
  const total = current?.total || done;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const isComplete = !running && done > 0;

  // Stats summary
  const totalEmails = results.reduce((s, r) => s + r.emailCount, 0);
  const totalPhones = results.reduce((s, r) => s + r.phoneCount, 0);
  const totalProfiles = results.filter(r => r.profileSaved).length;
  const totalSkipped = results.filter(r => r.skipped).length;

  return (
    <div className={cn(
      "absolute inset-0 z-30 flex flex-col animate-in slide-in-from-right-8 duration-200",
      "bg-background/95 backdrop-blur-xl"
    )}>
      {/* ═══ HEADER ═══ */}
      <div className="flex items-center gap-3 px-4 py-2.5 flex-shrink-0 border-b border-border">
        <Download className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">
          Download Profili
        </span>
        <span className="text-xs tabular-nums text-muted-foreground">
          {done}/{total}
        </span>
        {running && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />}
        {isComplete && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
        <div className="flex-1" />

        {/* Summary chips */}
        <div className="flex items-center gap-1.5">
          <MiniChip icon={FileText} value={totalProfiles} color="emerald" />
          <MiniChip icon={Mail} value={totalEmails} color="muted" />
          <MiniChip icon={Phone} value={totalPhones} color="primary" />
          {totalSkipped > 0 && <MiniChip icon={SkipForward} value={totalSkipped} color="primary" />}
        </div>

        {running && (
          <button onClick={onStop} className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors bg-destructive/15 text-destructive hover:bg-destructive/25 border border-destructive/25">
            <Square className="w-3 h-3" /> Stop
          </button>
        )}
        <button onClick={onClose} className="p-1 rounded-lg transition-colors text-muted-foreground hover:text-foreground hover:bg-muted/50">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="px-4 py-1.5 flex-shrink-0">
        <Progress value={pct} className="h-1.5 bg-muted" />
        <div className="text-[10px] mt-0.5 tabular-nums text-muted-foreground">
          {pct}% completato
        </div>
      </div>

      {/* ═══ BODY ═══ */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-2 space-y-3">

        {/* Current partner card */}
        {current && running && <CurrentCard current={current} />}

        {/* Completed history */}
        {results.length > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-wider font-semibold mb-1.5 text-muted-foreground">
              {isComplete ? "Risultati" : "Completati"}
            </div>
            <div ref={historyRef} className="space-y-1">
              {[...results].reverse().map((r, i) => (
                <CompletedRow key={`${r.partnerId}-${i}`} result={r} />
              ))}
            </div>
          </div>
        )}

        {results.length === 0 && !running && (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            Nessun risultato
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Mini summary chip ── */
function MiniChip({ icon: Icon, value, color }: { icon: any; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    emerald: "text-emerald-500",
    muted: "text-muted-foreground",
    primary: "text-primary",
  };
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[10px] tabular-nums font-medium", colorMap[color])}>
      <Icon className="w-3 h-3" />
      {value}
    </span>
  );
}

/* ── Current Card (pulsing, with extraction slots) ── */
function CurrentCard({ current }: { current: DownloadCurrent }) {
  return (
    <div className="rounded-xl border p-3 space-y-2.5 bg-primary/[0.06] border-primary/20">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base bg-muted">
          {current.countryCode ? getCountryFlag(current.countryCode) : "🏢"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate text-foreground">
            {current.companyName}
          </div>
          <div className="text-[10px] text-muted-foreground">
            Profilo {current.index}/{current.total} — Estrazione in corso...
          </div>
        </div>
        <Loader2 className="w-4 h-4 animate-spin flex-shrink-0 text-primary" />
      </div>

      {/* Extraction slots (pulsing placeholders) */}
      <div className="flex flex-wrap gap-1.5">
        {[
          { icon: FileText, label: "Profilo" },
          { icon: Mail, label: "Email" },
          { icon: Phone, label: "Telefono" },
          { icon: Users, label: "Contatti" },
        ].map(({ icon: Icon, label }) => (
          <span key={label} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded animate-pulse bg-muted text-muted-foreground" style={{ animationDuration: "2s" }}>
            <Icon className="w-3 h-3" />
            {label}
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── Completed Row ── */
function CompletedRow({ result }: { result: DownloadResult }) {
  const hasError = !!result.error;
  const hasAny = result.profileSaved || result.emailCount > 0 || result.phoneCount > 0;

  return (
    <div className={cn(
      "flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors animate-in fade-in duration-300",
      "hover:bg-muted/30",
      (hasError || result.skipped) && "opacity-60"
    )}>
      {/* Status icon */}
      {hasError ? (
        <AlertTriangle className="w-3.5 h-3.5 text-primary flex-shrink-0" />
      ) : result.skipped ? (
        <SkipForward className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
      ) : hasAny ? (
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
      ) : (
        <X className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
      )}

      {/* Company name */}
      <span className="text-xs font-medium truncate flex-1 min-w-0 text-foreground">
        {result.countryCode && <span className="mr-1">{getCountryFlag(result.countryCode)}</span>}
        {result.companyName}
      </span>

      {/* Extraction indicators */}
      {result.profileSaved && (
        <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-500">
          <FileText className="w-3 h-3" />✓
        </span>
      )}
      {result.emailCount > 0 && (
        <span className="inline-flex items-center gap-0.5 text-[10px] tabular-nums text-muted-foreground">
          <Mail className="w-3 h-3" />×{result.emailCount}
        </span>
      )}
      {result.phoneCount > 0 && (
        <span className="inline-flex items-center gap-0.5 text-[10px] tabular-nums text-primary">
          <Phone className="w-3 h-3" />×{result.phoneCount}
        </span>
      )}
      {result.contactCount > 0 && (
        <span className="inline-flex items-center gap-0.5 text-[10px] tabular-nums text-muted-foreground">
          <Users className="w-3 h-3" />×{result.contactCount}
        </span>
      )}
    </div>
  );
}
