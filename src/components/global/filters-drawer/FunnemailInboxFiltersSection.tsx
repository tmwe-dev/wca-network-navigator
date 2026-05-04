/**
 * FunnemailInboxFiltersSection — filtri sidebar della Inbox Funnemail.
 *
 * Espone: ricerca testo, vista (tutte/non lette/urgenti/agenda/commerciali),
 * cartelle dinamiche caricate da DB (operative + archive + sorting).
 *
 * Tutta la logica vive in `useGlobalFilters` + DAL `funnemailInbox`.
 */
import { useQuery } from "@tanstack/react-query";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { queryKeys } from "@/lib/queryKeys";
import { listFunnemailGroupedInbox, type FunnemailGroupedInbox } from "@/data/funnemailInbox";
import { useAuth } from "@/providers/AuthProvider";
import { InboxGroupsSidebar } from "@/v2/ui/pages/funnemail-inbox/InboxGroupsSidebar";

const PAGE_SIZE = 20000;

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