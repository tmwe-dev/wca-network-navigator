/**
 * CompanyList — shell composing Header, Filters, and virtualized rows.
 * Filtri ora globali via GlobalFiltersContext (gestiti dal FiltersDrawer).
 */
import { useState, useMemo, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePartnerContacts } from "@/hooks/usePartnerContacts";
import { CompanyListHeader } from "./CompanyListHeader";
import { CompanyListRow } from "./CompanyListRow";
import { queryKeys } from "@/lib/queryKeys";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";

interface Partner {
  id: string;
  company_name: string;
  city: string;
  country_code: string;
  country_name: string;
  email: string | null;
  partner_type: string | null;
  partner_services?: { service_category: string }[];
  partner_certifications?: { certification: string }[];
  is_bca?: boolean;
  bca_event?: string;
  bca_contact?: string;
}

interface CompanyListProps {
  partners: Partner[];
  selectedPartners: Set<string>;
  onTogglePartner: (partnerId: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onAddToCampaign: () => void;
  countryName?: string;
  bcaPartnerIds?: Set<string>;
  source?: "partners" | "bca";
  selectedContacts?: Set<string>;
  onToggleContact?: (contactId: string) => void;
}

function useBcaDetails(partnerIds: string[]) {
  return useQuery({
    queryKey: queryKeys.businessCards.details(partnerIds.sort().join(",")),
    queryFn: async () => {
      if (!partnerIds.length) return {};
      const { data } = await supabase
        .from("business_cards")
        .select("matched_partner_id, contact_name, event_name, met_at")
        .in("matched_partner_id", partnerIds);
      const map: Record<string, { contact_name: string | null; event_name: string | null; met_at: string | null }> = {};
      (data ?? []).forEach((bc) => {
        if (bc.matched_partner_id && !map[bc.matched_partner_id]) {
          map[bc.matched_partner_id] = { contact_name: bc.contact_name, event_name: bc.event_name, met_at: bc.met_at };
        }
      });
      return map;
    },
    enabled: partnerIds.length > 0,
    staleTime: 60_000,
  });
}

type SortField = "name" | "city" | "contacts";

export function CompanyList({
  partners, selectedPartners, onTogglePartner, onSelectAll, onDeselectAll,
  onAddToCampaign, countryName, bcaPartnerIds, source = "partners",
  selectedContacts, onToggleContact,
}: CompanyListProps) {
  const g = useGlobalFilters();
  const searchQuery = g.filters.campaignsSearch;
  const typeFilter = g.filters.campaignsTypeFilter;
  const aiQuery = g.filters.campaignsAiQuery;
  const sortField = g.filters.campaignsSortField;
  const sortAsc = g.filters.campaignsSortAsc;
  const [expandedPartners, setExpandedPartners] = useState<Set<string>>(new Set());
  const listParentRef = useRef<HTMLDivElement>(null);

  const partnerIdsWithBca = useMemo(() => {
    if (!bcaPartnerIds) return [];
    return partners.filter(p => bcaPartnerIds.has(p.id)).map(p => p.id);
  }, [partners, bcaPartnerIds]);

  const { data: bcaDetails = {} } = useBcaDetails(partnerIdsWithBca);
  const allPartnerIds = useMemo(() => partners.map(p => p.id), [partners]);
  const { data: contactsMap = {} } = usePartnerContacts(allPartnerIds);

  const filteredPartners = useMemo(() => {
    let result = partners;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p => p.company_name.toLowerCase().includes(query) || p.city?.toLowerCase().includes(query) || p.email?.toLowerCase().includes(query));
    }
    if (typeFilter && typeFilter !== "all") result = result.filter(p => p.partner_type === typeFilter);
    if (aiQuery) {
      const keywords = aiQuery.toLowerCase().split(/\s+/);
      result = result.filter(p => {
        const services = p.partner_services?.map(s => s.service_category.toLowerCase()) || [];
        const certs = p.partner_certifications?.map(c => c.certification.toLowerCase()) || [];
        return keywords.some(keyword => {
          if (keyword.includes("iata") && certs.includes("iata")) return true;
          if (keyword.includes("iso") && certs.includes("iso")) return true;
          if (keyword.includes("pharma") && services.includes("pharma")) return true;
          if (keyword.includes("air") && services.includes("air_freight")) return true;
          if (keyword.includes("ocean") && services.some(s => s.includes("ocean"))) return true;
          return false;
        });
      });
    }
    const sorted = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") cmp = a.company_name.localeCompare(b.company_name);
      else if (sortField === "city") cmp = (a.city || "").localeCompare(b.city || "");
      else if (sortField === "contacts") cmp = (contactsMap[b.id]?.length || 0) - (contactsMap[a.id]?.length || 0);
      return sortAsc ? cmp : -cmp;
    });
    return sorted;
  }, [partners, searchQuery, typeFilter, aiQuery, sortField, sortAsc, contactsMap]);

  const selectedCount = Array.from(selectedPartners).filter(id => filteredPartners.some(p => p.id === id)).length;
  const selectedContactCount = selectedContacts?.size || 0;
  const isBcaSource = source === "bca";

  const toggleExpand = useCallback((partnerId: string) => {
    setExpandedPartners(prev => { const next = new Set(prev); if (next.has(partnerId)) next.delete(partnerId); else next.add(partnerId); return next; });
  }, []);

  const handleSortToggle = useCallback((field: SortField) => {
    if (sortField === field) g.setFilter("campaignsSortAsc", !sortAsc);
    else { g.setFilter("campaignsSortField", field); g.setFilter("campaignsSortAsc", field !== "contacts"); }
  }, [sortField, sortAsc, g]);

  const virtualizer = useVirtualizer({
    count: filteredPartners.length,
    getScrollElement: () => listParentRef.current,
    estimateSize: () => 80,
    overscan: 10,
  });

  const filtersActive = !!(searchQuery || aiQuery || typeFilter !== "all" || sortField !== "name" || !sortAsc);

  return (
    <div className="flex flex-col h-full space-panel-amber animate-in fade-in slide-in-from-left-4 duration-500">
      <div className="p-4 border-b border-border space-y-3">
        <CompanyListHeader
          countryName={countryName}
          filteredCount={filteredPartners.length}
          selectedCount={selectedCount}
          selectedContactCount={selectedContactCount}
          isBcaSource={isBcaSource}
          onSelectAll={onSelectAll}
          onDeselectAll={onDeselectAll}
          onAddToCampaign={onAddToCampaign}
          hasPartners={partners.length > 0}
        />
        {filtersActive && (
          <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground bg-muted/20 border border-border/30 rounded-md px-2 py-1.5">
            <span>Filtri attivi — usa il drawer Filtri (←) per modificarli.</span>
            <button
              type="button"
              className="text-primary hover:underline"
              onClick={() => {
                g.setFilter("campaignsSearch", "");
                g.setFilter("campaignsAiQuery", "");
                g.setFilter("campaignsTypeFilter", "all");
                g.setFilter("campaignsSortField", "name");
                g.setFilter("campaignsSortAsc", true);
              }}
            >Reset</button>
          </div>
        )}
      </div>

      <div ref={listParentRef} className="flex-1 overflow-auto">
        {filteredPartners.length === 0 ? (
          <div className="p-8 text-center">
            <Building2 className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground">
              {partners.length === 0 ? "Clicca su un paese nel globo per vedere le aziende" : "Nessuna azienda corrisponde ai filtri"}
            </p>
          </div>
        ) : (
          <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const partner = filteredPartners[virtualItem.index];
              const hasBca = partner.is_bca || bcaPartnerIds?.has(partner.id);
              const contacts = contactsMap[partner.id] || [];
              return (
                <div
                  key={partner.id}
                  ref={virtualizer.measureElement}
                  data-index={virtualItem.index}
                  className="absolute left-0 w-full border-b border-border/50"
                  style={{ top: virtualItem.start }}
                >
                  <CompanyListRow
                    partner={partner}
                    isSelected={selectedPartners.has(partner.id)}
                    hasBca={!!hasBca}
                    bcaInfo={bcaDetails[partner.id]}
                    contacts={contacts}
                    isExpanded={expandedPartners.has(partner.id)}
                    isBcaSource={isBcaSource}
                    selectedContacts={selectedContacts}
                    onTogglePartner={onTogglePartner}
                    onToggleExpand={toggleExpand}
                    onToggleContact={onToggleContact}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
