/**
 * FunnemailInboxFiltersSection — filtri sidebar della Inbox Funnemail.
 *
 * Espone: ricerca testo, vista (tutte/non lette/urgenti/agenda/commerciali),
 * cartelle dinamiche caricate da DB (operative + archive + sorting).
 *
 * Tutta la logica vive in `useGlobalFilters` + DAL `funnemailInbox`.
 */
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import type { FunnemailGroupedInbox } from "@/data/funnemailInbox";
import { useFunnemailInboxSidebarData } from "@/hooks/useFunnemailInboxSidebarData";
import { InboxGroupsSidebar } from "@/v2/ui/pages/funnemail-inbox/InboxGroupsSidebar";

export function FunnemailInboxFiltersSection() {
  const g = useGlobalFilters();
  const groupedQ = useFunnemailInboxSidebarData();

  const grouped: FunnemailGroupedInbox = groupedQ.data ?? { folders: [], counts: {}, messages: [] };

  return (
    <InboxGroupsSidebar
        folders={grouped.folders}
        counts={grouped.counts}
        selectedFolder={g.filters.funnemailFolder}
        totalCount={grouped.messages.length}
        loading={groupedQ.isLoading}
        onSelect={(slug) => g.setFilter("funnemailFolder", slug)}
        variant="drawer"
    />
  );
}