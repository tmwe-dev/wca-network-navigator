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

export function DownloadCanvas({ open, onClose, onStop, current, results, running, isDark }: Props) {
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
      isDark ? "bg-slate-950/95 backdrop-blur-xl" : "bg-white/95 backdrop-blur-xl"
    )}>
      {/* ═══ HEADER ═══ */}
      <div className={cn(
        "flex items-center gap-3 px-4 py-2.5 flex-shrink-0 border-b",
        isDark ? "border-white/[0.08]" : "border-slate-200/60"
      )}>
        <Download className={cn("w-4 h-4", isDark ? "text-sky-400" : "text-sky-600")} />
        <span className={cn("text-sm font-semibold", isDark ? "text-slate-200" : "text-slate-800")}>
          Download Profili
        </span>
        <span className={cn("text-xs tabular-nums", isDark ? "text-slate-500" : "text-slate-400")}>
          {done}/{total}
        </span>
        {running && <Loader2 className={cn("w-3.5 h-3.5 animate-spin", isDark ? "text-sky-400" : "text-sky-500")} />}
        {isComplete && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
        <div className="flex-1" />

        {/* Summary chips */}
        <div className="flex items-center gap-1.5">
          <MiniChip icon={FileText} value={totalProfiles} isDark={isDark} color="emerald" />
          <MiniChip icon={Mail} value={totalEmails} isDark={isDark} color="sky" />
          <MiniChip icon={Phone} value={totalPhones} isDark={isDark} color="violet" />
          {totalSkipped > 0 && <MiniChip icon={SkipForward} value={totalSkipped} isDark={isDark} color="amber" />}
        </div>

        {running && (
          <button onClick={onStop} className={cn(
            "flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors",
            isDark ? "bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/25" : "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
          )}>
            <Square className="w-3 h-3" /> Stop
          </button>
        )}
        <button onClick={onClose} className={cn(
          "p-1 rounded-lg transition-colors",
          isDark ? "text-slate-500 hover:text-slate-300 hover:bg-white/[0.06]" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
        )}>
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="px-4 py-1.5 flex-shrink-0">
        <Progress value={pct} className={cn("h-1.5", isDark ? "bg-white/[0.06]" : "bg-slate-100")} />
        <div className={cn("text-[10px] mt-0.5 tabular-nums", isDark ? "text-slate-600" : "text-slate-400")}>
          {pct}% completato
        </div>
      </div>

      {/* ═══ BODY ═══ */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-2 space-y-3">

        {/* Current partner card */}
        {current && running && <CurrentCard current={current} isDark={isDark} />}

        {/* Completed history */}
        {results.length > 0 && (
          <div>
            <div className={cn("text-[10px] uppercase tracking-wider font-semibold mb-1.5", isDark ? "text-slate-600" : "text-slate-400")}>
              {isComplete ? "Risultati" : "Completati"}
            </div>
            <div ref={historyRef} className="space-y-1">
              {[...results].reverse().map((r, i) => (
                <CompletedRow key={`${r.partnerId}-${i}`} result={r} isDark={isDark} />
              ))}
            </div>
          </div>
        )}

        {results.length === 0 && !running && (
          <div className={cn("flex items-center justify-center py-8 text-sm", isDark ? "text-slate-600" : "text-slate-400")}>
            Nessun risultato
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Mini summary chip ── */
function MiniChip({ icon: Icon, value, isDark, color }: { icon: any; value: number; isDark: boolean; color: string }) {
  const colorMap: Record<string, string> = {
    emerald: isDark ? "text-emerald-400" : "text-emerald-600",
    sky: isDark ? "text-sky-400" : "text-sky-600",
    violet: isDark ? "text-violet-400" : "text-violet-600",
    amber: isDark ? "text-amber-400" : "text-amber-600",
  };
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[10px] tabular-nums font-medium", colorMap[color])}>
      <Icon className="w-3 h-3" />
      {value}
    </span>
  );
}

/* ── Current Card (pulsing, with extraction slots) ── */
function CurrentCard({ current, isDark }: { current: DownloadCurrent; isDark: boolean }) {
  return (
    <div className={cn(
      "rounded-xl border p-3 space-y-2.5",
      isDark ? "bg-sky-500/[0.06] border-sky-500/20" : "bg-sky-50/60 border-sky-200/60"
    )}>
      <div className="flex items-center gap-2.5">
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-base", isDark ? "bg-white/[0.06]" : "bg-slate-100")}>
          {current.countryCode ? getCountryFlag(current.countryCode) : "🏢"}
        </div>
        <div className="flex-1 min-w-0">
          <div className={cn("text-sm font-semibold truncate", isDark ? "text-slate-200" : "text-slate-800")}>
            {current.companyName}
          </div>
          <div className={cn("text-[10px]", isDark ? "text-slate-500" : "text-slate-400")}>
            Profilo {current.index}/{current.total} — Estrazione in corso...
          </div>
        </div>
        <Loader2 className={cn("w-4 h-4 animate-spin flex-shrink-0", isDark ? "text-sky-400" : "text-sky-500")} />
      </div>

      {/* Extraction slots (pulsing placeholders) */}
      <div className="flex flex-wrap gap-1.5">
        {[
          { icon: FileText, label: "Profilo" },
          { icon: Mail, label: "Email" },
          { icon: Phone, label: "Telefono" },
          { icon: Users, label: "Contatti" },
        ].map(({ icon: Icon, label }) => (
          <span key={label} className={cn(
            "inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded animate-pulse",
            isDark ? "bg-white/[0.04] text-slate-600" : "bg-slate-100 text-slate-400"
          )} style={{ animationDuration: "2s" }}>
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
function CompletedRow({ result, isDark }: { result: DownloadResult; isDark: boolean }) {
  const hasError = !!result.error;
  const hasAny = result.profileSaved || result.emailCount > 0 || result.phoneCount > 0;

  return (
    <div className={cn(
      "flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors animate-in fade-in duration-300",
      isDark ? "hover:bg-white/[0.03]" : "hover:bg-slate-50",
      (hasError || result.skipped) && (isDark ? "opacity-60" : "opacity-70")
    )}>
      {/* Status icon */}
      {hasError ? (
        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
      ) : result.skipped ? (
        <SkipForward className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
      ) : hasAny ? (
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
      ) : (
        <X className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
      )}

      {/* Company name */}
      <span className={cn("text-xs font-medium truncate flex-1 min-w-0", isDark ? "text-slate-300" : "text-slate-700")}>
        {result.countryCode && <span className="mr-1">{getCountryFlag(result.countryCode)}</span>}
        {result.companyName}
      </span>

      {/* Extraction indicators */}
      {result.profileSaved && (
        <span className={cn("inline-flex items-center gap-0.5 text-[10px]", isDark ? "text-emerald-400" : "text-emerald-600")}>
          <FileText className="w-3 h-3" />✓
        </span>
      )}
      {result.emailCount > 0 && (
        <span className={cn("inline-flex items-center gap-0.5 text-[10px] tabular-nums", isDark ? "text-sky-400" : "text-sky-600")}>
          <Mail className="w-3 h-3" />×{result.emailCount}
        </span>
      )}
      {result.phoneCount > 0 && (
        <span className={cn("inline-flex items-center gap-0.5 text-[10px] tabular-nums", isDark ? "text-violet-400" : "text-violet-600")}>
          <Phone className="w-3 h-3" />×{result.phoneCount}
        </span>
      )}
      {result.contactCount > 0 && (
        <span className={cn("inline-flex items-center gap-0.5 text-[10px] tabular-nums", isDark ? "text-amber-400" : "text-amber-600")}>
          <Users className="w-3 h-3" />×{result.contactCount}
        </span>
      )}
    </div>
  );
}
