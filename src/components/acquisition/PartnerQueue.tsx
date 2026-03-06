import { Check, Circle, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { getCountryFlag } from "@/lib/countries";

export type QueueItemStatus = "pending" | "active" | "done" | "error";

export interface QueueItem {
  wca_id: number;
  company_name: string;
  country_code: string;
  city: string;
  status: QueueItemStatus;
  alreadyDownloaded?: boolean;
  networks?: string[];
  skippedNetwork?: boolean;
}

interface PartnerQueueProps {
  items: QueueItem[];
  activeIndex: number;
  selectedIds: Set<number>;
  onToggle: (wcaId: number) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onPartnerClick?: (wcaId: number) => void;
}

export function PartnerQueue({ items, activeIndex: _activeIndex, selectedIds, onToggle, onSelectAll, onDeselectAll, onPartnerClick }: PartnerQueueProps) {
  const selectedCount = items.filter((i) => selectedIds.has(i.wca_id)).length;
  const allSelected = items.length > 0 && selectedCount === items.length;

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2.5 border-b border-white/[0.08] dark:border-white/[0.08] border-slate-200/60 flex items-center justify-between gap-2 bg-white/[0.02] dark:bg-white/[0.02] bg-white/30">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={allSelected}
            onCheckedChange={() => (allSelected ? onDeselectAll() : onSelectAll())}
            className="h-3.5 w-3.5"
          />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Coda Partner
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {selectedCount} sel. · {items.filter((i) => i.status === "done").length}/{items.length}
        </span>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {items.map((item) => (
            <div
              key={item.wca_id}
              onClick={() => item.status === "done" && onPartnerClick?.(item.wca_id)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all duration-300",
                item.status === "active" &&
                  "bg-sky-500/[0.08] border border-sky-500/30 shadow-md shadow-sky-500/[0.08] scale-[1.01]",
                item.status === "done" && "opacity-70 hover:opacity-100 hover:bg-emerald-500/[0.06] cursor-pointer",
                item.status === "pending" && "opacity-70 hover:bg-white/[0.04]",
                item.status === "error" && "bg-destructive/10 border border-destructive/20"
              )}
            >
              {/* Checkbox */}
              {item.status === "pending" && (
                <Checkbox
                  checked={selectedIds.has(item.wca_id)}
                  onCheckedChange={() => onToggle(item.wca_id)}
                  className="h-3.5 w-3.5 flex-shrink-0"
                />
              )}

              {/* Status icon */}
              <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                {item.status === "done" ? (
                  <Check className="w-4 h-4 text-emerald-500" />
                ) : item.status === "active" ? (
                  <Loader2 className="w-4 h-4 text-primary animate-spin" />
                ) : item.status === "error" ? (
                  <Circle className="w-4 h-4 text-destructive fill-destructive" />
                ) : (
                  <Circle className="w-3.5 h-3.5 text-muted-foreground/40" />
                )}
              </div>

              {/* Flag */}
              <span className="text-base flex-shrink-0">
                {getCountryFlag(item.country_code)}
              </span>

              {/* Name + City */}
              <div className="flex-1 min-w-0">
                <div className={cn(
                  "font-medium truncate text-xs",
                  item.status === "active" && "text-foreground",
                  item.status === "done" && "text-muted-foreground",
                  item.status === "pending" && "text-muted-foreground"
                )}>
                  {item.company_name}
                </div>
                <div className="text-[10px] text-muted-foreground/70 truncate">{item.city}</div>
              </div>

              {/* Already downloaded badge */}
              {item.alreadyDownloaded && item.status === "pending" && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  Già presente
                </span>
              )}

              {/* Skipped network badge */}
              {item.skippedNetwork && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground italic">
                  Network escluso
                </span>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
