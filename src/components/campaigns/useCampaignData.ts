/**
 * useCampaignData — All state, queries and handlers for Campaigns page
 */
import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { usePartnersByCountryForGlobe, useBusinessCardsForCampaign, useBcaCountryCounts } from "@/hooks/usePartnersForGlobe";
import { useCountryPartnerCounts } from "@/hooks/useCountryPartnerCounts";
import { useBusinessCardPartnerMatches } from "@/hooks/useBusinessCards";
import { WCA_COUNTRIES_MAP } from "@/data/wcaCountries";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { insertCockpitQueueItems } from "@/data/cockpitQueue";

export type CampaignSource = "partners" | "bca";

export const CAMPAIGN_GOALS = [
  { value: "primo_contatto", label: "Primo Contatto" },
  { value: "follow_up_fiera", label: "Follow-up Fiera" },
  { value: "follow_up", label: "Follow-up Generico" },
  { value: "partnership", label: "Proposta Partnership" },
  { value: "richiesta_info", label: "Richiesta Info" },
] as const;

export interface CampaignPartner {
  id: string;
  company_name: string;
  city: string;
  country_code: string;
  country_name: string;
  email: string | null;
  has_bca?: boolean;
}

interface CountryPartnerRaw {
  id: string;
  company_name: string;
  city: string;
  country_code: string;
  country_name: string;
  email: string | null;
  partner_type: string | null;
  partner_certifications?: { certification: string }[];
  partner_services?: { service_category: string }[];
  is_bca?: boolean;
  bca_event?: string;
  bca_contact?: string;
}

export function useCampaignData() {
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedPartnerIds, setSelectedPartnerIds] = useState<Set<string>>(new Set());
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [campaignPartners, setCampaignPartners] = useState<CampaignPartner[]>([]);
  const [viewMode, setViewMode] = useState<"globe" | "analytics">("globe");
  const [source, setSource] = useState<CampaignSource>("partners");
  const [showGoalDialog, setShowGoalDialog] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState("primo_contatto");
  const navigate = useNavigate();

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

  const countryPartners = useMemo((): CountryPartnerRaw[] => {
    if (source === "bca") {
      const seen = new Set<string>();
      return ((bcaCountryData || []) as any as CountryPartnerRaw[]).filter((p) => {
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      });
    }
    return countryPartnersData.map((p) => ({
      id: p.id,
      company_name: p.company_name,
      city: p.city,
      country_code: p.country_code,
      country_name: p.country_name,
      email: p.email,
      partner_type: p.partner_type || "freight_forwarder",
      partner_certifications: [] as { certification: string }[],
      partner_services: [] as { service_category: string }[],
      is_bca: false,
    }));
  }, [countryPartnersData, bcaCountryData, source]);

  const countryName = selectedCountry
    ? WCA_COUNTRIES_MAP[selectedCountry]?.name || ""
    : "";

  const handleTogglePartner = useCallback((partnerId: string) => {
    setSelectedPartnerIds((prev) => {
      const next = new Set(prev);
      if (next.has(partnerId)) next.delete(partnerId);
      else next.add(partnerId);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedPartnerIds(new Set(countryPartners.map((p) => p.id)));
  }, [countryPartners]);

  const handleDeselectAll = useCallback(() => {
    setSelectedPartnerIds(new Set());
    setSelectedContactIds(new Set());
  }, []);

  const handleToggleContact = useCallback((contactId: string) => {
    setSelectedContactIds((prev) => {
      const next = new Set(prev);
      if (next.has(contactId)) next.delete(contactId);
      else next.add(contactId);
      return next;
    });
  }, []);

  const handleAddToCampaign = useCallback(() => {
    const newPartners = countryPartners
      .filter((p) => selectedPartnerIds.has(p.id))
      .filter((p) => !campaignPartners.some((cp) => cp.id === p.id))
      .map((p) => ({
        id: p.id,
        company_name: p.company_name,
        city: p.city,
        country_code: p.country_code,
        country_name: p.country_name,
        email: p.email,
        has_bca: p.is_bca || bcaPartnerIds?.has(p.id),
      }));

    setCampaignPartners((prev) => [...prev, ...newPartners]);
    setSelectedPartnerIds(new Set());
  }, [countryPartners, selectedPartnerIds, campaignPartners, bcaPartnerIds]);

  const handleRemoveFromCampaign = useCallback((partnerId: string) => {
    setCampaignPartners((prev) => prev.filter((p) => p.id !== partnerId));
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

  const handleGenerateJobs = useCallback(async () => {
    const goalLabel = CAMPAIGN_GOALS.find((g) => g.value === selectedGoal)?.label || selectedGoal;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Non autenticato"); return; }

    const rows = campaignPartners.map((p) => ({
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

  return {
    selectedCountry,
    selectedPartnerIds,
    selectedContactIds,
    campaignPartners,
    viewMode,
    setViewMode,
    source,
    showGoalDialog,
    setShowGoalDialog,
    selectedGoal,
    setSelectedGoal,
    countries,
    totalPartners,
    countriesWithPartners,
    countryPartners,
    countryName,
    bcaPartnerIds,
    bcaCountryCounts,
    handleTogglePartner,
    handleSelectAll,
    handleDeselectAll,
    handleToggleContact,
    handleAddToCampaign,
    handleRemoveFromCampaign,
    handleClearCampaign,
    handleCountrySelect,
    handleSourceChange,
    handleGenerateJobs,
  };
}
