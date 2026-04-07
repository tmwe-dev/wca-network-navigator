import { useState, useCallback } from "react";
import type { ViewMode } from "@/pages/Cockpit";
import type { SourceTab } from "@/components/cockpit/TopCommandBar";

export function useCockpitViewState() {
  const [viewMode, setViewMode] = useState<ViewMode>("card");
  const [sourceTab, setSourceTab] = useState<SourceTab>("all");
  const [activeFilters, setActiveFilters] = useState<import("@/pages/Cockpit").CockpitFilter[]>([]);
  const [batchMode, setBatchMode] = useState(false);
  const [showLinkedInFlow, setShowLinkedInFlow] = useState(false);

  const handleRemoveFilter = useCallback((filterId: string) => {
    setActiveFilters(prev => prev.filter(f => f.id !== filterId));
  }, []);

  return {
    viewMode, setViewMode,
    sourceTab, setSourceTab,
    activeFilters, setActiveFilters,
    handleRemoveFilter,
    batchMode, setBatchMode,
    showLinkedInFlow, setShowLinkedInFlow,
  };
}
