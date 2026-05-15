/**
 * CompanyCardList — vista standard "Card-azienda" header-only.
 *
 * Standard unico per WCA Partner, Contatti CRM, Biglietti.
 * I contatti dell'azienda NON sono visualizzati nella riga: l'utente
 * apre il dettaglio a destra (drawer) per vedere referenti e canali.
 * Virtualizzazione con @tanstack/react-virtual + altezza riga fissa.
 */
import * as React from "react";
import { useRef, useMemo, useCallback, useState, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { CompanyCard } from "./CompanyCard";
import type { CompanyEntity, CompanyCardListCallbacks } from "./types";
import { useSherlockLevels } from "@/v2/hooks/useSherlockLevels";

export interface CompanyCardListProps extends CompanyCardListCallbacks {
  companies: CompanyEntity[];
  isLoading?: boolean;
  emptyMessage?: string;
  /** Stima altezza per virtualizzazione (header collassato). */
  estimateRowSize?: number;
  /** IDs delle aziende selezionate (multi-select). */
  selectedIds?: Set<string>;
  /** ID dell'azienda aperta nel pannello dettaglio (single-select). */
  openedId?: string | null;
  /** Callback toggle selezione. Se assente, niente checkbox. */
  onToggleSelect?: (id: string) => void;
  /** Click bandiera nella card → filtra per paese. */
  onCountryClick?: (code: string) => void;
  /** Click città nella card → filtra per città. */
  onCityClick?: (city: string) => void;
}

const ROW_HEIGHT = 150;       // card partner completa (px)
const COMPACT_BREAKPOINT = 520; // px — sotto questa larghezza usa layout 2-righe

export function CompanyCardList({
  companies,
  isLoading = false,
  emptyMessage = "Nessun risultato",
  estimateRowSize = ROW_HEIGHT,
  onOpenCompany,
  selectedIds,
  openedId,
  onToggleSelect,
  onCountryClick,
  onCityClick,
}: CompanyCardListProps): React.ReactElement {
  const parentRef = useRef<HTMLDivElement>(null);
  // Carica i livelli Sherlock per le aziende visibili in lista (id = partner.id per WCA).
  const partnerIds = useMemo(
    () => companies.filter((c) => c.source === "wca").map((c) => c.id),
    [companies],
  );
  const sherlockLevels = useSherlockLevels("partner", partnerIds);
  const [width, setWidth] = useState<number>(() =>
    typeof window !== "undefined" ? window.innerWidth : 1024
  );
  const compact = width < COMPACT_BREAKPOINT;

  useEffect(() => {
    const el = parentRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (typeof w === "number") setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const estimateSize = useCallback(
    () => (compact ? estimateRowSize + 32 : estimateRowSize + 18),
    [estimateRowSize, compact]
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
                  onOpenCompany={onOpenCompany}
                  selected={selectedIds?.has(company.id) ?? false}
                  opened={openedId === company.id}
                  onToggleSelect={onToggleSelect}
                  compact={compact}
                  sherlockLevel={sherlockLevels[company.id]?.level ?? null}
                  sherlockCompletedAt={sherlockLevels[company.id]?.completed_at ?? null}
                  onCountryClick={onCountryClick}
                  onCityClick={onCityClick}
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