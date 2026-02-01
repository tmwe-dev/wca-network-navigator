import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CampaignGlobe, MOCK_PARTNERS, COUNTRIES_WITH_PARTNERS } from "@/components/campaigns/CampaignGlobe";
import { CompanyList } from "@/components/campaigns/CompanyList";
import { CampaignSummary } from "@/components/campaigns/CampaignSummary";
import { EmailPreview } from "@/components/campaigns/EmailPreview";
import { Globe, Mail, RefreshCw } from "lucide-react";

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

  // Get partners for selected country from mock data
  const countryPartners = useMemo(() => {
    if (!selectedCountry) return [];
    return MOCK_PARTNERS.filter(p => p.country_code === selectedCountry).map(p => ({
      id: p.id,
      company_name: p.company_name,
      city: p.city,
      country_code: p.country_code,
      country_name: p.country_name,
      email: p.email,
      partner_type: p.partner_type,
      partner_certifications: p.certifications.map(c => ({ certification: c })),
      partner_services: p.services.map(s => ({ service_category: s })),
    }));
  }, [selectedCountry]);

  const countryName = selectedCountry 
    ? COUNTRIES_WITH_PARTNERS[selectedCountry]?.name 
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
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Mail className="w-6 h-6" />
            Email Campaigns
          </h1>
          <p className="text-muted-foreground text-sm">
            Seleziona paesi sul globo e crea campagne email per i tuoi partner
          </p>
        </div>
        {selectedCountry && (
          <Button 
            variant="outline" 
            onClick={() => handleCountrySelect(null)}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Reset selezione
          </Button>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 grid grid-cols-12 gap-4 min-h-0">
        {/* Globe - Left side */}
        <Card className="col-span-5 overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="w-4 h-4" />
              Network Globale
              <span className="text-muted-foreground font-normal text-sm ml-auto">
                {Object.keys(COUNTRIES_WITH_PARTNERS).length} paesi
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 h-[calc(100%-60px)]">
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
