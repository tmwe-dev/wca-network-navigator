/**
 * CompanyCardList — vista standard "Card-azienda con contatti dentro".
 *
 * Standard unico per:
 *  - WCA Partner   (`/v2/explore/network`)
 *  - Contatti CRM  (`/v2/explore/contacts`)
 *  - Biglietti     (`/v2/explore/biglietti`, già nativo in BCAUnifiedHub)
 *
 * Strategia performance:
 *  - Card collassate di default (header-only, 0 fetch contatti).
 *  - Virtualizzazione con @tanstack/react-virtual.
 *  - Lazy-load dei contatti on-expand tramite `onExpand`.
 */
import * as React from "react";
import { useRef, useMemo, useState, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { CompanyCard } from "./CompanyCard";
import type { CompanyEntity, CompanyCardListCallbacks } from "./types";

export interface CompanyCardListProps extends CompanyCardListCallbacks {
  companies: CompanyEntity[];
  isLoading?: boolean;
  emptyMessage?: string;
  /** Espande tutte le card di default (sconsigliato per >200 elementi). */
  defaultExpanded?: boolean;
  /** Stima altezza per virtualizzazione (header collassato). */
  estimateRowSize?: number;
}

const COLLAPSED_ROW = 60;        // header card (px)
const EXPANDED_BASE = 60;        // header
const EXPANDED_PER_CONTACT = 56; // ogni contatto in grid 2-col

export function CompanyCardList({
  companies,
  isLoading = false,
  emptyMessage = "Nessun risultato",
  defaultExpanded = false,
  estimateRowSize = COLLAPSED_ROW,
  onOpenCompany,
  onOpenContact,
  onExpand,
}: CompanyCardListProps): React.ReactElement {
  const parentRef = useRef<HTMLDivElement>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    if (!defaultExpanded) return new Set<string>();
    return new Set(companies.map((c) => c.id));
  });

  const handleToggleExpand = useCallback(
    (id: string) => {
      setExpandedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
          const c = companies.find((x) => x.id === id);
          if (c && c.contacts === undefined) onExpand?.(c);
        }
        return next;
      });
    },
    [companies, onExpand]
  );

  const estimateSize = useCallback(
    (index: number) => {
      const c = companies[index];
      if (!c) return estimateRowSize;
      if (!expandedIds.has(c.id)) return COLLAPSED_ROW + 16; // + gap
      const rows = Math.max(1, Math.ceil((c.contactsCount || 0) / 2));
      return EXPANDED_BASE + rows * EXPANDED_PER_CONTACT + 24 + 16;
    },
    [companies, expandedIds, estimateRowSize]
  );

  const virtualizer = useVirtualizer({
    count: companies.length,
    getScrollElement: () => parentRef.current,
    estimateSize,
    overscan: 6,
    getItemKey: (i) => companies[i]?.id ?? i,
  });

  const items = virtualizer.getVirtualItems();

  const total = companies.length;
  const summary = useMemo(() => {
    const totalContacts = companies.reduce((s, c) => s + (c.contactsCount || 0), 0);
    return `${total} aziend${total === 1 ? "a" : "e"} · ${totalContacts} contatt${totalContacts === 1 ? "o" : "i"}`;
  }, [companies, total]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center py-10">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 py-10">
        <p className="text-sm text-muted-foreground/60">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between px-1 pb-2">
        <span className="text-[11px] text-muted-foreground">{summary}</span>
      </div>
      <div ref={parentRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {items.map((virtualRow) => {
            const company = companies[virtualRow.index];
            if (!company) return null;
            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                  paddingBottom: 12,
                }}
              >
                <CompanyCard
                  company={company}
                  expanded={expandedIds.has(company.id)}
                  onToggleExpand={handleToggleExpand}
                  onOpenCompany={onOpenCompany}
                  onOpenContact={onOpenContact}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default CompanyCardList;