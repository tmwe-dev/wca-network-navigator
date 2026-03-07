import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ContactCard } from "./ContactCard";
import { sortContacts, type SortKey } from "./contactHelpers";
import { useContactsByGroup } from "@/hooks/useContactGroups";
import { useSelection } from "@/hooks/useSelection";

interface ExpandedGroupContentProps {
  groupType: string;
  groupKey: string;
  selectedId: string | null;
  onSelect: (contact: any) => void;
  selection: ReturnType<typeof useSelection>;
  holdingPattern?: "out" | "in" | "all";
  sortKey: SortKey;
}

export function ExpandedGroupContent({ groupType, groupKey, selectedId, onSelect, selection, holdingPattern, sortKey }: ExpandedGroupContentProps) {
  const [page, setPage] = useState(0);
  const { data, isLoading } = useContactsByGroup(groupType, groupKey, page, 200, true, holdingPattern);
  const rawContacts = data?.items ?? [];
  const contacts = useMemo(() => sortContacts(rawContacts, sortKey), [rawContacts, sortKey]);
  const totalCount = data?.totalCount ?? 0;
  const pageSize = data?.pageSize ?? 200;
  const totalPages = Math.ceil(totalCount / pageSize);

  if (isLoading) {
    return (
      <div className="p-2 space-y-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-2 space-y-1">
      {contacts.map((c: any) => (
        <ContactCard
          key={c.id}
          c={c}
          isActive={selectedId === c.id}
          isSelected={selection.selectedIds.has(c.id)}
          onSelect={() => onSelect(c)}
          onToggle={() => selection.toggle(c.id)}
        />
      ))}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 pt-1 text-[10px] text-muted-foreground">
          <Button variant="ghost" size="icon" className="h-5 w-5" disabled={page === 0} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="w-3 h-3" />
          </Button>
          <span>{page + 1}/{totalPages}</span>
          <Button variant="ghost" size="icon" className="h-5 w-5" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
            <ChevronRight className="w-3 h-3" />
          </Button>
        </div>
      )}
    </div>
  );
}
