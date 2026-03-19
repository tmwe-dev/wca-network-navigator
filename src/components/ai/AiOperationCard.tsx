import { Download, Search, Mail, Linkedin, Globe, Database, RefreshCw, Zap, FileSearch, Shield, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AiOperation {
  op_type: "download" | "deep_search" | "email_send" | "linkedin_scrape" | "directory_scan" | "enrichment" | "bulk_update" | "import" | "blacklist_check" | "generic";
  status: "running" | "completed" | "failed" | "queued";
  title: string;
  detail?: string;
  target?: string;
  count?: number;
  progress?: number; // 0-100
  source?: string;
  job_id?: string;
  eta_minutes?: number;
}

const OP_ICONS: Record<AiOperation["op_type"], React.ElementType> = {
  download: Download,
  deep_search: FileSearch,
  email_send: Mail,
  linkedin_scrape: Linkedin,
  directory_scan: Globe,
  enrichment: Search,
  bulk_update: Database,
  import: ArrowUpRight,
  blacklist_check: Shield,
  generic: Zap,
};

const OP_COLORS: Record<AiOperation["op_type"], { bg: string; border: string; icon: string; accent: string }> = {
  download: { bg: "bg-sky-500/10", border: "border-sky-500/25", icon: "text-sky-400", accent: "bg-sky-500" },
  deep_search: { bg: "bg-violet-500/10", border: "border-violet-500/25", icon: "text-violet-400", accent: "bg-violet-500" },
  email_send: { bg: "bg-amber-500/10", border: "border-amber-500/25", icon: "text-amber-400", accent: "bg-amber-500" },
  linkedin_scrape: { bg: "bg-blue-500/10", border: "border-blue-500/25", icon: "text-blue-400", accent: "bg-blue-500" },
  directory_scan: { bg: "bg-emerald-500/10", border: "border-emerald-500/25", icon: "text-emerald-400", accent: "bg-emerald-500" },
  enrichment: { bg: "bg-orange-500/10", border: "border-orange-500/25", icon: "text-orange-400", accent: "bg-orange-500" },
  bulk_update: { bg: "bg-indigo-500/10", border: "border-indigo-500/25", icon: "text-indigo-400", accent: "bg-indigo-500" },
  import: { bg: "bg-teal-500/10", border: "border-teal-500/25", icon: "text-teal-400", accent: "bg-teal-500" },
  blacklist_check: { bg: "bg-red-500/10", border: "border-red-500/25", icon: "text-red-400", accent: "bg-red-500" },
  generic: { bg: "bg-slate-500/10", border: "border-slate-500/25", icon: "text-slate-400", accent: "bg-slate-500" },
};

const STATUS_LABELS: Record<AiOperation["status"], { label: string; dot: string }> = {
  running: { label: "In esecuzione", dot: "bg-amber-400 animate-pulse" },
  completed: { label: "Completato", dot: "bg-emerald-400" },
  failed: { label: "Errore", dot: "bg-red-400" },
  queued: { label: "In coda", dot: "bg-slate-400 animate-pulse" },
};

export function AiOperationCard({ op }: { op: AiOperation }) {
  const Icon = OP_ICONS[op.op_type] || Zap;
  const colors = OP_COLORS[op.op_type] || OP_COLORS.generic;
  const statusInfo = STATUS_LABELS[op.status];

  return (
    <div className={cn("mt-2 rounded-lg border px-3 py-2.5 text-[11px]", colors.bg, colors.border)}>
      {/* Header row */}
      <div className="flex items-center gap-2">
        <div className={cn("p-1 rounded-md", colors.bg)}>
          <Icon className={cn("w-3.5 h-3.5", colors.icon)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-foreground truncate">{op.title}</div>
          {op.target && (
            <div className="text-muted-foreground text-[10px] truncate">{op.target}</div>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={cn("w-1.5 h-1.5 rounded-full", statusInfo.dot)} />
          <span className="text-muted-foreground text-[10px] font-medium">{statusInfo.label}</span>
        </div>
      </div>

      {/* Progress bar */}
      {typeof op.progress === "number" && op.status === "running" && (
        <div className="mt-2 h-1 rounded-full bg-muted/30 overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-500", colors.accent)}
            style={{ width: `${Math.min(100, op.progress)}%` }}
          />
        </div>
      )}

      {/* Detail row */}
      {(op.detail || op.count || op.eta_minutes || op.source) && (
        <div className="mt-1.5 flex items-center gap-3 text-[10px] text-muted-foreground">
          {op.detail && <span className="flex-1 truncate">{op.detail}</span>}
          {op.count != null && <span className="shrink-0 font-medium">{op.count} elementi</span>}
          {op.source && <span className="shrink-0 opacity-70">via {op.source}</span>}
          {op.eta_minutes != null && op.status === "running" && (
            <span className="shrink-0 flex items-center gap-0.5">
              <RefreshCw className="w-2.5 h-2.5 animate-spin" />
              ~{op.eta_minutes} min
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function AiOperationCards({ operations }: { operations: AiOperation[] }) {
  if (!operations.length) return null;
  return (
    <div className="space-y-1.5">
      {operations.map((op, i) => (
        <AiOperationCard key={`${op.op_type}-${op.job_id || i}`} op={op} />
      ))}
    </div>
  );
}
