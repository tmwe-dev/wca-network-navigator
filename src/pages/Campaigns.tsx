import { useState, useMemo, useCallback, useEffect, lazy, Suspense } from "react";
import { CampaignAnalyticsTab } from "@/components/analytics/CampaignAnalyticsTab";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
const CampaignGlobe = lazy(() => import("@/components/campaigns/CampaignGlobe").then(m => ({ default: m.CampaignGlobe })));
import { CompanyList } from "@/components/campaigns/CompanyList";
import { RefreshCw, Building2, Send, Users, Mail, X, Check, ChevronsUpDown, Briefcase, CreditCard, Target, BarChart3 } from "lucide-react";
import { usePartnersByCountryForGlobe, useBusinessCardsForCampaign, useBcaCountryCounts } from "@/hooks/usePartnersForGlobe";
import { useCountryPartnerCounts } from "@/hooks/useCountryPartnerCounts";
import { useBusinessCardPartnerMatches } from "@/hooks/useBusinessCards";
import { WCA_COUNTRIES_MAP } from "@/data/wcaCountries";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { getCountryFlag } from "@/lib/countries";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { insertCockpitQueueItems } from "@/data/cockpitQueue";

type CampaignSource = "partners" | "bca";

const CAMPAIGN_GOALS = [
  { value: "primo_contatto", label: "Primo Contatto" },
  { value: "follow_up_fiera", label: "Follow-up Fiera" },
  { value: "follow_up", label: "Follow-up Generico" },
  { value: "partnership", label: "Proposta Partnership" },
  { value: "richiesta_info", label: "Richiesta Info" },
] as const;

interface CampaignPartner {
  id: string;
  company_name: string;
  city: string;
  country_code: string;
  country_name: string;
  email: string | null;
  has_bca?: boolean;
}

// Header controls component to be portaled
function CampaignHeaderControls({
  countries,
  selectedCountry,
  onCountrySelect,
  countriesWithPartners,
  totalPartners,
  campaignPartners,
  onGenerateJobs,
  source,
  onSourceChange,
  bcaCountryCounts,
}: {
  countries: { code: string; name: string; count: number }[];
  selectedCountry: string | null;
  onCountrySelect: (code: string | null) => void;
  countriesWithPartners: number;
  totalPartners: number;
  campaignPartners: CampaignPartner[];
  onGenerateJobs: () => void;
  source: CampaignSource;
  onSourceChange: (s: CampaignSource) => void;
  bcaCountryCounts: Record<string, number>;
}) {
  const [comboOpen, setComboOpen] = useState(false);
  const [countrySortBy, setCountrySortBy] = useState<"name" | "count">("name");

  const sortedCountries = useMemo(() => {
    let list: { code: string; name: string; count: number }[];
    if (source === "bca") {
      list = Object.entries(bcaCountryCounts)
        .map(([code, count]) => ({
          code,
          name: WCA_COUNTRIES_MAP[code]?.name || code,
          count,
        }));
    } else {
      list = [...countries];
    }
    if (countrySortBy === "count") {
      return list.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [countries, source, bcaCountryCounts, countrySortBy]);

  const selectedName = selectedCountry ? WCA_COUNTRIES_MAP[selectedCountry]?.name : null;
  const totalWithEmail = campaignPartners.filter(p => p.email).length;
  const uniqueCountries = new Set(campaignPartners.map(p => p.country_code)).size;

  return (
    <>
      {/* Source toggle */}
      <Tabs value={source} onValueChange={(v) => onSourceChange(v as CampaignSource)}>
        <TabsList className="bg-card/50 border border-border">
          <TabsTrigger value="partners" className="text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
            <Building2 className="w-3.5 h-3.5 mr-1" />Partner
          </TabsTrigger>
          <TabsTrigger value="bca" className="text-xs data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
            <CreditCard className="w-3.5 h-3.5 mr-1" />BCA
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="w-px h-6 bg-border" />

      {/* Country combobox */}
      <Popover open={comboOpen} onOpenChange={setComboOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={comboOpen}
            className="w-56 justify-between"
          >
            {selectedName
              ? <span className="truncate">{getCountryFlag(selectedCountry!)} {selectedName}</span>
              : <span className="text-muted-foreground">🌍 Cerca paese...</span>}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0 z-50" align="start">
          <Command>
            <CommandInput placeholder="Cerca paese..." />
            <div className="flex items-center gap-1 px-2 py-1 border-b border-border/30">
              <span className="text-[10px] text-muted-foreground mr-1">Ordina:</span>
              <button
                onClick={() => setCountrySortBy("name")}
                className={cn("px-2 py-0.5 rounded text-[10px] transition-colors", countrySortBy === "name" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-muted/30")}
              >A→Z</button>
              <button
                onClick={() => setCountrySortBy("count")}
                className={cn("px-2 py-0.5 rounded text-[10px] transition-colors", countrySortBy === "count" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-muted/30")}
              >#Partner</button>
            </div>
            <CommandList className="max-h-60">
              <CommandEmpty className="text-muted-foreground">Nessun paese trovato</CommandEmpty>
              <CommandGroup>
                {sortedCountries.map((country) => (
                  <CommandItem
                    key={country.code}
                    value={country.name}
                    onSelect={() => {
                      onCountrySelect(country.code);
                      setComboOpen(false);
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", selectedCountry === country.code ? "opacity-100 text-primary" : "opacity-0")} />
                    <span>{getCountryFlag(country.code)}</span>
                    <span className="ml-1.5 truncate">{country.name}</span>
                    <span className={cn("ml-auto text-xs", country.count > 0 ? "text-primary" : "text-muted-foreground/40")}>
                      {country.count}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Divider */}
      <div className="w-px h-6 bg-border" />

      {/* Stats badges */}
      <div className="flex items-center gap-3 text-sm">
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted border border-border">
          <span className="font-mono text-foreground">{source === "bca" ? Object.keys(bcaCountryCounts).length : countries.filter(c => c.count > 0).length}</span>
          <span className="text-muted-foreground text-xs">Paesi</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30">
          <span className="font-mono text-emerald-400">{countriesWithPartners}</span>
          <span className="text-muted-foreground text-xs">Attivi</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/30">
          <span className="font-mono text-primary">{totalPartners}</span>
          <span className="text-muted-foreground text-xs">{source === "bca" ? "BCA" : "Partner"}</span>
        </div>
      </div>

      {/* Reset button */}
      {selectedCountry && (
        <>
          <div className="w-px h-6 bg-border" />
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => onCountrySelect(null)}
            className="text-primary hover:text-primary/80 hover:bg-primary/10"
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
          <div className="flex items-center gap-2 text-sm text-foreground/80">
            <Send className="w-4 h-4 text-emerald-400" />
            <span className="text-emerald-400">{campaignPartners.length}</span>
            <span className="text-muted-foreground">aziende</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-primary">{uniqueCountries}</span>
            <span className="text-muted-foreground">paesi</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-foreground">{totalWithEmail}</span>
            <span className="text-muted-foreground">email</span>
          </div>
          <Button 
            onClick={onGenerateJobs} 
            size="sm"
            className="space-button-primary"
          >
            <Briefcase className="w-4 h-4 mr-1.5" />
            Genera Jobs
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
      <Button
        variant="ghost"
        size="sm"
        onClick={onClearCampaign}
        className="text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 px-2 py-1"
      >
        <X className="w-3 h-3 mr-1" />
        Svuota
      </Button>
      
      <div className="flex flex-col gap-1.5 max-h-[60vh] overflow-y-auto pr-1">
        {campaignPartners.map(partner => (
          <div 
            key={partner.id}
            className={cn(
              "group flex items-center gap-2 bg-card/50 backdrop-blur-sm border rounded-lg px-3 py-1.5 text-sm",
              partner.has_bca ? "border-primary/40" : "border-emerald-500/30"
            )}
          >
            <span className="text-foreground truncate max-w-40">{partner.company_name}</span>
            <span className="text-muted-foreground text-xs">{getCountryFlag(partner.country_code)}</span>
            {partner.has_bca && <span className="text-[10px]">🤝</span>}
            {partner.email && <Mail className="w-3 h-3 text-emerald-500/60" />}
            <button
              onClick={() => onRemoveFromCampaign(partner.id)}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
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
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [campaignPartners, setCampaignPartners] = useState<CampaignPartner[]>([]);
  const [headerContainer, setHeaderContainer] = useState<HTMLElement | null>(null);
  const [source, setSource] = useState<CampaignSource>("partners");
  const [showGoalDialog, setShowGoalDialog] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState("primo_contatto");
  const navigate = useNavigate();

  // Fetch partners data — real counts from partners table
  const { data: countryData } = useCountryPartnerCounts();
  const { data: countryPartnersData = [] } = usePartnersByCountryForGlobe(selectedCountry);
  const { data: bcaPartnerIds } = useBusinessCardPartnerMatches();
  const { data: bcaCountryData = [] } = useBusinessCardsForCampaign(source === "bca" ? selectedCountry : null);
  const { data: bcaCountryCounts = {} } = useBcaCountryCounts();

  const countries = countryData?.countries || [];
  const totalPartners = source === "bca" 
    ? Object.values(bcaCountryCounts).reduce((a, b) => a + b, 0)
    : (countryData?.totalPartners || 0);
  const countriesWithPartners = source === "bca"
    ? Object.keys(bcaCountryCounts).length
    : (countryData?.activeCountries || 0);

  // Get partners for selected country
  const countryPartners = useMemo(() => {
    if (source === "bca") {
      const seen = new Set<string>();
      return bcaCountryData.filter((p: any) => {
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      });
    }
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
      is_bca: false,
    }));
  }, [countryPartnersData, bcaCountryData, source]);

  const countryName = selectedCountry 
    ? WCA_COUNTRIES_MAP[selectedCountry]?.name || ''
    : '';

  const handleTogglePartner = useCallback((partnerId: string) => {
    setSelectedPartnerIds(prev => {
      const next = new Set(prev);
      if (next.has(partnerId)) next.delete(partnerId);
      else next.add(partnerId);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedPartnerIds(new Set(countryPartners.map((p: any) => p.id)));
  }, [countryPartners]);

  const handleDeselectAll = useCallback(() => {
    setSelectedPartnerIds(new Set());
    setSelectedContactIds(new Set());
  }, []);

  const handleToggleContact = useCallback((contactId: string) => {
    setSelectedContactIds(prev => {
      const next = new Set(prev);
      if (next.has(contactId)) next.delete(contactId);
      else next.add(contactId);
      return next;
    });
  }, []);

  const handleAddToCampaign = useCallback(() => {
    const newPartners = countryPartners
      .filter((p: any) => selectedPartnerIds.has(p.id))
      .filter((p: any) => !campaignPartners.some(cp => cp.id === p.id))
      .map((p: any) => ({
        id: p.id,
        company_name: p.company_name,
        city: p.city,
        country_code: p.country_code,
        country_name: p.country_name,
        email: p.email,
        has_bca: p.is_bca || bcaPartnerIds?.has(p.id),
      }));

    setCampaignPartners(prev => [...prev, ...newPartners]);
    setSelectedPartnerIds(new Set());
  }, [countryPartners, selectedPartnerIds, campaignPartners, bcaPartnerIds]);

  const handleRemoveFromCampaign = useCallback((partnerId: string) => {
    setCampaignPartners(prev => prev.filter(p => p.id !== partnerId));
  }, []);

  const handleClearCampaign = useCallback(() => {
    setCampaignPartners([]);
  }, []);

  const handleCountrySelect = useCallback((countryCode: string | null) => {
    setSelectedCountry(countryCode);
    setSelectedPartnerIds(new Set());
  }, []);

  const handleSourceChange = useCallback((s: CampaignSource) => {
    setSource(s);
    setSelectedCountry(null);
    setSelectedPartnerIds(new Set());
  }, []);

  // Generate jobs → cockpit with goal
  const handleGenerateJobs = useCallback(async () => {
    const goalLabel = CAMPAIGN_GOALS.find(g => g.value === selectedGoal)?.label || selectedGoal;
    const batchId = crypto.randomUUID();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Non autenticato"); return; }

    const rows = campaignPartners.map(p => ({
      source_type: "campaign" as const,
      source_id: p.id,
      partner_id: p.id,
      user_id: user.id,
      status: "pending" as const,
    }));

    await insertCockpitQueueItems(rows);

    toast.success(`${campaignPartners.length} aziende inviate al Cockpit — Goal: ${goalLabel}`);
    setCampaignPartners([]);
    setShowGoalDialog(false);
    navigate("/v2/inreach?tab=cockpit");
  }, [campaignPartners, selectedGoal, navigate]);

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
          onGenerateJobs={() => setShowGoalDialog(true)}
          source={source}
          onSourceChange={handleSourceChange}
          bcaCountryCounts={bcaCountryCounts}
        />,
        headerContainer
      )}

      {/* Globe as full background */}
      <div className="absolute inset-0">
        <Suspense fallback={<div className="flex items-center justify-center h-full text-muted-foreground text-sm">Caricamento globo...</div>}>
          <CampaignGlobe
            selectedCountry={selectedCountry}
            onCountrySelect={handleCountrySelect}
          />
        </Suspense>
      </div>

      {/* Left side - Company List */}
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
            bcaPartnerIds={bcaPartnerIds}
            source={source}
            selectedContacts={selectedContactIds}
            onToggleContact={handleToggleContact}
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

      {/* Goal picker dialog */}
      <Dialog open={showGoalDialog} onOpenChange={setShowGoalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <Target className="w-5 h-5" />
              Seleziona Goal Campagna
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-3">
              {campaignPartners.length} aziende saranno inviate al Cockpit con il goal selezionato.
              {campaignPartners.filter(p => p.has_bca).length > 0 && (
                <span className="text-primary ml-1">
                  ({campaignPartners.filter(p => p.has_bca).length} incontrate di persona)
                </span>
              )}
            </p>
            <Select value={selectedGoal} onValueChange={setSelectedGoal}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CAMPAIGN_GOALS.map(g => (
                  <SelectItem key={g.value} value={g.value}>
                    {g.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowGoalDialog(false)}>
              Annulla
            </Button>
            <Button onClick={handleGenerateJobs} className="space-button-primary">
              <Send className="w-4 h-4 mr-1.5" />
              Invia al Cockpit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
