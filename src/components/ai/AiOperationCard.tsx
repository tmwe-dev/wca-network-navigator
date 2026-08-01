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
  download: { bg: "bg-primary/10", border: "border-primary/25", icon: "text-primary", accent: "bg-primary" },
  deep_search: { bg: "bg-primary/10", border: "border-primary/25", icon: "text-primary", accent: "bg-primary" },
  email_send: { bg: "bg-primary/10", border: "border-primary/25", icon: "text-primary", accent: "bg-primary" },
  linkedin_scrape: { bg: "bg-muted", border: "border-border", icon: "text-muted-foreground", accent: "bg-muted-foreground" },
  directory_scan: { bg: "bg-emerald-500/10", border: "border-emerald-500/25", icon: "text-emerald-400", accent: "bg-emerald-500" },
  enrichment: { bg: "bg-primary/10", border: "border-primary/25", icon: "text-primary", accent: "bg-primary" },
  bulk_update: { bg: "bg-muted", border: "border-border", icon: "text-muted-foreground", accent: "bg-muted-foreground" },
  import: { bg: "bg-emerald-500/10", border: "border-emerald-500/25", icon: "text-emerald-400", accent: "bg-emerald-500" },
  blacklist_check: { bg: "bg-destructive/10", border: "border-destructive/25", icon: "text-destructive", accent: "bg-destructive" },
  generic: { bg: "bg-muted", border: "border-border", icon: "text-muted-foreground", accent: "bg-muted-foreground" },
};

const STATUS_LABELS: Record<AiOperation["status"], { label: string; dot: string }> = {
  running: { label: "In esecuzione", dot: "bg-primary animate-pulse" },
  completed: { label: "Completato", dot: "bg-emerald-400" },
  failed: { label: "Errore", dot: "bg-destructive" },
  queued: { label: "In coda", dot: "bg-muted-foreground animate-pulse" },
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
