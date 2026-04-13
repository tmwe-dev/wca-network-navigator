import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Download, Telescope, Building2, UserCircle, CheckCircle2,
  Linkedin, MessageCircle, Mail, Phone, Globe,
} from "lucide-react";

/* ── Icon Indicator (circular with badge) — tri-state ── */
export function IconIndicator({ icon: Icon, count, label, isDark, onClick, active, verified }: {
  icon: any; count: number; label: string; isDark: boolean;
  onClick?: () => void; active?: boolean; verified?: boolean;
}) {
  const done = count === 0;
  const verifiedMissing = count > 0 && verified;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={done ? undefined : onClick}
          className={cn(
            "relative w-7 h-7 rounded-full flex items-center justify-center transition-all",
            done
              ? "bg-emerald-500/15 text-emerald-400"
              : verifiedMissing
                ? "bg-emerald-500/10 text-emerald-400"
                : active
                  ? "bg-primary/20 text-primary ring-1 ring-primary/40"
                  : "bg-muted text-muted-foreground hover:bg-muted/80",
            done ? "cursor-default" : "cursor-pointer"
          )}
        >
          <Icon className="w-3.5 h-3.5" />
          {count > 0 && (
            <span className={cn(
              "absolute -top-1 -right-1 min-w-[14px] h-[14px] rounded-full flex items-center justify-center text-[8px] font-bold leading-none px-0.5",
              active ? "bg-primary text-primary-foreground" : verifiedMissing ? "bg-emerald-500 text-primary-foreground" : "bg-destructive text-primary-foreground"
            )}>
              {count > 99 ? "99+" : count}
            </span>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {done ? `${label} ✓` : verifiedMissing ? `${label}: ${count} mancanti (verificato ✓)` : `${label}: ${count} mancanti`}
      </TooltipContent>
    </Tooltip>
  );
}

/* ── Status Dot (for partner cards) ── */
export function StatusDot({ ok, label, isDark }: { ok: boolean; label: string; isDark: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn(
          "w-2 h-2 rounded-full transition-colors",
          ok ? "bg-emerald-500" : "bg-muted"
        )} />
      </TooltipTrigger>
      <TooltipContent side="top" className="text-[10px]">
        {ok ? `${label} ✓` : `${label} mancante`}
      </TooltipContent>
    </Tooltip>
  );
}

/* ── Enriched Status Icons (replaces 4 status dots after Deep Search) ── */
export function EnrichedStatusIcons({ hasProfile, hasEmail, hasPhone, hasDeep, hasLi, hasWa, isDark }: {
  hasProfile: boolean; hasEmail: boolean; hasPhone: boolean; hasDeep: boolean;
  hasLi: boolean; hasWa: boolean; isDark: boolean;
}) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      {hasDeep ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Telescope className="w-3 h-3 text-primary" />
          </TooltipTrigger>
          <TooltipContent side="top" className="text-[10px]">Deep Search ✓</TooltipContent>
        </Tooltip>
      ) : (
        <StatusDot ok={hasProfile} label="Profilo" isDark={isDark} />
      )}
      {hasLi ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Linkedin className="w-3 h-3 text-primary" />
          </TooltipTrigger>
          <TooltipContent side="top" className="text-[10px]">LinkedIn ✓</TooltipContent>
        </Tooltip>
      ) : (
        <StatusDot ok={hasEmail} label="Email" isDark={isDark} />
      )}
      {hasWa ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <MessageCircle className="w-3 h-3 text-emerald-500 fill-emerald-500" />
          </TooltipTrigger>
          <TooltipContent side="top" className="text-[10px]">WhatsApp ✓</TooltipContent>
        </Tooltip>
      ) : (
        <StatusDot ok={hasPhone} label="Telefono" isDark={isDark} />
      )}
    </div>
  );
}

/* ── Horizontal Wizard Step ── */
export function HorizStep({ step, active, done, isDark, icon: Icon, label, missing }: {
  step: number; active: boolean; done: boolean; isDark: boolean;
  icon: any; label: string; missing: number;
}) {
  return (
    <div className={cn(
      "flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all flex-1",
      done ? "bg-emerald-500/10"
        : active ? "bg-primary/15 ring-1 ring-primary/30"
        : "bg-muted/20 opacity-40"
    )}>
      <span className={cn(
        "w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0",
        done ? "bg-emerald-500/20 text-emerald-400" : active ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
      )}>
        {done ? <CheckCircle2 className="w-3 h-3" /> : step}
      </span>
      <Icon className={cn("w-3 h-3 shrink-0", done ? "text-emerald-400" : active ? "text-primary" : "text-muted-foreground")} />
      <span className={cn("text-[10px] font-bold truncate", done ? "text-emerald-500" : active ? "text-primary" : "text-muted-foreground")}>
        {label}
      </span>
      <span className={cn("text-[9px] font-mono font-bold ml-auto shrink-0", done ? "text-emerald-400" : "text-muted-foreground")}>
        {done ? "✓" : missing}
      </span>
    </div>
  );
}

/* ── Download Choice Card (compact) ── */
export function DownloadChoice({ selected, onClick, isDark, icon: Icon, title, description, count, color }: {
  selected: boolean; onClick: () => void; isDark: boolean;
  icon: any; title: string; description: string; count: number; color: string;
}) {
  return (
    <button onClick={onClick} className={cn(
      "w-full text-left rounded-lg border px-2.5 py-1.5 transition-all flex items-center gap-2",
      selected
        ? "bg-primary/10 border-primary/40 ring-1 ring-primary/20"
        : "bg-card border-border hover:bg-muted/50"
    )}>
      <div className={cn(
        "w-6 h-6 rounded-md shrink-0 flex items-center justify-center",
        selected ? "bg-primary/20" : "bg-muted"
      )}>
        <Icon className={cn("w-3.5 h-3.5", selected ? "text-primary" : "text-muted-foreground")} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-[11px] font-bold", "text-foreground")}>{title}</p>
        <p className="text-[9px] leading-tight text-muted-foreground">{description}</p>
      </div>
      <span className={cn("text-sm font-mono font-extrabold shrink-0", color)}>{count}</span>
      <div className={cn(
        "w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0",
        selected ? "border-primary bg-primary" : "border-border"
      )}>
        {selected && <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />}
      </div>
    </button>
  );
}

/* ── Filter Action Bar ── */
export function FilterActionBar({ filter, count, isDark, onDownload, onDeepSearch, onGenerateAlias, deepSearchRunning, aliasGenerating }: {
  filter: string;
  count: number;
  isDark: boolean;
  onDownload: () => void | Promise<void>;
  onDeepSearch: () => void;
  onGenerateAlias: (type: "company" | "contact") => void;
  deepSearchRunning?: boolean;
  aliasGenerating?: boolean;
}) {
  const configs: Record<string, { icon: any; label: string; action: () => void; disabled?: boolean; color: string }> = {
    profiles: { icon: Download, label: "Scarica Profili Filtrati", action: onDownload, color: "bg-primary hover:bg-primary/90" },
    email: { icon: Download, label: "Scarica Profili Filtrati", action: onDownload, color: "bg-primary hover:bg-primary/90" },
    phone: { icon: Download, label: "Scarica Profili Filtrati", action: onDownload, color: "bg-primary hover:bg-primary/90" },
    deep: { icon: Telescope, label: "Avvia Deep Search", action: onDeepSearch, disabled: deepSearchRunning, color: "bg-primary hover:bg-primary/90" },
    alias_co: { icon: Building2, label: "Genera Alias Azienda", action: () => onGenerateAlias("company"), disabled: aliasGenerating, color: "bg-primary hover:bg-primary/90" },
    alias_ct: { icon: UserCircle, label: "Genera Alias Contatto", action: () => onGenerateAlias("contact"), disabled: aliasGenerating, color: "bg-primary hover:bg-primary/90" },
  };

  const cfg = configs[filter];
  if (!cfg) return null;
  const Icon = cfg.icon;

  return (
    <div className={cn(
      "flex items-center gap-2 px-2 py-1.5 rounded-xl border animate-in fade-in slide-in-from-top-2 duration-150",
      "bg-muted/30 border-border"
    )}>
      <button
        onClick={cfg.action}
        disabled={cfg.disabled || count === 0}
        className={cn(
          "flex-1 flex items-center justify-center gap-1.5 h-7 rounded-lg text-[11px] font-bold text-primary-foreground transition-all disabled:opacity-40",
          cfg.color
        )}
      >
        <Icon className="w-3.5 h-3.5" />
        {cfg.label} ({count})
      </button>
      <Button variant="ghost" size="sm" className="h-7 text-[10px] px-2" onClick={cfg.action} title="Chiudi">
        ✕
      </Button>
    </div>
  );
}
