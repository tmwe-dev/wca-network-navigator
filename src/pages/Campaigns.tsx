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
}: {
  countries: { code: string; name: string; count: number }[];
  selectedCountry: string | null;
  onCountrySelect: (code: string | null) => void;
  countriesWithPartners: number;
  totalPartners: number;
}) {
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
    </>
  );
}

// Bottom tabbed panel component
function BottomTabbedPanel({
  activeTab,
  onTabChange,
  countryPartners,
  countryName,
  campaignPartners,
  onRemoveFromCampaign,
  onClearCampaign,
  onGenerateEmail,
}: {
  activeTab: 'partners' | 'campaign';
  onTabChange: (tab: 'partners' | 'campaign') => void;
  countryPartners: any[];
  countryName: string;
  campaignPartners: CampaignPartner[];
  onRemoveFromCampaign: (id: string) => void;
  onClearCampaign: () => void;
  onGenerateEmail: () => void;
}) {
  // Group campaign partners by country
  const groupedByCountry = campaignPartners.reduce((acc, partner) => {
    const country = partner.country_name;
    if (!acc[country]) acc[country] = [];
    acc[country].push(partner);
    return acc;
  }, {} as Record<string, CampaignPartner[]>);

  const countries = Object.keys(groupedByCountry);
  const totalWithEmail = campaignPartners.filter(p => p.email).length;

  return (
    <div className="space-panel-amber h-full flex flex-col">
      {/* Tab headers */}
      <div className="flex border-b border-amber-500/20">
        <button
          onClick={() => onTabChange('partners')}
          className={`flex-1 px-4 py-3 text-sm flex items-center justify-center gap-2 transition-colors ${
            activeTab === 'partners' 
              ? 'text-amber-400 bg-amber-500/10 border-b-2 border-amber-400' 
              : 'text-slate-400 hover:text-slate-300 hover:bg-amber-500/5'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Partner del Paese
          {countryPartners.length > 0 && (
            <span className="text-xs bg-amber-500/20 px-1.5 py-0.5 rounded">{countryPartners.length}</span>
          )}
        </button>
        <button
          onClick={() => onTabChange('campaign')}
          className={`flex-1 px-4 py-3 text-sm flex items-center justify-center gap-2 transition-colors ${
            activeTab === 'campaign' 
              ? 'text-emerald-400 bg-emerald-500/10 border-b-2 border-emerald-400' 
              : 'text-slate-400 hover:text-slate-300 hover:bg-emerald-500/5'
          }`}
        >
          <Send className="w-4 h-4" />
          Riepilogo Campagna
          {campaignPartners.length > 0 && (
            <span className="text-xs bg-emerald-500/20 px-1.5 py-0.5 rounded">{campaignPartners.length}</span>
          )}
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'partners' ? (
          <div className="h-full flex flex-col">
            {countryPartners.length === 0 ? (
              <div className="flex-1 flex items-center justify-center p-4">
                <div className="text-center">
                  <Building2 className="w-10 h-10 mx-auto mb-2 text-amber-500/30" />
                  <p className="text-slate-400 text-sm">Seleziona un paese per vedere i partner</p>
                </div>
              </div>
            ) : (
              <>
                <div className="p-3 border-b border-amber-500/20 flex items-center justify-between">
                  <span className="text-amber-400 text-sm">{countryName}</span>
                  <span className="text-xs text-slate-400">{countryPartners.length} partner</span>
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-2 space-y-1">
                    {countryPartners.map((partner: any) => (
                      <div key={partner.id} className="p-2 rounded-lg hover:bg-amber-500/10 transition-colors">
                        <p className="text-sm text-slate-100 truncate">{partner.company_name}</p>
                        <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                          <span>{partner.city}</span>
                          {partner.email && <span className="truncate max-w-32">{partner.email}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </>
            )}
          </div>
        ) : (
          <div className="h-full flex flex-col">
            {campaignPartners.length === 0 ? (
              <div className="flex-1 flex items-center justify-center p-4">
                <div className="text-center">
                  <Users className="w-10 h-10 mx-auto mb-2 text-emerald-500/30" />
                  <p className="text-slate-400 text-sm">Aggiungi partner alla campagna</p>
                </div>
              </div>
            ) : (
              <>
                {/* Stats */}
                <div className="p-3 border-b border-emerald-500/20">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-stat-card">
                      <div className="text-xl font-mono text-amber-400">{campaignPartners.length}</div>
                      <div className="text-xs text-slate-400">Aziende</div>
                    </div>
                    <div className="space-stat-card">
                      <div className="text-xl font-mono text-amber-400">{countries.length}</div>
                      <div className="text-xs text-slate-400">Paesi</div>
                    </div>
                    <div className="space-stat-card">
                      <div className="text-xl font-mono text-emerald-400">{totalWithEmail}</div>
                      <div className="text-xs text-slate-400">Con email</div>
                    </div>
                  </div>
                </div>
                
                <ScrollArea className="flex-1">
                  <div className="p-2 space-y-3">
                    {countries.map(country => (
                      <div key={country}>
                        <div className="flex items-center gap-2 mb-1 px-2">
                          <span>{getCountryFlag(groupedByCountry[country][0].country_code)}</span>
                          <span className="text-sm text-slate-200">{country}</span>
                          <Badge className="ml-auto space-badge text-xs">{groupedByCountry[country].length}</Badge>
                        </div>
                        <div className="space-y-0.5 pl-6">
                          {groupedByCountry[country].map(partner => (
                            <div key={partner.id} className="flex items-center justify-between py-1 px-2 rounded hover:bg-emerald-500/10 group">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm text-slate-200 truncate">{partner.company_name}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                {partner.email && <Mail className="w-3 h-3 text-emerald-500/60" />}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                                  onClick={() => onRemoveFromCampaign(partner.id)}
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                <div className="p-3 border-t border-emerald-500/20 space-y-2">
                  <div className="flex gap-2">
                    <Button 
                      onClick={onGenerateEmail} 
                      className="flex-1 space-button-primary"
                      disabled={totalWithEmail === 0}
                    >
                      <Mail className="w-4 h-4 mr-2" />
                      Genera Email ({totalWithEmail})
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={onClearCampaign}
                      className="text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                    >
                      Svuota
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
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
  const [activeBottomTab, setActiveBottomTab] = useState<'partners' | 'campaign'>('partners');

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
    setActiveBottomTab('campaign');
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
    if (countryCode) {
      setActiveBottomTab('partners');
    }
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

      {/* Floating Company List - Left */}
      <div className="absolute left-4 top-4 bottom-52 w-[360px] z-10">
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

      {/* Bottom Tabbed Panel */}
      <div className="absolute left-4 right-4 bottom-4 h-44 z-10">
        <BottomTabbedPanel
          activeTab={activeBottomTab}
          onTabChange={setActiveBottomTab}
          countryPartners={countryPartners}
          countryName={countryName}
          campaignPartners={campaignPartners}
          onRemoveFromCampaign={handleRemoveFromCampaign}
          onClearCampaign={handleClearCampaign}
          onGenerateEmail={() => setShowEmailPreview(true)}
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
