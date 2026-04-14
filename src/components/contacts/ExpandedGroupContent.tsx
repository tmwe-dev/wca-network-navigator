import { useState, useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ContactCard } from "./ContactCard";
import { sortContacts, type SortKey } from "./contactHelpers";
import { useContactsByGroup } from "@/hooks/useContactGroups";
import { useSelection } from "@/hooks/useSelection";
import { useContactInteractions } from "@/hooks/useContacts";

interface ExpandedGroupContentProps {
  groupType: string;
  groupKey: string;
  selectedId: string | null;
  onSelect: (contact: Record<string, unknown>) => void;
  selection: ReturnType<typeof useSelection>;
  holdingPattern?: "out" | "in" | "all";
  sortKey: SortKey;
  searchFilter?: string;
}

export function ExpandedGroupContent({ groupType, groupKey, selectedId, onSelect, selection, holdingPattern, sortKey, searchFilter }: ExpandedGroupContentProps) {
  const [page, setPage] = useState(0);
  const { data, isLoading } = useContactsByGroup(groupType, groupKey, page, 200, true, holdingPattern);
  const { data: _activeInteractions } = useContactInteractions(selectedId);
  const rawContacts = data?.items ?? [];

  const filtered = useMemo(() => {
    const search = searchFilter?.trim().toLowerCase();
    if (!search) return rawContacts;
    return rawContacts.filter((c) =>
      (c.company_name || "").toLowerCase().includes(search) ||
      (c.name || "").toLowerCase().includes(search) ||
      (c.email || "").toLowerCase().includes(search) ||
      (c.city || "").toLowerCase().includes(search) ||
      (c.company_alias || "").toLowerCase().includes(search) ||
      (c.contact_alias || "").toLowerCase().includes(search)
    );
  }, [rawContacts, searchFilter]);

  const contacts = useMemo(() => sortContacts(filtered, sortKey), [filtered, sortKey]);
  const totalCount = data?.totalCount ?? 0;
  const pageSize = data?.pageSize ?? 200;
  const totalPages = Math.ceil(totalCount / pageSize);

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: contacts.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 10,
  });

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
    <div className="flex flex-col">
      <div ref={parentRef} className="max-h-[400px] overflow-y-auto p-2">
        <div style={{ height: `${virtualizer.getTotalSize()}px`, width: "100%", position: "relative" }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const c = contacts[virtualRow.index];
            return (
              <div
                key={c.id}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <ContactCard
                  c={c as any} // eslint-disable-line @typescript-eslint/no-explicit-any -- Supabase JSON/dynamic type
                  isActive={selectedId === c.id}
                  isSelected={selection.selectedIds.has(c.id)}
                  onSelect={() => {}}
                  onViewDetail={() => onSelect(c)}
                  onToggle={() => selection.toggle(c.id)}
                  index={page * pageSize + virtualRow.index}
                  
                />
              </div>
            );
          })}
        </div>
      </div>
      {contacts.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-2">Nessun risultato</p>
      )}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 pt-1 text-[10px] text-muted-foreground">
          <Button variant="ghost" size="icon" aria-label="Precedente" className="h-5 w-5" disabled={page === 0} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="w-3 h-3" />
          </Button>
          <span>{page + 1}/{totalPages}</span>
          <Button variant="ghost" size="icon" aria-label="Successivo" className="h-5 w-5" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
            <ChevronRight className="w-3 h-3" />
          </Button>
        </div>
      )}
    </div>
  );
}
