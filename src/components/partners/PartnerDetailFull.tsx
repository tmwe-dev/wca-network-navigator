import type { PartnerViewModel } from "@/types/partner-views";
/**
 * PartnerDetailFull — shell that composes Header, Info, Activity sub-components
 */
import { getBranchCountries } from "@/lib/partnerUtils";
import { getYearsMember } from "@/lib/countries";
import { useBlacklistForPartner } from "@/hooks/useBlacklist";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PartnerDetailHeader } from "./PartnerDetailHeader";
import { PartnerDetailInfo } from "./PartnerDetailInfo";
import { PartnerDetailActivity } from "./PartnerDetailActivity";

interface PartnerDetailFullProps {
  partner: PartnerViewModel;
  onToggleFavorite: () => void;
}

export function PartnerDetailFull({ partner, onToggleFavorite }: PartnerDetailFullProps) {
  const { data: blacklistEntries = [] } = useBlacklistForPartner(String(partner.id));
  const isBlacklisted = blacklistEntries.length > 0;

  const hasBranches = Array.isArray(partner.branch_cities) && (partner.branch_cities as unknown[]).length > 0;
  const branchCountries = getBranchCountries(partner);
  const years = getYearsMember(partner.member_since as string | null);
  const services = (partner.partner_services || []) as { service_category: string }[];
  const enrichment = (partner.enrichment_data as Record<string, unknown>) || null;
  const contacts = (partner.partner_contacts || []) as {
    id: string;
    name: string;
    title?: string;
    email?: string;
    direct_phone?: string;
    mobile?: string;
    is_primary?: boolean;
  }[];
  const networks = (partner.partner_networks || []) as { id: string; network_name: string; expires?: string }[];
  const interactions = (partner.interactions || []) as {
    id: string;
    interaction_type?: string;
    subject?: string;
    interaction_date: string;
    notes?: string;
  }[];
  const reminders = (partner.reminders || []) as { id: string; title: string; due_date: string; status: string }[];

  const expiryDate = partner.membership_expires ? new Date(String(partner.membership_expires)) : null;
  const isExpiringSoon = !!(
    expiryDate &&
    expiryDate > new Date() &&
    expiryDate < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
  );
  const isExpired = !!(expiryDate && expiryDate < new Date());

  return (
    <div className="p-3 space-y-2">
      <Tabs defaultValue="panoramica" className="w-full">
        <TabsList className="w-full grid grid-cols-3 h-8">
          <TabsTrigger value="panoramica">Panoramica</TabsTrigger>
          <TabsTrigger value="profilo">Profilo</TabsTrigger>
          <TabsTrigger value="contatti">Contatti ({contacts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="panoramica" className="mt-2 space-y-2">

          <PartnerDetailHeader
            partner={partner}
            enrichment={enrichment}
            networks={networks}
            services={services}
            branchCountries={branchCountries}
            years={years}
            expiryDate={expiryDate}
            isExpiringSoon={isExpiringSoon}
            isExpired={isExpired}
            onToggleFavorite={onToggleFavorite}
          />
        </TabsContent>

        <TabsContent value="profilo" className="mt-3 space-y-3">
          <PartnerDetailInfo
            view="profilo"
            partner={partner}
            enrichment={enrichment}
            contacts={contacts}
            networks={networks}
            allServices={services}
            branchCountries={branchCountries}
            hasBranches={hasBranches}
          />
        </TabsContent>

        <TabsContent value="contatti" className="mt-3 space-y-3">
          <PartnerDetailInfo
            view="contatti"
            partner={partner}
            enrichment={enrichment}
            contacts={contacts}
            networks={networks}
            allServices={services}
            branchCountries={branchCountries}
            hasBranches={hasBranches}
          />
        </TabsContent>
      </Tabs>

      <PartnerDetailActivity
        partnerId={String(partner.id)}
        interactions={interactions}
        reminders={reminders}
        isBlacklisted={isBlacklisted}
        blacklistEntries={blacklistEntries}
      />
    </div>
  );
}
