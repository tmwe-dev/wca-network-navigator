import { useState, useMemo, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { CampaignGlobe } from "@/components/campaigns/CampaignGlobe";
import { CompanyList } from "@/components/campaigns/CompanyList";
import { EmailPreview } from "@/components/campaigns/EmailPreview";
import { RefreshCw, Building2, Send, Users, Mail, X } from "lucide-react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface CampaignPartner {
  id: string;
  company_name: string;
  city: string;
  country_code: string;
  country_name: string;
  email: string | null;
}

// Header controls component to be portaled
function CampaignHeaderControls({
  countries,
  selectedCountry,
  onCountrySelect,
  countriesWithPartners,
  totalPartners,
  campaignPartners,
  onGenerateEmail,
}: {
  countries: { code: string; name: string; count: number }[];
  selectedCountry: string | null;
  onCountrySelect: (code: string | null) => void;
  countriesWithPartners: number;
  totalPartners: number;
  campaignPartners: CampaignPartner[];
  onGenerateEmail: () => void;
}) {
  const totalWithEmail = campaignPartners.filter(p => p.email).length;
  const uniqueCountries = new Set(campaignPartners.map(p => p.country_code)).size;

  return (
    <>
      {/* Country selector */}
      <Select value={selectedCountry || ""} onValueChange={(val) => onCountrySelect(val || null)}>
        <SelectTrigger className="w-56 bg-black/40 border-amber-500/30 text-amber-100 focus:ring-amber-500/50">
          <SelectValue placeholder="🌍 Seleziona paese..." />
        </SelectTrigger>
        <SelectContent className="max-h-80 bg-black/90 backdrop-blur-xl border-amber-500/30">
          {countries.map((country) => (
            <SelectItem 
              key={country.code} 
              value={country.code}
              className="text-slate-200 focus:bg-amber-500/20 focus:text-amber-100"
            >
              <div className="flex items-center gap-2">
                <span>{getCountryFlag(country.code)}</span>
                <span className="truncate">{country.name}</span>
                <span className={`ml-auto text-xs ${country.count > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                  {country.count}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Divider */}
      <div className="w-px h-6 bg-amber-500/30" />

      {/* Stats badges */}
      <div className="flex items-center gap-3 text-sm">
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30">
          <span className="font-mono text-blue-400">{TOTAL_WCA_COUNTRIES}</span>
          <span className="text-slate-400 text-xs">Paesi</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30">
          <span className="font-mono text-emerald-400">{countriesWithPartners}</span>
          <span className="text-slate-400 text-xs">Attivi</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30">
          <span className="font-mono text-amber-400">{totalPartners}</span>
          <span className="text-slate-400 text-xs">Partner</span>
        </div>
      </div>

      {/* Reset button */}
      {selectedCountry && (
        <>
          <div className="w-px h-6 bg-amber-500/30" />
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => onCountrySelect(null)}
            className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Reset
          </Button>
        </>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Campaign Summary in Header */}
      {campaignPartners.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <Send className="w-4 h-4 text-emerald-400" />
            <span className="text-emerald-400">{campaignPartners.length}</span>
            <span className="text-slate-500">aziende</span>
            <span className="text-slate-600">·</span>
            <span className="text-amber-400">{uniqueCountries}</span>
            <span className="text-slate-500">paesi</span>
            <span className="text-slate-600">·</span>
            <span className="text-blue-400">{totalWithEmail}</span>
            <span className="text-slate-500">email</span>
          </div>
          <Button 
            onClick={onGenerateEmail} 
            size="sm"
            className="space-button-primary"
            disabled={totalWithEmail === 0}
          >
            <Mail className="w-4 h-4 mr-1.5" />
            Genera Email
          </Button>
        </div>
      )}
    </>
  );
}

// Floating campaign partners list on the right
function FloatingCampaignPartners({
  campaignPartners,
  onRemoveFromCampaign,
  onClearCampaign,
}: {
  campaignPartners: CampaignPartner[];
  onRemoveFromCampaign: (id: string) => void;
  onClearCampaign: () => void;
}) {
  if (campaignPartners.length === 0) return null;

  return (
    <div className="flex flex-col items-end gap-2">
      {/* Clear button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onClearCampaign}
        className="text-xs text-slate-400 hover:text-red-400 hover:bg-red-500/10 px-2 py-1"
      >
        <X className="w-3 h-3 mr-1" />
        Svuota
      </Button>
      
      {/* Partner chips */}
      <div className="flex flex-col gap-1.5 max-h-[60vh] overflow-y-auto pr-1">
        {campaignPartners.map(partner => (
          <div 
            key={partner.id}
            className="group flex items-center gap-2 bg-black/50 backdrop-blur-sm border border-emerald-500/30 rounded-lg px-3 py-1.5 text-sm"
          >
            <span className="text-slate-300 truncate max-w-40">{partner.company_name}</span>
            <span className="text-slate-500 text-xs">{getCountryFlag(partner.country_code)}</span>
            {partner.email && <Mail className="w-3 h-3 text-emerald-500/60" />}
            <button
              onClick={() => onRemoveFromCampaign(partner.id)}
              className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-400 transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Campaigns() {
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedPartnerIds, setSelectedPartnerIds] = useState<Set<string>>(new Set());
  const [campaignPartners, setCampaignPartners] = useState<CampaignPartner[]>([]);
  const [headerContainer, setHeaderContainer] = useState<HTMLElement | null>(null);
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
    ? WCA_COUNTRIES_MAP[selectedCountry]?.name || ''
    : '';

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

  // Find header container for portal
  useEffect(() => {
    const container = document.getElementById('campaign-header-controls');
    setHeaderContainer(container);
  }, []);

  return (
    <div className="h-[calc(100vh-4rem)] relative overflow-hidden -m-6">
      {/* Portal header controls */}
      {headerContainer && createPortal(
        <CampaignHeaderControls
          countries={countries}
          selectedCountry={selectedCountry}
          onCountrySelect={handleCountrySelect}
          countriesWithPartners={countriesWithPartners}
          totalPartners={totalPartners}
          campaignPartners={campaignPartners}
          onGenerateEmail={() => setShowEmailPreview(true)}
        />,
        headerContainer
      )}

      {/* Globe as full background */}
      <div className="absolute inset-0">
        <CampaignGlobe
          selectedCountry={selectedCountry}
          onCountrySelect={handleCountrySelect}
        />
      </div>

      {/* Left side - stacked Company List and Partners panels */}
      <div className="absolute left-4 top-4 bottom-4 w-[360px] z-10 flex flex-col gap-4">
        <div className="flex-1 min-h-0">
          <CompanyList
            partners={countryPartners}
            selectedPartners={selectedPartnerIds}
            onTogglePartner={handleTogglePartner}
            onSelectAll={handleSelectAll}
            onDeselectAll={handleDeselectAll}
            onAddToCampaign={handleAddToCampaign}
            countryName={countryName}
          />
        </div>
      </div>

      {/* Right side - floating campaign partners */}
      <div className="absolute right-4 top-4 z-10">
        <FloatingCampaignPartners
          campaignPartners={campaignPartners}
          onRemoveFromCampaign={handleRemoveFromCampaign}
          onClearCampaign={handleClearCampaign}
        />
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
