import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CampaignGlobe } from "@/components/campaigns/CampaignGlobe";
import { CompanyList } from "@/components/campaigns/CompanyList";
import { CampaignSummary } from "@/components/campaigns/CampaignSummary";
import { EmailPreview } from "@/components/campaigns/EmailPreview";
import { Globe, Mail, RefreshCw } from "lucide-react";
import { usePartnersByCountryForGlobe, usePartnersForGlobe } from "@/hooks/usePartnersForGlobe";
import { WCA_COUNTRIES_MAP, TOTAL_WCA_COUNTRIES } from "@/data/wcaCountries";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { getCountryFlag } from "@/lib/countries";

interface CampaignPartner {
  id: string;
  company_name: string;
  city: string;
  country_code: string;
  country_name: string;
  email: string | null;
}

export default function Campaigns() {
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedPartnerIds, setSelectedPartnerIds] = useState<Set<string>>(new Set());
  const [campaignPartners, setCampaignPartners] = useState<CampaignPartner[]>([]);
  const [showEmailPreview, setShowEmailPreview] = useState(false);

  // Fetch partners data from Supabase
  const { data: globeData } = usePartnersForGlobe();
  const { data: countryPartnersData = [] } = usePartnersByCountryForGlobe(selectedCountry);

  const countries = globeData?.countries || [];
  const totalPartners = globeData?.partners.length || 0;
  const countriesWithPartners = countries.filter(c => c.count > 0).length;

  // Get partners for selected country from real data
  const countryPartners = useMemo(() => {
    return countryPartnersData.map(p => ({
      id: p.id,
      company_name: p.company_name,
      city: p.city,
      country_code: p.country_code,
      country_name: p.country_name,
      email: p.email,
      partner_type: p.partner_type || 'freight_forwarder',
      partner_certifications: (p as any).partner_certifications || [],
      partner_services: (p as any).partner_services || [],
    }));
  }, [countryPartnersData]);

  const countryName = selectedCountry 
    ? WCA_COUNTRIES_MAP[selectedCountry]?.name 
    : undefined;

  // Toggle single partner selection
  const handleTogglePartner = useCallback((partnerId: string) => {
    setSelectedPartnerIds(prev => {
      const next = new Set(prev);
      if (next.has(partnerId)) {
        next.delete(partnerId);
      } else {
        next.add(partnerId);
      }
      return next;
    });
  }, []);

  // Select all filtered partners
  const handleSelectAll = useCallback(() => {
    setSelectedPartnerIds(new Set(countryPartners.map(p => p.id)));
  }, [countryPartners]);

  // Deselect all
  const handleDeselectAll = useCallback(() => {
    setSelectedPartnerIds(new Set());
  }, []);

  // Add selected to campaign
  const handleAddToCampaign = useCallback(() => {
    const newPartners = countryPartners
      .filter(p => selectedPartnerIds.has(p.id))
      .filter(p => !campaignPartners.some(cp => cp.id === p.id))
      .map(p => ({
        id: p.id,
        company_name: p.company_name,
        city: p.city,
        country_code: p.country_code,
        country_name: p.country_name,
        email: p.email,
      }));

    setCampaignPartners(prev => [...prev, ...newPartners]);
    setSelectedPartnerIds(new Set());
  }, [countryPartners, selectedPartnerIds, campaignPartners]);

  // Remove from campaign
  const handleRemoveFromCampaign = useCallback((partnerId: string) => {
    setCampaignPartners(prev => prev.filter(p => p.id !== partnerId));
  }, []);

  // Clear campaign
  const handleClearCampaign = useCallback(() => {
    setCampaignPartners([]);
  }, []);

  // Handle country selection from globe
  const handleCountrySelect = useCallback((countryCode: string | null) => {
    setSelectedCountry(countryCode);
    setSelectedPartnerIds(new Set());
  }, []);

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col gap-4 p-4">
      {/* Header with controls */}
      <div className="flex flex-wrap items-center gap-4 shrink-0">
        {/* Title */}
        <div className="flex-1 min-w-48">
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Email Campaigns
          </h1>
        </div>

        {/* Country selector */}
        <div className="w-64">
          <Select value={selectedCountry || ""} onValueChange={(val) => handleCountrySelect(val || null)}>
            <SelectTrigger className="bg-card border-primary/20">
              <SelectValue placeholder="🌍 Seleziona paese..." />
            </SelectTrigger>
            <SelectContent className="max-h-80">
              {countries.map((country) => (
                <SelectItem key={country.code} value={country.code}>
                  <div className="flex items-center gap-2">
                    <span>{getCountryFlag(country.code)}</span>
                    <span className="truncate">{country.name}</span>
                    <span className={`ml-auto text-xs ${country.count > 0 ? 'text-amber-400' : 'text-muted-foreground'}`}>
                      {country.count}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Stats badges */}
        <div className="flex items-center gap-3 text-sm">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20">
            <span className="font-semibold text-blue-400">{TOTAL_WCA_COUNTRIES}</span>
            <span className="text-muted-foreground text-xs">Paesi</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20">
            <span className="font-semibold text-green-400">{countriesWithPartners}</span>
            <span className="text-muted-foreground text-xs">Attivi</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
            <span className="font-semibold text-amber-400">{totalPartners}</span>
            <span className="text-muted-foreground text-xs">Partner</span>
          </div>
        </div>

        {/* Reset button */}
        {selectedCountry && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => handleCountrySelect(null)}
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Reset
          </Button>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 grid grid-cols-12 gap-4 min-h-0">
        {/* Globe - Left side - CLEAN */}
        <Card className="col-span-5 overflow-hidden border-primary/10">
          <CardContent className="p-0 h-full">
            <CampaignGlobe
              selectedCountry={selectedCountry}
              onCountrySelect={handleCountrySelect}
            />
          </CardContent>
        </Card>

        {/* Company List - Middle */}
        <Card className="col-span-4 overflow-hidden flex flex-col">
          <CompanyList
            partners={countryPartners}
            selectedPartners={selectedPartnerIds}
            onTogglePartner={handleTogglePartner}
            onSelectAll={handleSelectAll}
            onDeselectAll={handleDeselectAll}
            onAddToCampaign={handleAddToCampaign}
            countryName={countryName}
          />
        </Card>

        {/* Campaign Summary - Right */}
        <div className="col-span-3 overflow-hidden">
          <CampaignSummary
            selectedPartners={campaignPartners}
            onRemovePartner={handleRemoveFromCampaign}
            onClearAll={handleClearCampaign}
            onGenerateEmail={() => setShowEmailPreview(true)}
          />
        </div>
      </div>

      {/* Email Preview Modal */}
      <EmailPreview
        open={showEmailPreview}
        onOpenChange={setShowEmailPreview}
        recipients={campaignPartners}
      />
    </div>
  );
}
