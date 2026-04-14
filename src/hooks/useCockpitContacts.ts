import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getPartnersByIds } from "@/data/partners";
import { getPartnerContactsByIds, findSocialLinksByPartnerIds, getProspectContactsByIds } from "@/data/partnerRelations";
import { findCockpitQueue, deleteCockpitQueueBySource, insertCockpitQueueItems } from "@/data/cockpitQueue";
import { useMemo } from "react";
import { format } from "date-fns";
import { autoAssignAgent } from "@/hooks/useAutoAssignAgent";
import type { ContactOrigin } from "@/pages/Cockpit";
import { createLogger } from "@/lib/log";
import { getContactsByIds } from "@/data/contacts";
import { findBusinessCards } from "@/data/businessCards";
import { addCockpitPreselection } from "@/lib/cockpitPreselection";

const log = createLogger("useCockpitContacts");

export interface CockpitContact {
  id: string;
  queueId: string;
  name: string;
  company: string;
  role: string;
  country: string;
  language: string;
  lastContact: string;
  priority: number;
  channels: string[];
  email: string;
  phone: string;
  origin: ContactOrigin;
  originDetail: string;
  sourceType: string;
  sourceId: string;
  partnerId: string | null;
  linkedinUrl: string;
  contactAlias?: string;
  companyAlias?: string;
  isScheduledReturn?: boolean;
  isBusinessCard?: boolean;
  deepSearchAt?: string;
  enrichmentData?: Record<string, unknown>;
  memberSince?: string;
  memberYears?: number;
  networks?: string[];
  seniority?: string;
  specialties?: string[];
  leadStatus?: string;
}

const COUNTRY_LANGUAGE: Record<string, string> = {
  IT: "italiano", FR: "français", DE: "deutsch", ES: "español",
  BR: "português", PT: "português", JP: "日本語", CN: "中文",
};

export function inferLanguage(countryCode: string | null): string {
  if (!countryCode) return "english";
  return COUNTRY_LANGUAGE[countryCode.toUpperCase().trim()] || "english";
}

export function inferChannels(email?: string | null, phone?: string | null, mobile?: string | null): string[] {
  const ch: string[] = [];
  if (email) ch.push("email");
  if (phone || mobile) ch.push("whatsapp", "sms");
  ch.push("linkedin");
  return ch;
}

export function computePriority(email?: string | null, phone?: string | null, mobile?: string | null): number {
  let p = 1;
  if (email) p += 3;
  if (phone || mobile) p += 2;
  return Math.min(p, 10);
}

interface PartnerRow {
  member_since?: string;
  enrichment_data?: Record<string, unknown>;
  company_name?: string;
  country_code?: string;
  company_alias?: string;
  enriched_at?: string;
  ai_parsed_at?: string;
  lead_status?: string;
  id: string;
}

interface BusinessCardRow {
  id: string;
  contact_name?: string | null;
  company_name?: string | null;
  position?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  event_name?: string | null;
  met_at?: string | null;
  created_at?: string;
}

interface ImportedContactRow {
  id: string;
  name?: string | null;
  company_name?: string | null;
  position?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  country?: string | null;
  city?: string | null;
  origin?: string | null;
  created_at?: string;
  enrichment_data?: Record<string, unknown> | null;
  deep_search_at?: string | null;
  contact_alias?: string | null;
  company_alias?: string | null;
}

function extractPartnerMeta(partner: PartnerRow | undefined): { memberSince?: string; memberYears?: number; networks?: string[]; seniority?: string; specialties?: string[] } {
  if (!partner) return {};
  const meta: { memberSince?: string; memberYears?: number; networks?: string[]; seniority?: string; specialties?: string[] } = {};
  if (partner.member_since) {
    meta.memberSince = partner.member_since;
    const y = new Date().getFullYear() - new Date(partner.member_since).getFullYear();
    if (y >= 0) meta.memberYears = y;
  }
  const ed = partner.enrichment_data;
  if (ed) {
    const companyProfile = ed.company_profile as Record<string, unknown> | undefined;
    const contactProfile = ed.contact_profile as Record<string, unknown> | undefined;
    if (companyProfile?.specialties && Array.isArray(companyProfile.specialties)) meta.specialties = (companyProfile.specialties as string[]).slice(0, 4);
    if (contactProfile?.seniority && typeof contactProfile.seniority === "string") meta.seniority = contactProfile.seniority;
    const nets: string[] = [];
    if (ed.networks && Array.isArray(ed.networks)) nets.push(...(ed.networks as string[]));
    if (companyProfile?.networks && Array.isArray(companyProfile.networks)) nets.push(...(companyProfile.networks as string[]));
    if (nets.length) meta.networks = [...new Set(nets)];
  }
  return meta;
}

function formatRelativeDate(dateStr: string | null): string {
  if (!dateStr) return "Mai";
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (days < 1) return "Oggi";
  if (days === 1) return "Ieri";
  if (days < 7) return `${days} giorni fa`;
  if (days < 30) return `${Math.floor(days / 7)} settimane fa`;
  if (days < 365) return `${Math.floor(days / 30)} mesi fa`;
  return `${Math.floor(days / 365)} anni fa`;
}

export function useCockpitContacts() {
  const q = useQuery({
    queryKey: ["cockpit-queue"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const queue = await findCockpitQueue(user.id);
      if (queue.length === 0) return [];

      // Group source_ids by source_type
      const pcIds = queue.filter(q => q.source_type === "partner_contact").map(q => q.source_id);
      const bcIds = queue.filter(q => q.source_type === "business_card").map(q => q.source_id);
      const prcIds = queue.filter(q => q.source_type === "prospect_contact").map(q => q.source_id);
      const icIds = queue.filter(q => q.source_type === "contact").map(q => q.source_id);

      // Fetch source data in parallel using DAL (top-level imports, no dynamic imports)
      const [pcData, bcData, prcData, icData] = await Promise.all([
        pcIds.length > 0
          ? getPartnerContactsByIds(pcIds, "id, name, title, email, direct_phone, mobile, partner_id, contact_alias")
          : Promise.resolve([]),
        bcIds.length > 0
          ? findBusinessCards().then(cards => cards.filter((c: BusinessCardRow) => bcIds.includes(c.id)))
          : Promise.resolve([]),
        prcIds.length > 0
          ? getProspectContactsByIds(prcIds)
          : Promise.resolve([]),
        icIds.length > 0
          ? getContactsByIds(icIds, "id, name, company_name, position, email, phone, mobile, country, city, origin, created_at, enrichment_data, deep_search_at, contact_alias, company_alias")
          : Promise.resolve([]),
      ]);

      // Fetch social links (LinkedIn) for partner contacts
      const allPartnerIdsForSocial: string[] = [
        ...queue.filter(q => q.partner_id).map(q => q.partner_id!),
        ...pcData.filter(c => c.partner_id).map(c => c.partner_id!),
      ].filter(Boolean);
      const uniqueSocialPartnerIds = [...new Set(allPartnerIdsForSocial)];
      const socialLinksMap: Record<string, string> = {};
      const contactSocialMap: Record<string, string> = {};
      if (uniqueSocialPartnerIds.length > 0) {
        const slData = await findSocialLinksByPartnerIds(uniqueSocialPartnerIds, "linkedin");
        for (const sl of slData) {
          if (sl.contact_id) {
            contactSocialMap[sl.contact_id] = sl.url;
          } else {
            socialLinksMap[sl.partner_id] = sl.url;
          }
        }
      }

      // Also fetch partner names for partner_contacts
      const partnerIds: string[] = [
        ...queue.filter(q => q.partner_id).map(q => q.partner_id!),
        ...pcData.filter(c => c.partner_id).map(c => c.partner_id!),
      ].filter(Boolean);
      const uniquePartnerIds = [...new Set(partnerIds)];
      const partnersMap: Record<string, PartnerRow> = {};
      if (uniquePartnerIds.length > 0) {
        const pData = await getPartnersByIds(uniquePartnerIds, "id, company_name, country_code, company_alias, enrichment_data, enriched_at, ai_parsed_at, member_since, lead_status");
        for (const p of pData || []) partnersMap[p.id as string] = p as unknown as PartnerRow;
      }

      // Build lookup maps
      const pcMap: Record<string, (typeof pcData)[number]> = {};
      for (const c of pcData) pcMap[c.id] = c;
      const bcMap: Record<string, (typeof bcData)[number]> = {};
      for (const c of bcData) bcMap[c.id] = c;
      const prcMap: Record<string, (typeof prcData)[number]> = {};
      for (const c of prcData) prcMap[c.id] = c;
      const icMap: Record<string, (typeof icData)[number]> = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const c of icData) icMap[(c as any).id] = c;

      // Fetch today's scheduled activities
      const today = format(new Date(), "yyyy-MM-dd");
      const { data: scheduledActivities } = await supabase
        .from("activities")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .eq("due_date", today)
        .limit(100);

      return { queue, pcMap, bcMap, prcMap, icMap, partnersMap, scheduledActivities: scheduledActivities || [], socialLinksMap, contactSocialMap };
    },
    staleTime: 30_000,
  });

  const contacts = useMemo<CockpitContact[]>(() => {
    if (!q.data || Array.isArray(q.data)) return [];
    const { queue, pcMap, bcMap, prcMap, icMap, partnersMap, scheduledActivities, socialLinksMap, contactSocialMap } = q.data;
    const result: CockpitContact[] = [];

    for (const item of queue) {
      const st = item.source_type;
      const sid = item.source_id;

      if (st === "partner_contact") {
        const pc = pcMap[sid];
        if (!pc) continue;
        const partner = (pc.partner_id ? partnersMap[pc.partner_id] : undefined) || (item.partner_id ? partnersMap[item.partner_id] : undefined);
        const pMeta = extractPartnerMeta(partner);
        result.push({
          id: `pc-${pc.id}`, queueId: item.id,
          name: pc.name || "—", company: partner?.company_name || "—",
          role: pc.title || "", country: partner?.country_code || "",
          language: inferLanguage(partner?.country_code ?? null),
          lastContact: formatRelativeDate(item.created_at),
          priority: computePriority(pc.email, pc.direct_phone, pc.mobile),
          channels: inferChannels(pc.email, pc.direct_phone, pc.mobile),
          email: pc.email || "", phone: pc.mobile || pc.direct_phone || "",
          origin: "wca" as ContactOrigin, originDetail: partner?.company_name || "Partner",
          sourceType: st, sourceId: sid, partnerId: pc.partner_id || item.partner_id,
          linkedinUrl: contactSocialMap[pc.id] || (pc.partner_id ? socialLinksMap[pc.partner_id] : "") || "",
          contactAlias: pc.contact_alias || undefined,
          companyAlias: partner?.company_alias || undefined,
          deepSearchAt: partner?.enriched_at || partner?.ai_parsed_at || undefined,
          enrichmentData: (partner?.enrichment_data as Record<string, unknown>) || undefined,
          leadStatus: partner?.lead_status || "new",
          ...pMeta,
        });
      } else if (st === "business_card") {
        const bc = bcMap[sid] as BusinessCardRow | undefined;
        if (!bc) continue;
        result.push({
          id: `bc-${bc.id}`, queueId: item.id,
          name: bc.contact_name || "—", company: bc.company_name || "—",
          role: bc.position || "", country: "", language: "english",
          lastContact: formatRelativeDate(bc.met_at || bc.created_at || null),
          priority: computePriority(bc.email, bc.phone, bc.mobile),
          channels: inferChannels(bc.email, bc.phone, bc.mobile),
          email: bc.email || "", phone: bc.mobile || bc.phone || "",
          origin: "bca" as ContactOrigin,
          originDetail: bc.event_name ? `BCA · ${bc.event_name}` : "Biglietto da visita",
          sourceType: st, sourceId: sid, partnerId: item.partner_id,
          linkedinUrl: "", isBusinessCard: true,
        });
      } else if (st === "prospect_contact") {
        const prc = prcMap[sid];
        if (!prc) continue;
        result.push({
          id: `prc-${prc.id}`, queueId: item.id,
          name: prc.name || "—", company: "—",
          role: prc.role || "", country: "", language: "italiano",
          lastContact: formatRelativeDate(item.created_at),
          priority: computePriority(prc.email, prc.phone, null),
          channels: inferChannels(prc.email, prc.phone, null),
          email: prc.email || "", phone: prc.phone || "",
          origin: "report_aziende" as ContactOrigin, originDetail: "Prospect",
          sourceType: st, sourceId: sid, partnerId: item.partner_id,
          linkedinUrl: prc.linkedin_url || "",
        });
      } else if (st === "contact") {
        const ic = icMap[sid] as unknown as ImportedContactRow | undefined;
        if (!ic) continue;
        const icEd = ic.enrichment_data || {};
        const contactProfiles = icEd.contact_profiles as Record<string, Record<string, unknown>> | undefined;
        let icLinkedin = (icEd.linkedin_profile_url as string) || (icEd.linkedin_url as string) || ((icEd.social_links as Record<string, string> | undefined)?.linkedin) || "";
        if (!icLinkedin && contactProfiles && typeof contactProfiles === "object") {
          const profiles = Object.values(contactProfiles);
          const found = profiles.find((cp) => typeof cp === "object" && cp !== null && "linkedin_url" in cp);
          if (found) icLinkedin = found.linkedin_url as string;
        }
        const icPartnerId = item.partner_id;
        if (!icLinkedin && icPartnerId && socialLinksMap[icPartnerId]) icLinkedin = socialLinksMap[icPartnerId];
        const icMeta: Partial<CockpitContact> = {};
        const contactProfile = icEd.contact_profile as Record<string, unknown> | undefined;
        const companyProfile = icEd.company_profile as Record<string, unknown> | undefined;
        if (contactProfile?.seniority && typeof contactProfile.seniority === "string") icMeta.seniority = contactProfile.seniority;
        if (companyProfile?.specialties && Array.isArray(companyProfile.specialties)) icMeta.specialties = (companyProfile.specialties as string[]).slice(0, 4);
        result.push({
          id: `ic-${ic.id}`, queueId: item.id,
          name: ic.name || "—", company: ic.company_name || "—",
          role: ic.position || "", country: ic.country || "",
          language: inferLanguage(ic.country || null),
          lastContact: formatRelativeDate(ic.created_at || null),
          priority: computePriority(ic.email, ic.phone, ic.mobile),
          channels: inferChannels(ic.email, ic.phone, ic.mobile),
          email: ic.email || "", phone: ic.mobile || ic.phone || "",
          origin: "manual" as ContactOrigin, originDetail: ic.origin || "Manuale",
          sourceType: st, sourceId: sid, partnerId: item.partner_id,
          linkedinUrl: icLinkedin,
          contactAlias: ic.contact_alias || undefined,
          companyAlias: ic.company_alias || undefined,
          deepSearchAt: ic.deep_search_at || undefined,
          enrichmentData: (ic.enrichment_data as Record<string, unknown>) || undefined,
          ...icMeta,
        });
      }
    }

    // Add scheduled return activities
    interface ActivityMeta { name?: string; company?: string; country?: string; email?: string; phone?: string; mobile?: string }
    for (const act of scheduledActivities) {
      const meta = (act.source_meta || {}) as ActivityMeta;
      const existsAlready = result.some(r => r.sourceId === act.source_id);
      if (existsAlready) continue;
      result.push({
        id: `act-${act.id}`, queueId: act.id,
        name: meta.name || act.title || "—", company: meta.company || "—",
        role: "", country: meta.country || "",
        language: inferLanguage(meta.country || null),
        lastContact: formatRelativeDate(act.created_at),
        priority: act.priority === "high" ? 8 : act.priority === "low" ? 3 : 5,
        channels: inferChannels(meta.email, null, null),
        email: meta.email || "", phone: meta.phone || meta.mobile || "",
        origin: "wca" as ContactOrigin, originDetail: `📅 Riprogrammato`,
        sourceType: act.source_type, sourceId: act.source_id,
        partnerId: act.partner_id, linkedinUrl: act.partner_id ? (socialLinksMap[act.partner_id] || "") : "",
        isScheduledReturn: true,
      });
    }

    result.sort((a, b) => b.priority - a.priority);
    return result;
  }, [q.data]);

  const contactsMap = useMemo(() => {
    const map: Record<string, CockpitContact> = {};
    for (const c of contacts) map[c.id] = c;
    return map;
  }, [contacts]);

  return { contacts, contactsMap, isLoading: q.isLoading };
}

export function useDeleteCockpitContacts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (prefixedIds: string[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const sourceEntries: { type: string; id: string }[] = [];
      for (const pid of prefixedIds) {
        if (pid.startsWith("pc-")) sourceEntries.push({ type: "partner_contact", id: pid.slice(3) });
        else if (pid.startsWith("bc-")) sourceEntries.push({ type: "business_card", id: pid.slice(3) });
        else if (pid.startsWith("prc-")) sourceEntries.push({ type: "prospect_contact", id: pid.slice(4) });
        else if (pid.startsWith("ic-")) sourceEntries.push({ type: "contact", id: pid.slice(3) });
      }

      for (const entry of sourceEntries) {
        await deleteCockpitQueueBySource(user.id, entry.type, entry.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cockpit-queue"] });
    },
  });
}

export function useSendToCockpit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (items: { sourceType: string; sourceId: string; partnerId?: string; countryCode?: string }[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const inserts = items.map(item => ({
        user_id: user.id,
        source_type: item.sourceType,
        source_id: item.sourceId,
        partner_id: item.partnerId || null,
        status: "queued",
      }));

      await insertCockpitQueueItems(inserts);

      addCockpitPreselection(items.map(i => i.sourceId));

      for (const item of items) {
        try {
          await autoAssignAgent({
            sourceId: item.sourceId,
            sourceType: item.sourceType,
            countryCode: item.countryCode || null,
            userId: user.id,
          });
        } catch (e: unknown) {
          log.warn("auto-assign failed", { sourceId: item.sourceId, message: e instanceof Error ? e.message : String(e) });
        }
      }

      return inserts.length;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cockpit-queue"] });
      queryClient.invalidateQueries({ queryKey: ["client-assignments"] });
    },
  });
}
