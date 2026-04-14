import type { PartnerViewModel } from "@/types/partner-views";
/**
 * PartnerDetailFull — shell that composes Header, Info, Activity sub-components
 */
import { getBranchCountries } from "@/lib/partnerUtils";
import { getYearsMember } from "@/lib/countries";
import { useBlacklistForPartner } from "@/hooks/useBlacklist";
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
  const contacts = (partner.partner_contacts || []) as { id: string; name: string; title?: string; email?: string; direct_phone?: string; mobile?: string; is_primary?: boolean }[];
  const networks = (partner.partner_networks || []) as { id: string; network_name: string; expires?: string }[];
  const interactions = (partner.interactions || []) as { id: string; interaction_type?: string; subject?: string; interaction_date: string; notes?: string }[];
  const reminders = (partner.reminders || []) as { id: string; title: string; due_date: string; status: string }[];

  const expiryDate = partner.membership_expires ? new Date(String(partner.membership_expires)) : null;
  const isExpiringSoon = !!(expiryDate && expiryDate > new Date() && expiryDate < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000));
  const isExpired = !!(expiryDate && expiryDate < new Date());

  return (
    <div className="p-5 space-y-3">
      <PartnerDetailActivity
        partnerId={String(partner.id)}
        interactions={[]}
        reminders={[]}
        isBlacklisted={isBlacklisted}
        blacklistEntries={blacklistEntries}
      />

      <PartnerDetailHeader
        partner={partner}
        enrichment={enrichment}
        networks={networks}
        years={years}
        expiryDate={expiryDate}
        isExpiringSoon={isExpiringSoon}
        isExpired={isExpired}
        onToggleFavorite={onToggleFavorite}
      />

      <PartnerDetailInfo
        partner={partner}
        enrichment={enrichment}
        contacts={contacts}
        networks={networks}
        allServices={services}
        branchCountries={branchCountries}
        hasBranches={hasBranches}
      />

      <PartnerDetailActivity
        partnerId={String(partner.id)}
        interactions={interactions}
        reminders={reminders}
        isBlacklisted={false}
        blacklistEntries={[]}
      />
    </div>
  );
}
