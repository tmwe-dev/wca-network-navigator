import { useState, useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { getCountryFlag, formatPartnerType } from "@/lib/countries";
import { Search, Building2, Mail, MapPin, Filter, Sparkles, Plus } from "lucide-react";

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
}

interface CompanyListProps {
  partners: Partner[];
  selectedPartners: Set<string>;
  onTogglePartner: (partnerId: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onAddToCampaign: () => void;
  countryName?: string;
}

export function CompanyList({
  partners,
  selectedPartners,
  onTogglePartner,
  onSelectAll,
  onDeselectAll,
  onAddToCampaign,
  countryName,
}: CompanyListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [aiQuery, setAiQuery] = useState("");

  // Get unique partner types
  const partnerTypes = useMemo(() => {
    const types = new Set(partners.map(p => p.partner_type).filter(Boolean));
    return Array.from(types) as string[];
  }, [partners]);

  // Filter partners
  const filteredPartners = useMemo(() => {
    let result = partners;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p => 
        p.company_name.toLowerCase().includes(query) ||
        p.city.toLowerCase().includes(query) ||
        p.email?.toLowerCase().includes(query)
      );
    }

    // Type filter
    if (typeFilter && typeFilter !== "all") {
      result = result.filter(p => p.partner_type === typeFilter);
    }

    // AI Query filter (simple keyword matching for now)
    if (aiQuery) {
      const keywords = aiQuery.toLowerCase().split(/\s+/);
      result = result.filter(p => {
        const services = p.partner_services?.map(s => s.service_category.toLowerCase()) || [];
        const certs = p.partner_certifications?.map(c => c.certification.toLowerCase()) || [];
        
        return keywords.some(keyword => {
          // Check certifications
          if (keyword.includes("iata") && certs.includes("iata")) return true;
          if (keyword.includes("iso") && certs.includes("iso")) return true;
          if (keyword.includes("aeo") && certs.includes("aeo")) return true;
          if (keyword.includes("basc") && certs.includes("basc")) return true;
          if (keyword.includes("ctpat") && certs.includes("c-tpat")) return true;
          
          // Check services
          if (keyword.includes("pharma") && services.includes("pharma")) return true;
          if (keyword.includes("air") && services.includes("air_freight")) return true;
          if (keyword.includes("ocean") && services.some(s => s.includes("ocean"))) return true;
          if (keyword.includes("dangerous") && services.includes("dangerous_goods")) return true;
          if (keyword.includes("perishable") && services.includes("perishables")) return true;
          if (keyword.includes("ecommerce") && services.includes("ecommerce")) return true;
          if (keyword.includes("warehouse") && services.includes("warehousing")) return true;
          
          return false;
        });
      });
    }

    return result;
  }, [partners, searchQuery, typeFilter, aiQuery]);

  const selectedCount = Array.from(selectedPartners).filter(id => 
    filteredPartners.some(p => p.id === id)
  ).length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            {countryName ? `Aziende in ${countryName}` : "Seleziona un paese"}
          </h3>
          <Badge variant="secondary">
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
            className="pl-9"
          />
        </div>

        {/* Filters row */}
        <div className="flex gap-2">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="w-4 h-4 mr-2" />
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

        {/* AI Filter */}
        <div className="relative">
          <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warning" />
          <Input
            placeholder="Filtra con AI: 'solo IATA certified', 'con servizio pharma'..."
            value={aiQuery}
            onChange={(e) => setAiQuery(e.target.value)}
            className="pl-9 border-warning/50 focus-visible:ring-warning"
          />
        </div>

        {/* Selection controls */}
        {partners.length > 0 && (
          <div className="flex items-center gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={onSelectAll}>
              Seleziona tutti ({filteredPartners.length})
            </Button>
            <Button variant="outline" size="sm" onClick={onDeselectAll}>
              Deseleziona tutti
            </Button>
          </div>
        )}
      </div>

      {/* Partner List */}
      <ScrollArea className="flex-1">
        <div className="divide-y">
          {filteredPartners.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>
                {partners.length === 0 
                  ? "Clicca su un paese nel globo per vedere le aziende"
                  : "Nessuna azienda corrisponde ai filtri"
                }
              </p>
            </div>
          ) : (
            filteredPartners.map((partner) => (
              <label
                key={partner.id}
                className="flex items-start gap-3 p-3 hover:bg-muted/50 cursor-pointer transition-colors"
              >
                <Checkbox
                  checked={selectedPartners.has(partner.id)}
                  onCheckedChange={() => onTogglePartner(partner.id)}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getCountryFlag(partner.country_code)}</span>
                    <span className="font-medium truncate">{partner.company_name}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {partner.city}
                    </span>
                    {partner.partner_type && (
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
                  {/* Show certifications */}
                  {partner.partner_certifications && partner.partner_certifications.length > 0 && (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {partner.partner_certifications.map((cert, i) => (
                        <Badge key={i} variant="secondary" className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                          {cert.certification}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </label>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      {selectedCount > 0 && (
        <div className="p-4 border-t bg-muted/30">
          <Button onClick={onAddToCampaign} className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Aggiungi alla campagna ({selectedCount})
          </Button>
        </div>
      )}
    </div>
  );
}
