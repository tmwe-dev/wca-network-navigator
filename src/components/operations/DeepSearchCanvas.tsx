import { useEffect, useRef } from "react";
import { X, Square, Search, Linkedin, Facebook, Instagram, MessageCircle, Star, Globe, Building2, UserCircle, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { getCountryFlag } from "@/lib/countries";
import { t } from "@/components/download/theme";

/* ── Types ── */
export interface DeepSearchResult {
  partnerId: string;
  companyName: string;
  countryCode?: string;
  logoUrl?: string | null;
  socialLinksFound: number;
  logoFound: boolean;
  contactProfilesFound: number;
  companyProfileFound: boolean;
  rating: number;
  rateLimited?: boolean;
  error?: string;
}

export interface DeepSearchCurrent {
  partnerId: string;
  companyName: string;
  countryCode?: string;
  logoUrl?: string | null;
  index: number;
  total: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onStop: () => void;
  current: DeepSearchCurrent | null;
  results: DeepSearchResult[];
  running: boolean;
  isDark: boolean;
}

export function DeepSearchCanvas({ open, onClose, onStop, current, results, running, isDark }: Props) {
  const historyRef = useRef<HTMLDivElement>(null);
  const th = t(isDark);

  // Auto-scroll history
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
        <Search className={cn("w-4 h-4", isDark ? "text-violet-400" : "text-violet-600")} />
        <span className={cn("text-sm font-semibold", isDark ? "text-slate-200" : "text-slate-800")}>
          Deep Search
        </span>
        <span className={cn("text-xs tabular-nums", isDark ? "text-slate-500" : "text-slate-400")}>
          {done}/{total}
        </span>
        {running && (
          <Loader2 className={cn("w-3.5 h-3.5 animate-spin", isDark ? "text-violet-400" : "text-violet-500")} />
        )}
        {isComplete && (
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
        )}
        <div className="flex-1" />
        {running && (
          <button
            onClick={onStop}
            className={cn(
              "flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors",
              isDark
                ? "bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/25"
                : "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
            )}
          >
            <Square className="w-3 h-3" /> Stop
          </button>
        )}
        <button
          onClick={onClose}
          className={cn(
            "p-1 rounded-lg transition-colors",
            isDark ? "text-slate-500 hover:text-slate-300 hover:bg-white/[0.06]" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          )}
        >
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
        {current && running && (
          <CurrentPartnerCard current={current} isDark={isDark} />
        )}

        {/* Completed history */}
        {results.length > 0 && (
          <div>
            <div className={cn(
              "text-[10px] uppercase tracking-wider font-semibold mb-1.5",
              isDark ? "text-slate-600" : "text-slate-400"
            )}>
              {isComplete ? "Risultati" : "Completati"}
            </div>
            <div ref={historyRef} className="space-y-1">
              {[...results].reverse().map((r, i) => (
                <CompletedRow key={`${r.partnerId}-${i}`} result={r} isDark={isDark} />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {results.length === 0 && !running && (
          <div className={cn("flex items-center justify-center py-8 text-sm", isDark ? "text-slate-600" : "text-slate-400")}>
            Nessun risultato
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Current Partner Card (pulsing) ── */
function CurrentPartnerCard({ current, isDark }: { current: DeepSearchCurrent; isDark: boolean }) {
  return (
    <div className={cn(
      "rounded-xl border p-3 space-y-2 animate-pulse",
      isDark
        ? "bg-violet-500/[0.06] border-violet-500/20"
        : "bg-violet-50/60 border-violet-200/60"
    )} style={{ animationDuration: "2s" }}>
      <div className="flex items-center gap-2.5">
        {current.logoUrl ? (
          <img src={current.logoUrl} className="w-8 h-8 rounded-lg object-contain bg-white/80" alt="" />
        ) : (
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", isDark ? "bg-white/[0.06]" : "bg-slate-100")}>
            <Building2 className={cn("w-4 h-4", isDark ? "text-slate-500" : "text-slate-400")} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className={cn("text-sm font-semibold truncate", isDark ? "text-slate-200" : "text-slate-800")}>
            {current.companyName}
          </div>
          <div className={cn("text-[10px]", isDark ? "text-slate-500" : "text-slate-400")}>
            {current.countryCode && getCountryFlag(current.countryCode)} Ricerca in corso...
          </div>
        </div>
        <Loader2 className={cn("w-4 h-4 animate-spin flex-shrink-0", isDark ? "text-violet-400" : "text-violet-500")} />
      </div>

      {/* Searching indicators */}
      <div className="flex flex-wrap gap-1.5">
        {[
          { icon: Linkedin, label: "LinkedIn" },
          { icon: Facebook, label: "Facebook" },
          { icon: Instagram, label: "Instagram" },
          { icon: MessageCircle, label: "WhatsApp" },
        ].map(({ icon: Icon, label }) => (
          <span
            key={label}
            className={cn(
              "inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded",
              isDark ? "bg-white/[0.04] text-slate-600" : "bg-slate-100 text-slate-400"
            )}
          >
            <Icon className="w-3 h-3" />
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── Completed partner row ── */
function CompletedRow({ result, isDark }: { result: DeepSearchResult; isDark: boolean }) {
  const hasError = !!result.error;
  const stars = result.rating || 0;

  return (
    <div className={cn(
      "flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors animate-in fade-in duration-300",
      isDark
        ? "hover:bg-white/[0.03]"
        : "hover:bg-slate-50",
      hasError && (isDark ? "opacity-60" : "opacity-70")
    )}>
      {/* Status icon */}
      {hasError ? (
        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
      ) : (
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
      )}

      {/* Company name */}
      <span className={cn(
        "text-xs font-medium truncate flex-1 min-w-0",
        isDark ? "text-slate-300" : "text-slate-700"
      )}>
        {result.countryCode && <span className="mr-1">{getCountryFlag(result.countryCode)}</span>}
        {result.companyName}
      </span>

      {/* Social count */}
      {result.socialLinksFound > 0 && (
        <span className={cn(
          "inline-flex items-center gap-0.5 text-[10px] tabular-nums",
          isDark ? "text-sky-400" : "text-sky-600"
        )}>
          <UserCircle className="w-3 h-3" />
          {result.socialLinksFound}
        </span>
      )}

      {/* Contact profiles */}
      {result.contactProfilesFound > 0 && (
        <span className={cn(
          "inline-flex items-center gap-0.5 text-[10px] tabular-nums",
          isDark ? "text-violet-400" : "text-violet-600"
        )}>
          <Linkedin className="w-3 h-3" />
          {result.contactProfilesFound}
        </span>
      )}

      {/* Logo indicator */}
      {result.logoFound && (
        <span className={cn("text-[10px]", isDark ? "text-emerald-400" : "text-emerald-600")}>
          <Globe className="w-3 h-3" />
        </span>
      )}

      {/* Rating */}
      {stars > 0 && (
        <span className={cn(
          "inline-flex items-center gap-0.5 text-[10px] tabular-nums",
          isDark ? "text-amber-400" : "text-amber-600"
        )}>
          <Star className="w-3 h-3 fill-current" />
          {stars}
        </span>
      )}

      {/* Rate limited warning */}
      {result.rateLimited && (
        <span className="text-[9px] text-amber-500">⚡</span>
      )}
    </div>
  );
}
