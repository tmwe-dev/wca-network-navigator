import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
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

  return (
    <div className="flex flex-col h-full space-panel-amber animate-in fade-in slide-in-from-left-4 duration-500">
      {/* Header */}
      <div className="p-4 border-b border-amber-500/20 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-amber-400">
            {isBcaSource ? <Handshake className="w-4 h-4 text-purple-400" /> : <Building2 className="w-4 h-4 text-amber-500" />}
            {countryName 
              ? (isBcaSource ? `BCA in ${countryName}` : `Aziende in ${countryName}`)
              : "Seleziona un paese"}
          </h3>
          <Badge className={cn("space-badge", isBcaSource && "bg-purple-500/20 border-purple-500/40 text-purple-300")}>
            {filteredPartners.length} risultati
          </Badge>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500/60" />
          <Input
            placeholder="Cerca per nome, città, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 space-input"
          />
        </div>

        {/* Sort controls */}
        <div className="flex items-center gap-1">
          <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 mr-1" />
          {(["name", "city", "contacts"] as SortField[]).map(field => (
            <button
              key={field}
              onClick={() => handleSortToggle(field)}
              className={cn(
                "px-2 py-0.5 rounded text-[11px] transition-colors",
                sortField === field
                  ? "bg-amber-500/20 text-amber-300"
                  : "text-slate-500 hover:bg-muted/30 hover:text-slate-300"
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
              <SelectTrigger className="w-[180px] bg-black/50 border-amber-500/30 text-slate-200">
                <Filter className="w-4 h-4 mr-2 text-amber-500" />
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent className="bg-black/90 backdrop-blur-xl border-amber-500/30">
                <SelectItem value="all" className="text-slate-200 focus:bg-amber-500/20">Tutti i tipi</SelectItem>
                {partnerTypes.map(type => (
                  <SelectItem key={type} value={type} className="text-slate-200 focus:bg-amber-500/20">
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
              className="pl-9 bg-black/50 border-emerald-500/40 text-emerald-100 placeholder:text-emerald-400/40 focus-visible:ring-emerald-500/50"
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
              className="bg-transparent border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
            >
              Seleziona tutti ({filteredPartners.length})
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onDeselectAll}
              className="bg-transparent border-amber-500/30 text-slate-400 hover:bg-amber-500/10 hover:text-slate-300"
            >
              Deseleziona tutti
            </Button>
          </div>
        )}
      </div>

      {/* Partner List */}
      <ScrollArea className="flex-1">
        <div className="divide-y divide-amber-500/10">
          {filteredPartners.length === 0 ? (
            <div className="p-8 text-center">
              <Building2 className="w-12 h-12 mx-auto mb-3 text-amber-500/30" />
              <p className="text-slate-400">
                {partners.length === 0 
                  ? "Clicca su un paese nel globo per vedere le aziende"
                  : "Nessuna azienda corrisponde ai filtri"
                }
              </p>
            </div>
          ) : (
            filteredPartners.map((partner) => {
              const hasBca = partner.is_bca || bcaPartnerIds?.has(partner.id);
              const bcaInfo = bcaDetails[partner.id];
              const contacts = contactsMap[partner.id] || [];
              const isExpanded = expandedPartners.has(partner.id);

              return (
                <div key={partner.id}>
                  {/* Partner row */}
                  <div
                    className={cn(
                      "flex items-start gap-3 p-3 hover:bg-amber-500/10 transition-colors",
                      hasBca && "border-l-2 border-l-purple-500/60"
                    )}
                  >
                    <Checkbox
                      checked={selectedPartners.has(partner.id)}
                      onCheckedChange={() => onTogglePartner(partner.id)}
                      className="mt-1 border-amber-500/50 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{getCountryFlag(partner.country_code)}</span>
                        <span className="truncate text-slate-100 cursor-pointer" onClick={() => onTogglePartner(partner.id)}>
                          {partner.company_name}
                        </span>
                        {hasBca && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge className="text-[10px] px-1.5 py-0 bg-purple-500/20 border border-purple-500/40 text-purple-300 shrink-0">
                                🤝 Incontrato
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent className="bg-black/95 border-purple-500/40 text-slate-200 max-w-xs">
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
                                ? "bg-blue-500/20 border-blue-500/40 text-blue-300"
                                : "bg-slate-500/10 border-slate-500/30 text-slate-400 hover:bg-blue-500/10 hover:border-blue-500/30 hover:text-blue-300"
                            )}
                          >
                            <Users className="w-3 h-3" />
                            {contacts.length}
                            <ChevronDown className={cn("w-3 h-3 transition-transform", isExpanded && "rotate-180")} />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-slate-400">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-amber-500/60" />
                          {partner.city}
                        </span>
                        {partner.partner_type && !isBcaSource && (
                          <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-400/80">
                            {formatPartnerType(partner.partner_type)}
                          </Badge>
                        )}
                      </div>
                      {partner.email && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
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
                    <div className="bg-slate-900/50 border-l-2 border-l-blue-500/30 ml-6 mr-2 mb-1 rounded-b-lg overflow-hidden">
                      {contacts.map((contact) => (
                        <label
                          key={contact.id}
                          className={cn(
                            "flex items-center gap-2.5 px-3 py-2 hover:bg-blue-500/10 cursor-pointer transition-colors text-sm border-b border-slate-700/30 last:border-0",
                            contact.is_primary && "bg-blue-500/5"
                          )}
                        >
                          {onToggleContact && selectedContacts && (
                            <Checkbox
                              checked={selectedContacts.has(contact.id)}
                              onCheckedChange={() => onToggleContact(contact.id)}
                              className="border-blue-500/50 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-200 truncate">{contact.name}</span>
                              {contact.is_primary && (
                                <Badge className="text-[9px] px-1 py-0 bg-amber-500/20 border border-amber-500/40 text-amber-300">
                                  Primario
                                </Badge>
                              )}
                            </div>
                            {contact.title && (
                              <span className="text-[11px] text-slate-500 block truncate">{contact.title}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {contact.email && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Mail className="w-3 h-3 text-emerald-500/60" />
                                </TooltipTrigger>
                                <TooltipContent className="bg-black/95 border-amber-500/30 text-slate-200 text-xs">
                                  {contact.email}
                                </TooltipContent>
                              </Tooltip>
                            )}
                            {(contact.direct_phone || contact.mobile) && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Phone className="w-3 h-3 text-blue-500/60" />
                                </TooltipTrigger>
                                <TooltipContent className="bg-black/95 border-amber-500/30 text-slate-200 text-xs">
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
            })
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      {(selectedCount > 0 || selectedContactCount > 0) && (
        <div className="p-4 border-t border-amber-500/20">
          <Button onClick={onAddToCampaign} className="w-full space-button-primary">
            <Plus className="w-4 h-4 mr-2" />
            Aggiungi alla campagna ({selectedCount} aziende{selectedContactCount > 0 ? `, ${selectedContactCount} contatti` : ""})
          </Button>
        </div>
      )}
    </div>
  );
}
