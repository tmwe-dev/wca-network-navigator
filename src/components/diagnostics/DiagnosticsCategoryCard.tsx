/**
 * DiagnosticsCategoryCard — collapsible category with test rows
 */
import {
  CheckCircle2, XCircle, Loader2, Clock, AlertTriangle,
  Database, Shield, Globe, Zap, HardDrive, Link2,
  ChevronDown, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TestResult, TestStatus } from "@/hooks/diagnostics/types";

function statusIcon(s: TestStatus) {
  switch (s) {
    case "pass": return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />;
    case "fail": return <XCircle className="w-4 h-4 text-destructive shrink-0" />;
    case "warn": return <AlertTriangle className="w-4 h-4 text-primary shrink-0" />;
    case "running": return <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />;
    default: return <Clock className="w-4 h-4 text-muted-foreground shrink-0" />;
  }
}

function getCatIcon(cat: string) {
  if (cat.includes("Auth")) return Shield;
  if (cat.includes("Database")) return Database;
  if (cat.includes("Edge")) return Zap;
  if (cat.includes("Storage")) return HardDrive;
  if (cat.includes("RPC")) return Link2;
  return Globe;
}

interface Props {
  readonly category: string;
  readonly items: readonly TestResult[];
  readonly expanded: boolean;
  readonly onToggle: () => void;
}

export function DiagnosticsCategoryCard({ category, items, expanded, onToggle }: Props) {
  const fails = items.filter(r => r.status === "fail").length;
  const warns = items.filter(r => r.status === "warn").length;
  const isExpanded = expanded || fails > 0 || warns > 0;
  const CatIcon = getCatIcon(category);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 bg-muted/20 hover:bg-muted/40 transition-colors text-left"
      >
        {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        <CatIcon className="w-4 h-4 text-muted-foreground" />
        <span className="font-medium text-sm text-foreground flex-1">{category}</span>
        <span className="text-xs text-muted-foreground">{items.length} test</span>
        {fails > 0 && <span className="text-xs px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">{fails} fail</span>}
        {warns > 0 && <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">{warns} warn</span>}
        {fails === 0 && warns === 0 && items.every(i => i.status === "pass") && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500">All pass</span>
        )}
      </button>
      {isExpanded && (
        <div className="divide-y divide-border">
          {items.map(r => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-2 text-sm">
              {statusIcon(r.status)}
              <span className="font-mono text-foreground flex-1 min-w-0 truncate">{r.name}</span>
              {r.durationMs !== undefined && (
                <span className="text-[10px] text-muted-foreground shrink-0">{r.durationMs}ms</span>
              )}
              {r.message && (
                <span className={cn(
                  "text-xs truncate max-w-[300px]",
                  r.status === "fail" ? "text-destructive" : r.status === "warn" ? "text-primary" : "text-muted-foreground"
                )}>{r.message}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
