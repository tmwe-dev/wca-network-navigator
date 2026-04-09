import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { getCountryFlag, formatPartnerType } from "@/lib/countries";
import { Search, Building2, Mail, MapPin, Filter, Sparkles, Plus, Handshake } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

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
}: CompanyListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [aiQuery, setAiQuery] = useState("");

  // Get BCA details for visible partners
  const partnerIdsWithBca = useMemo(() => {
    if (!bcaPartnerIds) return [];
    return partners.filter(p => bcaPartnerIds.has(p.id)).map(p => p.id);
  }, [partners, bcaPartnerIds]);
  
  const { data: bcaDetails = {} } = useBcaDetails(partnerIdsWithBca);

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

    return result;
  }, [partners, searchQuery, typeFilter, aiQuery]);

  const selectedCount = Array.from(selectedPartners).filter(id => 
    filteredPartners.some(p => p.id === id)
  ).length;

  const isBcaSource = source === "bca";

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

              return (
                <label
                  key={partner.id}
                  className={cn(
                    "flex items-start gap-3 p-3 hover:bg-amber-500/10 cursor-pointer transition-colors",
                    hasBca && "border-l-2 border-l-purple-500/60"
                  )}
                >
                  <Checkbox
                    checked={selectedPartners.has(partner.id)}
                    onCheckedChange={() => onTogglePartner(partner.id)}
                    className="mt-1 border-amber-500/50 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getCountryFlag(partner.country_code)}</span>
                      <span className="truncate text-slate-100">{partner.company_name}</span>
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
                              {(bcaInfo?.met_at) && (
                                <p>📅 Data: {new Date(bcaInfo.met_at).toLocaleDateString("it")}</p>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
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
                    {/* Show certifications */}
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
                </label>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      {selectedCount > 0 && (
        <div className="p-4 border-t border-amber-500/20">
          <Button onClick={onAddToCampaign} className="w-full space-button-primary">
            <Plus className="w-4 h-4 mr-2" />
            Aggiungi alla campagna ({selectedCount})
          </Button>
        </div>
      )}
    </div>
  );
}
