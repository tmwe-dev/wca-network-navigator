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
  const _th = t(isDark);

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
      isDark ? "bg-background/95 backdrop-blur-xl" : "bg-card/95 backdrop-blur-xl"
    )}>
      {/* ═══ HEADER ═══ */}
      <div className={cn(
        "flex items-center gap-3 px-4 py-2.5 flex-shrink-0 border-b",
        isDark ? "border-border" : "border-border"
      )}>
        <Search className={cn("w-4 h-4 text-primary")} />
        <span className={cn("text-sm font-semibold text-foreground")}>
          Deep Search
        </span>
        <span className={cn("text-xs tabular-nums text-muted-foreground")}>
          {done}/{total}
        </span>
        {running && (
          <Loader2 className={cn("w-3.5 h-3.5 animate-spin text-primary")} />
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
                ? "bg-destructive/15 text-destructive hover:bg-destructive/25 border border-destructive/25"
                : "bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20"
            )}
          >
            <Square className="w-3 h-3" /> Stop
          </button>
        )}
        <button
          onClick={onClose}
          className={cn(
            "p-1 rounded-lg transition-colors",
            "text-muted-foreground hover:text-foreground hover:bg-muted/40"
          )}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="px-4 py-1.5 flex-shrink-0">
        <Progress value={pct} className={cn("h-1.5", "bg-muted")} />
        <div className={cn("text-[10px] mt-0.5 tabular-nums text-muted-foreground")}>
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
              "text-muted-foreground"
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
          <div className={cn("flex items-center justify-center py-8 text-sm text-muted-foreground")}>
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
        ? "bg-primary/[0.06] border-primary/20"
        : "bg-primary/10 border-primary/20"
    )} style={{ animationDuration: "2s" }}>
      <div className="flex items-center gap-2.5">
        {current.logoUrl ? (
          <img src={current.logoUrl} className="w-8 h-8 rounded-lg object-contain bg-white/80" alt="" />
        ) : (
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center bg-muted/30")}>
            <Building2 className={cn("w-4 h-4 text-muted-foreground")} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className={cn("text-sm font-semibold truncate text-foreground")}>
            {current.companyName}
          </div>
          <div className={cn("text-[10px] text-muted-foreground")}>
            {current.countryCode && getCountryFlag(current.countryCode)} Ricerca in corso...
          </div>
        </div>
        <Loader2 className={cn("w-4 h-4 animate-spin flex-shrink-0 text-primary")} />
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
              "bg-muted/30 text-muted-foreground"
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
      "hover:bg-muted/30",
      hasError && (isDark ? "opacity-60" : "opacity-70")
    )}>
      {/* Status icon */}
      {hasError ? (
        <AlertTriangle className="w-3.5 h-3.5 text-primary flex-shrink-0" />
      ) : (
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
      )}

      {/* Company name */}
      <span className={cn(
        "text-xs font-medium truncate flex-1 min-w-0 text-foreground"
      )}>
        {result.countryCode && <span className="mr-1">{getCountryFlag(result.countryCode)}</span>}
        {result.companyName}
      </span>

      {/* Social count */}
      {result.socialLinksFound > 0 && (
        <span className={cn(
          "inline-flex items-center gap-0.5 text-[10px] tabular-nums",
          "text-muted-foreground"
        )}>
          <UserCircle className="w-3 h-3" />
          {result.socialLinksFound}
        </span>
      )}

      {/* Contact profiles */}
      {result.contactProfilesFound > 0 && (
        <span className={cn(
          "inline-flex items-center gap-0.5 text-[10px] tabular-nums",
          "text-primary"
        )}>
          <Linkedin className="w-3 h-3" />
          {result.contactProfilesFound}
        </span>
      )}

      {/* Logo indicator */}
      {result.logoFound && (
        <span className={cn("text-[10px] text-emerald-500")}>
          <Globe className="w-3 h-3" />
        </span>
      )}

      {/* Rating */}
      {stars > 0 && (
        <span className={cn(
          "inline-flex items-center gap-0.5 text-[10px] tabular-nums",
          "text-primary"
        )}>
          <Star className="w-3 h-3 fill-current" />
          {stars}
        </span>
      )}

      {/* Rate limited warning */}
      {result.rateLimited && (
        <span className="text-[9px] text-primary">⚡</span>
      )}
    </div>
  );
}
