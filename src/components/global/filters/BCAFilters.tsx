import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Search, Filter, Users } from "lucide-react";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { FilterSection, ChipGroup, Chip } from "./shared";

export function BCAFilters() {
  const g = useGlobalFilters();
  const [bcaEvents, setBcaEvents] = useState<{ name: string; count: number }[]>([]);
  const [bcaStatuses, setBcaStatuses] = useState<{ status: string; count: number }[]>([]);
  const [bcaStatusFilter, setBcaStatusFilter] = useState("all");
  const [bcaEventFilter, setBcaEventFilter] = useState("");

  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data } = await supabase
          .from("business_cards")
          .select("event_name, match_status");
        if (!data) return;
        const evCounts: Record<string, number> = {};
        const stCounts: Record<string, number> = {};
        data.forEach((r: any) => {
          if (r.event_name) evCounts[r.event_name] = (evCounts[r.event_name] || 0) + 1;
          const st = r.match_status || "pending";
          stCounts[st] = (stCounts[st] || 0) + 1;
        });
        setBcaEvents(Object.entries(evCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count));
        setBcaStatuses(Object.entries(stCounts).map(([status, count]) => ({ status, count })));
      } catch (e) { console.error("[FiltersDrawer] failed to fetch BCA metadata:", e); }
    };
    fetchMeta();
  }, []);

  const STATUS_LABELS: Record<string, string> = {
    matched: "Match", unmatched: "No match", pending: "Attesa",
  };

  return (
    <>
      <FilterSection icon={Search} label="Cerca">
        <Input value={g.filters.search} onChange={e => g.setSearch(e.target.value)} placeholder="Cerca biglietto, azienda..." className="h-8 text-xs bg-muted/30 border-border/40" />
      </FilterSection>

      <FilterSection icon={Filter} label="Stato match">
        <ChipGroup>
          <Chip active={bcaStatusFilter === "all"} onClick={() => setBcaStatusFilter("all")}>Tutti</Chip>
          {bcaStatuses.map(s => (
            <Chip key={s.status} active={bcaStatusFilter === s.status} onClick={() => setBcaStatusFilter(s.status)}>
              {STATUS_LABELS[s.status] || s.status} ({s.count})
            </Chip>
          ))}
        </ChipGroup>
      </FilterSection>

      {bcaEvents.length > 0 && (
        <FilterSection icon={Users} label="Evento">
          <ChipGroup>
            <Chip active={bcaEventFilter === ""} onClick={() => setBcaEventFilter("")}>Tutti</Chip>
            {bcaEvents.map(e => (
              <Chip key={e.name} active={bcaEventFilter === e.name} onClick={() => setBcaEventFilter(e.name)}>
                {e.name} ({e.count})
              </Chip>
            ))}
          </ChipGroup>
        </FilterSection>
      )}
    </>
  );
}
