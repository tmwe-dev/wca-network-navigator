import { useState, lazy, Suspense } from "react";
import { LayoutGrid, List, Building2, FileSearch, Users, CreditCard, UserPlus } from "lucide-react";
const AddContactDialog = lazy(() => import("@/components/shared/AddContactDialog"));
import { cn } from "@/lib/utils";
import type { ViewMode } from "@/types/cockpit";

export type SourceTab = "all" | "wca" | "prospect" | "contact" | "bca";

export interface CockpitAIAction {
  type: "filter" | "select_all" | "clear_selection" | "select_where" | "bulk_action" | "single_action" | "view_mode" | "auto_outreach";
  filters?: import("@/types/cockpit").CockpitFilter[];
  field?: string;
  operator?: string;
  value?: unknown;
  action?: string;
  contactName?: string;
  mode?: ViewMode;
  channel?: string;
  contactNames?: string[];
}

interface TopCommandBarProps {
  onAIActions: (actions: CockpitAIAction[], message: string) => void;
  viewMode: ViewMode;
  onViewChange: (mode: ViewMode) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  contacts: Array<{ id: string; name: string; company: string; country: string; priority: number; language: string; channels: string[] }>;
  sourceTab: SourceTab;
  onSourceTabChange: (tab: SourceTab) => void;
}

const SOURCE_TABS: { value: SourceTab; label: string; icon: typeof Building2 }[] = [
  { value: "all", label: "Tutti", icon: Users },
  { value: "wca", label: "WCA", icon: Building2 },
  { value: "prospect", label: "Prospect", icon: FileSearch },
  { value: "contact", label: "Contatti", icon: Users },
  { value: "bca", label: "BCA", icon: CreditCard },
];

export function TopCommandBar({ viewMode, onViewChange, sourceTab, onSourceTabChange }: TopCommandBarProps) {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <>
      <div className="px-3 py-1.5 border-b border-border/30">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-0.5 flex-1 min-w-0 overflow-x-auto scrollbar-none">
            {SOURCE_TABS.map(st => (
              <button
                key={st.value}
                type="button"
                onClick={() => onSourceTabChange(st.value)}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all duration-200 whitespace-nowrap",
                  sourceTab === st.value
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : "text-muted-foreground/70 hover:text-foreground hover:bg-muted/40"
                )}
              >
                <st.icon className="w-3 h-3" />
                {st.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium text-muted-foreground/70 hover:text-foreground hover:bg-muted/40 transition-all duration-200 ml-0.5 border border-dashed border-border/50 whitespace-nowrap"
            >
              <UserPlus className="w-3 h-3" />
              Nuovo
            </button>
          </div>
          <div className="flex items-center rounded-md border border-border/60 bg-card/60 p-0.5">
            <button
              type="button"
              onClick={() => onViewChange("card")}
              className={cn(
                "p-1 rounded transition-all duration-200",
                viewMode === "card" ? "bg-primary/20 text-primary" : "text-muted-foreground/70 hover:text-foreground"
              )}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onViewChange("list")}
              className={cn(
                "p-1 rounded transition-all duration-200",
                viewMode === "list" ? "bg-primary/20 text-primary" : "text-muted-foreground/70 hover:text-foreground"
              )}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {addOpen && (
        <Suspense fallback={null}>
          <AddContactDialog open={addOpen} onOpenChange={setAddOpen} defaultDestination="cockpit" />
        </Suspense>
      )}
    </>
  );
}
