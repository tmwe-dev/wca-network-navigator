import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Download, Telescope, Building2, UserCircle, CheckCircle2,
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
              ? isDark ? "bg-emerald-500/15 text-emerald-400" : "bg-emerald-50 text-emerald-600"
              : verifiedMissing
                ? isDark ? "bg-emerald-500/10 text-emerald-400" : "bg-emerald-50/80 text-emerald-500"
                : active
                  ? isDark ? "bg-sky-500/20 text-sky-400 ring-1 ring-sky-400/40" : "bg-sky-100 text-sky-600 ring-1 ring-sky-300"
                  : isDark ? "bg-white/[0.05] text-slate-400 hover:bg-white/[0.1]" : "bg-slate-100 text-slate-500 hover:bg-slate-200",
            done ? "cursor-default" : "cursor-pointer"
          )}
        >
          <Icon className="w-3.5 h-3.5" />
          {count > 0 && (
            <span className={cn(
              "absolute -top-1 -right-1 min-w-[14px] h-[14px] rounded-full flex items-center justify-center text-[8px] font-bold leading-none px-0.5",
              active ? "bg-sky-500 text-white" : verifiedMissing ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
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
          ok ? "bg-emerald-500" : isDark ? "bg-white/[0.1]" : "bg-slate-200"
        )} />
      </TooltipTrigger>
      <TooltipContent side="top" className="text-[10px]">
        {ok ? `${label} ✓` : `${label} mancante`}
      </TooltipContent>
    </Tooltip>
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
      done ? isDark ? "bg-emerald-500/10" : "bg-emerald-50"
        : active ? isDark ? "bg-sky-500/15 ring-1 ring-sky-500/30" : "bg-sky-50 ring-1 ring-sky-200"
        : isDark ? "bg-white/[0.02] opacity-40" : "bg-slate-50/40 opacity-40"
    )}>
      <span className={cn(
        "w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0",
        done ? "bg-emerald-500/20 text-emerald-400" : active ? isDark ? "bg-sky-500/20 text-sky-400" : "bg-sky-100 text-sky-600" : isDark ? "bg-white/[0.06] text-slate-600" : "bg-slate-200 text-slate-400"
      )}>
        {done ? <CheckCircle2 className="w-3 h-3" /> : step}
      </span>
      <Icon className={cn("w-3 h-3 shrink-0", done ? "text-emerald-400" : active ? isDark ? "text-sky-400" : "text-sky-600" : isDark ? "text-slate-600" : "text-slate-400")} />
      <span className={cn("text-[10px] font-bold truncate", done ? "text-emerald-500" : active ? isDark ? "text-sky-300" : "text-sky-700" : isDark ? "text-slate-600" : "text-slate-400")}>
        {label}
      </span>
      <span className={cn("text-[9px] font-mono font-bold ml-auto shrink-0", done ? "text-emerald-400" : isDark ? "text-slate-500" : "text-slate-400")}>
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
        ? isDark ? "bg-sky-950/40 border-sky-400/40 ring-1 ring-sky-400/20" : "bg-sky-50 border-sky-300 ring-1 ring-sky-300/40"
        : isDark ? "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05]" : "bg-white/60 border-slate-200 hover:bg-slate-50"
    )}>
      <div className={cn(
        "w-6 h-6 rounded-md shrink-0 flex items-center justify-center",
        selected ? isDark ? "bg-sky-500/20" : "bg-sky-100" : isDark ? "bg-white/[0.04]" : "bg-slate-100"
      )}>
        <Icon className={cn("w-3.5 h-3.5", selected ? isDark ? "text-sky-400" : "text-sky-600" : isDark ? "text-slate-500" : "text-slate-400")} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-[11px] font-bold", isDark ? "text-slate-200" : "text-slate-700")}>{title}</p>
        <p className={cn("text-[9px] leading-tight", isDark ? "text-slate-500" : "text-slate-400")}>{description}</p>
      </div>
      <span className={cn("text-sm font-mono font-extrabold shrink-0", color)}>{count}</span>
      <div className={cn(
        "w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0",
        selected ? "border-sky-400 bg-sky-400" : isDark ? "border-slate-600" : "border-slate-300"
      )}>
        {selected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
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
    profiles: { icon: Download, label: "Scarica Profili Filtrati", action: onDownload, color: isDark ? "bg-sky-600 hover:bg-sky-500" : "bg-sky-500 hover:bg-sky-600" },
    email: { icon: Download, label: "Scarica Profili Filtrati", action: onDownload, color: isDark ? "bg-sky-600 hover:bg-sky-500" : "bg-sky-500 hover:bg-sky-600" },
    phone: { icon: Download, label: "Scarica Profili Filtrati", action: onDownload, color: isDark ? "bg-sky-600 hover:bg-sky-500" : "bg-sky-500 hover:bg-sky-600" },
    deep: { icon: Telescope, label: "Avvia Deep Search", action: onDeepSearch, disabled: deepSearchRunning, color: isDark ? "bg-cyan-600 hover:bg-cyan-500" : "bg-cyan-500 hover:bg-cyan-600" },
    alias_co: { icon: Building2, label: "Genera Alias Azienda", action: () => onGenerateAlias("company"), disabled: aliasGenerating, color: isDark ? "bg-amber-600 hover:bg-amber-500" : "bg-amber-500 hover:bg-amber-600" },
    alias_ct: { icon: UserCircle, label: "Genera Alias Contatto", action: () => onGenerateAlias("contact"), disabled: aliasGenerating, color: isDark ? "bg-pink-600 hover:bg-pink-500" : "bg-pink-500 hover:bg-pink-600" },
  };

  const cfg = configs[filter];
  if (!cfg) return null;
  const Icon = cfg.icon;

  return (
    <div className={cn(
      "flex items-center gap-2 px-2 py-1.5 rounded-xl border animate-in fade-in slide-in-from-top-2 duration-150",
      isDark ? "bg-white/[0.03] border-white/[0.08]" : "bg-slate-50/80 border-slate-200/60"
    )}>
      <button
        onClick={cfg.action}
        disabled={cfg.disabled || count === 0}
        className={cn(
          "flex-1 flex items-center justify-center gap-1.5 h-7 rounded-lg text-[11px] font-bold text-white transition-all disabled:opacity-40",
          cfg.color
        )}
      >
        <Icon className="w-3.5 h-3.5" />
        {cfg.label} ({count})
      </button>
      <Button variant="ghost" size="sm" className="h-7 text-[10px] px-2" onClick={() => {}}>
        ✕
      </Button>
    </div>
  );
}
