import { useState, useMemo, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { getCountryFlag, formatPartnerType } from "@/lib/countries";
import { Search, Building2, Mail, MapPin, Filter, Sparkles, Plus, Handshake, ChevronDown, Users, Phone, ArrowUpDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { usePartnerContacts, PartnerContact } from "@/hooks/usePartnerContacts";

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

// Load BCA details for partners in current view
function useBcaDetails(partnerIds: string[]) {
  return useQuery({
    queryKey: ["bca-details-for-list", partnerIds.sort().join(",")],
    queryFn: async () => {
      if (!partnerIds.length) return {};
      const { data } = await supabase
        .from("business_cards")
        .select("matched_partner_id, contact_name, event_name, met_at")
        .in("matched_partner_id", partnerIds);
      const map: Record<string, { contact_name: string | null; event_name: string | null; met_at: string | null }> = {};
      (data ?? []).forEach((bc: any) => {
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
  partners,
  selectedPartners,
  onTogglePartner,
  onSelectAll,
  onDeselectAll,
  onAddToCampaign,
  countryName,
  bcaPartnerIds,
  source = "partners",
  selectedContacts,
  onToggleContact,
}: CompanyListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [aiQuery, setAiQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [expandedPartners, setExpandedPartners] = useState<Set<string>>(new Set());
  const listParentRef = useRef<HTMLDivElement>(null);

  // Get BCA details for visible partners
  const partnerIdsWithBca = useMemo(() => {
    if (!bcaPartnerIds) return [];
    return partners.filter(p => bcaPartnerIds.has(p.id)).map(p => p.id);
  }, [partners, bcaPartnerIds]);
  
  const { data: bcaDetails = {} } = useBcaDetails(partnerIdsWithBca);

  // Fetch contacts for all visible partners
  const allPartnerIds = useMemo(() => partners.map(p => p.id), [partners]);
  const { data: contactsMap = {} } = usePartnerContacts(allPartnerIds);

  // Get unique partner types
  const partnerTypes = useMemo(() => {
    const types = new Set(partners.map(p => p.partner_type).filter(Boolean));
    return Array.from(types) as string[];
  }, [partners]);

  // Filter partners
  const filteredPartners = useMemo(() => {
    let result = partners;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p => 
        p.company_name.toLowerCase().includes(query) ||
        p.city?.toLowerCase().includes(query) ||
        p.email?.toLowerCase().includes(query)
      );
    }

    if (typeFilter && typeFilter !== "all") {
      result = result.filter(p => p.partner_type === typeFilter);
    }

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

    // Sort
    const sorted = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") {
        cmp = a.company_name.localeCompare(b.company_name);
      } else if (sortField === "city") {
        cmp = (a.city || "").localeCompare(b.city || "");
      } else if (sortField === "contacts") {
        cmp = (contactsMap[b.id]?.length || 0) - (contactsMap[a.id]?.length || 0);
      }
      return sortAsc ? cmp : -cmp;
    });

    return sorted;
  }, [partners, searchQuery, typeFilter, aiQuery, sortField, sortAsc, contactsMap]);

  const selectedCount = Array.from(selectedPartners).filter(id => 
    filteredPartners.some(p => p.id === id)
  ).length;

  const selectedContactCount = selectedContacts?.size || 0;

  const isBcaSource = source === "bca";

  const toggleExpand = useCallback((partnerId: string) => {
    setExpandedPartners(prev => {
      const next = new Set(prev);
      if (next.has(partnerId)) next.delete(partnerId);
      else next.add(partnerId);
      return next;
    });
  }, []);

  const handleSortToggle = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortAsc(prev => !prev);
    } else {
      setSortField(field);
      setSortAsc(field !== "contacts"); // contacts default desc
    }
  }, [sortField]);

  const virtualizer = useVirtualizer({
    count: filteredPartners.length,
    getScrollElement: () => listParentRef.current,
    estimateSize: () => 80,
    overscan: 10,
  });

  return (
    <div className="flex flex-col h-full space-panel-amber animate-in fade-in slide-in-from-left-4 duration-500">
      {/* Header */}
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-primary">
            {isBcaSource ? <Handshake className="w-4 h-4 text-primary" /> : <Building2 className="w-4 h-4 text-primary" />}
            {countryName 
              ? (isBcaSource ? `BCA in ${countryName}` : `Aziende in ${countryName}`)
              : "Seleziona un paese"}
          </h3>
          <Badge variant="outline">
            {filteredPartners.length} risultati
          </Badge>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cerca per nome, città, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 space-input"
          />
        </div>

        {/* Sort controls */}
        <div className="flex items-center gap-1">
          <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground mr-1" />
          {(["name", "city", "contacts"] as SortField[]).map(field => (
            <button
              key={field}
              onClick={() => handleSortToggle(field)}
              className={cn(
                "px-2 py-0.5 rounded text-[11px] transition-colors",
                sortField === field
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
              )}
            >
              {field === "name" ? "Nome" : field === "city" ? "Città" : "Contatti"}
              {sortField === field && (sortAsc ? " ↑" : " ↓")}
            </button>
          ))}
        </div>

        {/* Filters row (only for partners) */}
        {!isBcaSource && (
          <div className="flex gap-2">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti i tipi</SelectItem>
                {partnerTypes.map(type => (
                  <SelectItem key={type} value={type}>
                    {formatPartnerType(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* AI Filter */}
        {!isBcaSource && (
          <div className="relative">
            <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
            <Input
              placeholder="Filtra con AI: 'solo IATA certified', 'con servizio pharma'..."
              value={aiQuery}
              onChange={(e) => setAiQuery(e.target.value)}
              className="pl-9 bg-card border-emerald-500/40 text-foreground placeholder:text-emerald-400/40 focus-visible:ring-emerald-500/50"
            />
          </div>
        )}

        {/* Selection controls */}
        {partners.length > 0 && (
          <div className="flex items-center gap-2 pt-1">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onSelectAll}
            >
              Seleziona tutti ({filteredPartners.length})
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onDeselectAll}
              className="text-muted-foreground"
            >
              Deseleziona tutti
            </Button>
          </div>
        )}
      </div>

      {/* Virtualized Partner List */}
      <div ref={listParentRef} className="flex-1 overflow-auto">
        {filteredPartners.length === 0 ? (
          <div className="p-8 text-center">
            <Building2 className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground">
              {partners.length === 0 
                ? "Clicca su un paese nel globo per vedere le aziende"
                : "Nessuna azienda corrisponde ai filtri"
              }
            </p>
          </div>
        ) : (
          <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const partner = filteredPartners[virtualItem.index];
              const hasBca = partner.is_bca || bcaPartnerIds?.has(partner.id);
              const bcaInfo = bcaDetails[partner.id];
              const contacts = contactsMap[partner.id] || [];
              const isExpanded = expandedPartners.has(partner.id);

              return (
                <div
                  key={partner.id}
                  ref={virtualizer.measureElement}
                  data-index={virtualItem.index}
                  className="absolute left-0 w-full border-b border-border/50"
                  style={{ top: virtualItem.start }}
                >
                  {/* Partner row */}
                  <div
                    className={cn(
                      "flex items-start gap-3 p-3 hover:bg-muted/30 transition-colors",
                      hasBca && "border-l-2 border-l-primary/60"
                    )}
                  >
                    <Checkbox
                      checked={selectedPartners.has(partner.id)}
                      onCheckedChange={() => onTogglePartner(partner.id)}
                      className="mt-1 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{getCountryFlag(partner.country_code)}</span>
                        <span className="truncate text-foreground cursor-pointer" onClick={() => onTogglePartner(partner.id)}>
                          {partner.company_name}
                        </span>
                        {hasBca && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/40 text-primary shrink-0">
                                🤝 Incontrato
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <div className="text-xs space-y-1">
                                {(bcaInfo?.event_name || partner.bca_event) && (
                                  <p>📍 Evento: <strong>{bcaInfo?.event_name || partner.bca_event}</strong></p>
                                )}
                                {(bcaInfo?.contact_name || partner.bca_contact) && (
                                  <p>👤 Contatto: {bcaInfo?.contact_name || partner.bca_contact}</p>
                                )}
                                {bcaInfo?.met_at && (
                                  <p>📅 Data: {new Date(bcaInfo.met_at).toLocaleDateString("it")}</p>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {/* Contact count badge - clickable to expand */}
                        {contacts.length > 0 && (
                          <button
                            onClick={() => toggleExpand(partner.id)}
                            className={cn(
                              "flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border transition-colors shrink-0",
                              isExpanded
                                ? "bg-primary/20 border-primary/40 text-primary"
                                : "bg-muted border-border text-muted-foreground hover:bg-primary/10 hover:border-primary/30 hover:text-primary"
                            )}
                          >
                            <Users className="w-3 h-3" />
                            {contacts.length}
                            <ChevronDown className={cn("w-3 h-3 transition-transform", isExpanded && "rotate-180")} />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-muted-foreground" />
                          {partner.city}
                        </span>
                        {partner.partner_type && !isBcaSource && (
                          <Badge variant="outline" className="text-xs">
                            {formatPartnerType(partner.partner_type)}
                          </Badge>
                        )}
                      </div>
                      {partner.email && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                          <Mail className="w-3 h-3" />
                          {partner.email}
                        </div>
                      )}
                      {/* Certifications */}
                      {partner.partner_certifications && partner.partner_certifications.length > 0 && (
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {partner.partner_certifications.map((cert, i) => (
                            <Badge key={i} className="text-xs bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                              {cert.certification}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Expandable contacts list */}
                  {isExpanded && contacts.length > 0 && (
                    <div className="bg-muted/20 border-l-2 border-l-primary/30 ml-6 mr-2 mb-1 rounded-b-lg overflow-hidden">
                      {contacts.map((contact) => (
                        <label
                          key={contact.id}
                          className={cn(
                            "flex items-center gap-2.5 px-3 py-2 hover:bg-muted/30 cursor-pointer transition-colors text-sm border-b border-border/30 last:border-0",
                            contact.is_primary && "bg-primary/5"
                          )}
                        >
                          {onToggleContact && selectedContacts && (
                            <Checkbox
                              checked={selectedContacts.has(contact.id)}
                              onCheckedChange={() => onToggleContact(contact.id)}
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-foreground truncate">{contact.name}</span>
                              {contact.is_primary && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 text-primary border-primary/40">
                                  Primario
                                </Badge>
                              )}
                            </div>
                            {contact.title && (
                              <span className="text-[11px] text-muted-foreground block truncate">{contact.title}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {contact.email && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Mail className="w-3 h-3 text-emerald-500/60" />
                                </TooltipTrigger>
                                <TooltipContent className="text-xs">
                                  {contact.email}
                                </TooltipContent>
                              </Tooltip>
                            )}
                            {(contact.direct_phone || contact.mobile) && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Phone className="w-3 h-3 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent className="text-xs">
                                  {contact.direct_phone || contact.mobile}
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

      {/* Footer */}
      {(selectedCount > 0 || selectedContactCount > 0) && (
        <div className="p-4 border-t border-border">
          <Button onClick={onAddToCampaign} className="w-full space-button-primary">
            <Plus className="w-4 h-4 mr-2" />
            Aggiungi alla campagna ({selectedCount} aziende{selectedContactCount > 0 ? `, ${selectedContactCount} contatti` : ""})
          </Button>
        </div>
      )}
    </div>
  );
}
