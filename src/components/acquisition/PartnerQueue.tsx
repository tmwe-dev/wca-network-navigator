import { Check, Circle, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
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
}

interface PartnerQueueProps {
  items: QueueItem[];
  activeIndex: number;
}

export function PartnerQueue({ items, activeIndex }: PartnerQueueProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Coda Partner
        </span>
        <span className="text-xs text-muted-foreground">
          {items.filter((i) => i.status === "done").length}/{items.length}
        </span>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {items.map((item, idx) => (
            <div
              key={item.wca_id}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-300",
                item.status === "active" &&
                  "bg-primary/10 border border-primary/30 shadow-sm shadow-primary/10",
                item.status === "done" && "opacity-60",
                item.status === "pending" && "opacity-70",
                item.status === "error" && "bg-destructive/10 border border-destructive/20"
              )}
            >
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
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
