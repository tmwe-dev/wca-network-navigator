import { type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface VerticalTab {
  value: string;
  label: string;
  icon: LucideIcon;
  badge?: number | string;
}

interface VerticalTabNavProps {
  tabs: VerticalTab[];
  value: string;
  onChange: (value: string) => void;
  filterSlot?: ReactNode;
}

export function VerticalTabNav({ tabs, value, onChange, filterSlot }: VerticalTabNavProps) {
  return (
    <nav className="flex flex-col w-[140px] shrink-0 border-r border-border/50 bg-muted/20 overflow-hidden">
      {/* Tab buttons */}
      <div className="py-1 flex-shrink-0">
        {tabs.map((tab) => {
          const active = value === tab.value;
          const Icon = tab.icon;
          return (
            <button
              key={tab.value}
              onClick={() => onChange(tab.value)}
              className={cn(
                "relative flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors text-left w-full",
                "hover:bg-primary/5 hover:text-foreground",
                active
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground"
              )}
            >
              {active && (
                <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full bg-primary" />
              )}
              <span className={cn(
                "flex items-center justify-center rounded-md p-0.5",
                tab.badge != null && Number(tab.badge) > 0 && "bg-destructive/15 text-destructive"
              )}>
                <Icon className="w-3.5 h-3.5 shrink-0" />
              </span>
              <span className="truncate">{tab.label}</span>
              {tab.badge != null && Number(tab.badge) > 0 && (
                <span className="ml-auto bg-destructive text-destructive-foreground text-[9px] rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                  {Number(tab.badge) > 99 ? "99+" : tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Dynamic filter slot — scrollable below tabs */}
      {filterSlot && (
        <div className="flex-1 min-h-0 overflow-y-auto border-t border-border/40 p-2">
          {filterSlot}
        </div>
      )}
    </nav>
  );
}
