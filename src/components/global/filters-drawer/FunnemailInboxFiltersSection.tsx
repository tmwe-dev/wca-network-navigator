/**
 * FunnemailInboxFiltersSection — filtri sidebar della Inbox Funnemail.
 *
 * Espone: ricerca testo, vista (tutte/non lette/urgenti/agenda/commerciali),
 * cartelle dinamiche caricate da DB (operative + archive + sorting).
 *
 * Tutta la logica vive in `useGlobalFilters` + DAL `funnemailInbox`.
 */
import { Search, Eye } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { FilterSection, ChipGroup, Chip } from "./shared";
import { queryKeys } from "@/lib/queryKeys";
import { listFunnemailGroupedInbox, type FunnemailGroupedInbox } from "@/data/funnemailInbox";
import { useAuth } from "@/providers/AuthProvider";
import { InboxGroupsSidebar } from "@/v2/ui/pages/funnemail-inbox/InboxGroupsSidebar";

const VIEW_OPTIONS: Array<{ value: "all" | "unread" | "urgent" | "agenda" | "commercial"; label: string }> = [
  { value: "all", label: "Tutte" },
  { value: "unread", label: "Non lette" },
  { value: "urgent", label: "Urgenti" },
  { value: "agenda", label: "In agenda" },
  { value: "commercial", label: "Commerciali" },
];

const PAGE_SIZE = 5000;

export function FunnemailInboxFiltersSection() {
  const g = useGlobalFilters();
  const { user } = useAuth();

  const groupedQ = useQuery({
    queryKey: queryKeys.funnemailInbox.grouped(user?.id ?? "anon", PAGE_SIZE),
    queryFn: () => listFunnemailGroupedInbox(user!.id, PAGE_SIZE),
    enabled: !!user?.id,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const grouped: FunnemailGroupedInbox = groupedQ.data ?? { folders: [], counts: {}, messages: [] };

  return (
    <>
      <FilterSection icon={Search} label="Cerca">
        <Input
          value={g.filters.funnemailSearch}
          onChange={(e) => g.setFilter("funnemailSearch", e.target.value)}
          placeholder="Oggetto o mittente..."
          className="h-8 text-xs bg-muted/30 border-border/40"
        />
      </FilterSection>

      <FilterSection icon={Eye} label="Vista">
        <ChipGroup>
          {VIEW_OPTIONS.map((o) => (
            <Chip
              key={o.value}
              active={g.filters.funnemailView === o.value}
              onClick={() => g.setFilter("funnemailView", o.value)}
            >
              {o.label}
            </Chip>
          ))}
        </ChipGroup>
      </FilterSection>

      <InboxGroupsSidebar
        folders={grouped.folders}
        counts={grouped.counts}
        selectedFolder={g.filters.funnemailFolder}
        totalCount={grouped.messages.length}
        loading={groupedQ.isLoading}
        onSelect={(slug) => g.setFilter("funnemailFolder", slug)}
        variant="drawer"
      />
    </>
  );
}