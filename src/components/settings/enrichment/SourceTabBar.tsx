/**
 * SourceTabBar — Source tab navigation for enrichment view
 */
import { ReactNode } from "react";
import { Building2, Mail, Search, LayoutDashboard, Users, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SourceTab } from "@/hooks/useEnrichmentData";

interface SourceTabConfig {
  value: SourceTab;
  label: string;
  icon: ReactNode;
}

const SOURCE_TABS: SourceTabConfig[] = [
  { value: "all", label: "Tutti", icon: <Users className="w-3.5 h-3.5" /> },
  { value: "wca", label: "WCA", icon: <Building2 className="w-3.5 h-3.5" /> },
  { value: "contacts", label: "Contatti", icon: <Search className="w-3.5 h-3.5" /> },
  { value: "bca", label: "BCA", icon: <CreditCard className="w-3.5 h-3.5" /> },
  { value: "email", label: "Email Sender", icon: <Mail className="w-3.5 h-3.5" /> },
  { value: "cockpit", label: "Cockpit", icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
];

interface Props {
  activeTab: SourceTab;
  counts: Record<SourceTab, number> & { emailTotal: number };
  onTabChange: (tab: SourceTab) => void;
}

export function SourceTabBar({ activeTab, counts, onTabChange }: Props) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {SOURCE_TABS.map(tab => (
        <button
          key={tab.value}
          onClick={() => onTabChange(tab.value)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
            activeTab === tab.value
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted/50 text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          {tab.icon}
          {tab.label}
          <span className={cn(
            "ml-0.5 text-[10px] rounded-full px-1.5 py-0.5",
            activeTab === tab.value ? "bg-primary-foreground/20" : "bg-muted"
          )}>
            {counts[tab.value]}
          </span>
          {tab.value === "email" && activeTab === "email" && (
            <span className="text-[9px] text-muted-foreground ml-0.5">({counts.emailTotal} email)</span>
          )}
        </button>
      ))}
    </div>
  );
}
