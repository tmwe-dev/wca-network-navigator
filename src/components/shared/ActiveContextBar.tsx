import { useMission } from "@/contexts/MissionContext";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { Target, FileText, Users, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";

function Chip({
  icon: Icon,
  label,
  empty,
  onClick,
  onRemove,
}: {
  icon: React.ElementType;
  label: string;
  empty?: boolean;
  onClick: () => void;
  onRemove?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors border max-w-[200px] group",
        empty
          ? "border-border/40 text-muted-foreground hover:border-primary/30 hover:text-foreground bg-muted/20"
          : "border-primary/20 text-foreground bg-primary/5 hover:bg-primary/10"
      )}
    >
      <Icon className="w-3 h-3 shrink-0" />
      <span className="truncate">{label}</span>
      {onRemove && !empty && (
        <span
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive"
        >
          <X className="w-2.5 h-2.5" />
        </span>
      )}
    </button>
  );
}

const openDrawer = (drawer: "mission" | "filters") => {
  window.dispatchEvent(new CustomEvent("open-drawer", { detail: { drawer } }));
};

export function ActiveContextBar() {
  const { goal, setGoal, baseProposal, setBaseProposal, recipients, removeRecipient: _removeRecipient } = useMission();
  const { filters } = useGlobalFilters();

  const activeFilterCount = [
    filters.search,
    filters.origin.size > 0,
    filters.quality && filters.quality !== "all",
    filters.leadStatus && filters.leadStatus !== "all",
    filters.holdingPattern && filters.holdingPattern !== "all",
  ].filter(Boolean).length;

  const hasAnything = goal || baseProposal || recipients.length > 0 || activeFilterCount > 0;

  return (
    <div className="shrink-0 flex items-center gap-1.5 px-4 py-1.5 border-b border-border/30 bg-muted/10 overflow-x-auto">
      {/* Goal */}
      <Chip
        icon={Target}
        label={goal ? (goal.length > 30 ? goal.slice(0, 30) + "…" : goal) : "Obiettivo →"}
        empty={!goal}
        onClick={() => openDrawer("mission")}
        onRemove={goal ? () => setGoal("") : undefined}
      />

      {/* Proposta */}
      <Chip
        icon={FileText}
        label={baseProposal ? (baseProposal.length > 30 ? baseProposal.slice(0, 30) + "…" : baseProposal) : "Proposta →"}
        empty={!baseProposal}
        onClick={() => openDrawer("mission")}
        onRemove={baseProposal ? () => setBaseProposal("") : undefined}
      />

      {/* Recipients */}
      <Chip
        icon={Users}
        label={recipients.length > 0 ? `${recipients.length} destinatari` : "Destinatari →"}
        empty={recipients.length === 0}
        onClick={() => openDrawer("mission")}
      />

      {/* Filters */}
      {activeFilterCount > 0 && (
        <Chip
          icon={SlidersHorizontal}
          label={`${activeFilterCount} filtri`}
          onClick={() => openDrawer("filters")}
        />
      )}

      {!hasAnything && (
        <span className="text-[10px] text-muted-foreground/60 ml-1">
          Usa le sidebar per configurare obiettivo, proposta e destinatari
        </span>
      )}
    </div>
  );
}
