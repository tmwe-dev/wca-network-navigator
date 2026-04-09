import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { format } from "date-fns";
import { autoAssignAgent } from "@/hooks/useAutoAssignAgent";
import type { ContactOrigin } from "@/pages/Cockpit";
import { createLogger } from "@/lib/log";

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

function inferLanguage(countryCode: string | null): string {
  if (!countryCode) return "english";
  return COUNTRY_LANGUAGE[countryCode.toUpperCase().trim()] || "english";
}

function inferChannels(email?: string | null, phone?: string | null, mobile?: string | null): string[] {
  const ch: string[] = [];
  if (email) ch.push("email");
  if (phone || mobile) ch.push("whatsapp", "sms");
  ch.push("linkedin");
  return ch;
}

function computePriority(email?: string | null, phone?: string | null, mobile?: string | null): number {
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

function extractPartnerMeta(partner: PartnerRow | undefined): { memberSince?: string; memberYears?: number; networks?: string[]; seniority?: string; specialties?: string[] } {
  if (!partner) return {};
  const meta: { memberSince?: string; memberYears?: number; networks?: string[]; seniority?: string; specialties?: string[] } = {};
  if (partner.member_since) {
    meta.memberSince = partner.member_since;
    const y = new Date().getFullYear() - new Date(partner.member_since).getFullYear();
    if (y >= 0) meta.memberYears = y;
  }
  const ed = partner.enrichment_data as Record<string, unknown> | undefined;
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

      // Fetch queue items
      const { data: queue, error } = await supabase
        .from("cockpit_queue")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "queued")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      if (!queue || queue.length === 0) return [];

      // Group source_ids by source_type
      const pcIds = queue.filter(q => q.source_type === "partner_contact").map(q => q.source_id);
      const bcIds = queue.filter(q => q.source_type === "business_card").map(q => q.source_id);
      const prcIds = queue.filter(q => q.source_type === "prospect_contact").map(q => q.source_id);
      const icIds = queue.filter(q => q.source_type === "contact").map(q => q.source_id);

      // Fetch source data in parallel
      const [pcData, bcData, prcData, icData] = await Promise.all([
        pcIds.length > 0
          ? supabase.from("partner_contacts").select("id, name, title, email, direct_phone, mobile, partner_id, contact_alias").in("id", pcIds).then(r => r.data || [])
          : Promise.resolve([]),
        bcIds.length > 0
          ? supabase.from("business_cards").select("id, contact_name, company_name, position, email, phone, mobile, event_name, met_at, created_at").in("id", bcIds).then(r => r.data || [])
          : Promise.resolve([]),
        prcIds.length > 0
          ? supabase.from("prospect_contacts").select("id, name, role, email, phone, prospect_id, linkedin_url").in("id", prcIds).then(r => r.data || [])
          : Promise.resolve([]),
        icIds.length > 0
          ? supabase.from("imported_contacts").select("id, name, company_name, position, email, phone, mobile, country, city, origin, created_at, enrichment_data, deep_search_at, contact_alias, company_alias").in("id", icIds).then(r => r.data || [])
          : Promise.resolve([]),
      ]);

      // Fetch social links (LinkedIn) for partner contacts
      const allPartnerIdsForSocial = [
        ...queue.filter(q => q.partner_id).map(q => q.partner_id),
        ...pcData.filter(c => c.partner_id).map(c => c.partner_id),
      ];
      const uniqueSocialPartnerIds = [...new Set(allPartnerIdsForSocial)];
      let socialLinksMap: Record<string, string> = {}; // partnerId -> linkedin url
      let contactSocialMap: Record<string, string> = {}; // contactId -> linkedin url
      if (uniqueSocialPartnerIds.length > 0) {
        const { data: slData } = await supabase
          .from("partner_social_links")
          .select("partner_id, contact_id, platform, url")
          .in("partner_id", uniqueSocialPartnerIds)
          .eq("platform", "linkedin");
        for (const sl of slData || []) {
          if (sl.contact_id) {
            contactSocialMap[sl.contact_id] = sl.url;
          } else {
            socialLinksMap[sl.partner_id] = sl.url;
          }
        }
      }

      // Also fetch partner names for partner_contacts
      const partnerIds = [
        ...queue.filter(q => q.partner_id).map(q => q.partner_id),
        ...pcData.filter(c => c.partner_id).map(c => c.partner_id),
      ];
      const uniquePartnerIds = [...new Set(partnerIds)];
      let partnersMap: Record<string, PartnerRow> = {};
      if (uniquePartnerIds.length > 0) {
        const { data: pData } = await supabase.from("partners").select("id, company_name, country_code, company_alias, enrichment_data, enriched_at, ai_parsed_at, member_since, lead_status").in("id", uniquePartnerIds);
        for (const p of pData || []) partnersMap[p.id] = p as unknown as PartnerRow;
      }

      // Build lookup maps
      const pcMap: Record<string, (typeof pcData)[number]> = {};
      for (const c of pcData) pcMap[c.id] = c;
      const bcMap: Record<string, (typeof bcData)[number]> = {};
      for (const c of bcData) bcMap[c.id] = c;
      const prcMap: Record<string, (typeof prcData)[number]> = {};
      for (const c of prcData) prcMap[c.id] = c;
      const icMap: Record<string, (typeof icData)[number]> = {};
      for (const c of icData) icMap[c.id] = c;

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
          id: `pc-${pc.id}`,
          queueId: item.id,
          name: pc.name || "—",
          company: partner?.company_name || "—",
          role: pc.title || "",
          country: partner?.country_code || "",
          language: inferLanguage(partner?.country_code),
          lastContact: formatRelativeDate(item.created_at),
          priority: computePriority(pc.email, pc.direct_phone, pc.mobile),
          channels: inferChannels(pc.email, pc.direct_phone, pc.mobile),
          email: pc.email || "",
          phone: pc.mobile || pc.direct_phone || "",
          origin: "wca" as ContactOrigin,
          originDetail: partner?.company_name || "Partner",
          sourceType: st,
          sourceId: sid,
          partnerId: pc.partner_id || item.partner_id,
          linkedinUrl: contactSocialMap[pc.id] || socialLinksMap[pc.partner_id] || "",
          contactAlias: pc.contact_alias || undefined,
          companyAlias: partner?.company_alias || undefined,
          deepSearchAt: partner?.enriched_at || partner?.ai_parsed_at || undefined,
          enrichmentData: partner?.enrichment_data || undefined,
          leadStatus: partner?.lead_status || "new",
          ...pMeta,
        });
      } else if (st === "business_card") {
        const bc = bcMap[sid];
        if (!bc) continue;
        result.push({
          id: `bc-${bc.id}`,
          queueId: item.id,
          name: bc.contact_name || "—",
          company: bc.company_name || "—",
          role: bc.position || "",
          country: "",
          language: "english",
          lastContact: formatRelativeDate(bc.met_at || bc.created_at),
          priority: computePriority(bc.email, bc.phone, bc.mobile),
          channels: inferChannels(bc.email, bc.phone, bc.mobile),
          email: bc.email || "",
          phone: bc.mobile || bc.phone || "",
          origin: "bca" as ContactOrigin,
          originDetail: bc.event_name ? `BCA · ${bc.event_name}` : "Biglietto da visita",
          sourceType: st,
          sourceId: sid,
          partnerId: item.partner_id,
          linkedinUrl: "",
          isBusinessCard: true,
        });
      } else if (st === "prospect_contact") {
        const prc = prcMap[sid];
        if (!prc) continue;
        result.push({
          id: `prc-${prc.id}`,
          queueId: item.id,
          name: prc.name || "—",
          company: "—",
          role: prc.role || "",
          country: "",
          language: "italiano",
          lastContact: formatRelativeDate(item.created_at),
          priority: computePriority(prc.email, prc.phone, null),
          channels: inferChannels(prc.email, prc.phone, null),
          email: prc.email || "",
          phone: prc.phone || "",
          origin: "report_aziende" as ContactOrigin,
          originDetail: "Prospect",
          sourceType: st,
          sourceId: sid,
          partnerId: item.partner_id,
          linkedinUrl: prc.linkedin_url || "",
        });
      } else if (st === "contact") {
        const ic = icMap[sid];
        if (!ic) continue;
        // Resolve LinkedIn URL from enrichment_data (multiple fallbacks)
        const icEd = (ic.enrichment_data as any) || {};
        let icLinkedin = icEd.linkedin_profile_url
          || icEd.linkedin_url
          || icEd.social_links?.linkedin
          || "";
        // contact_profiles is an OBJECT keyed by ID, not an array
        if (!icLinkedin && icEd.contact_profiles && typeof icEd.contact_profiles === "object") {
          const profiles = Object.values(icEd.contact_profiles) as any[];
          const found = profiles.find((cp: any) => cp.linkedin_url);
          if (found) icLinkedin = found.linkedin_url;
        }
        // Also check partner_social_links if we have a partner_id
        const icPartnerId = item.partner_id;
        if (!icLinkedin && icPartnerId && socialLinksMap[icPartnerId]) {
          icLinkedin = socialLinksMap[icPartnerId];
        }
        const icEnrich = (ic.enrichment_data as any) || {};
        const icMeta: Partial<CockpitContact> = {};
        if (icEnrich.contact_profile?.seniority) icMeta.seniority = icEnrich.contact_profile.seniority;
        if (icEnrich.company_profile?.specialties?.length) icMeta.specialties = icEnrich.company_profile.specialties.slice(0, 4);
        result.push({
          id: `ic-${ic.id}`,
          queueId: item.id,
          name: ic.name || "—",
          company: ic.company_name || "—",
          role: ic.position || "",
          country: ic.country || "",
          language: inferLanguage(ic.country),
          lastContact: formatRelativeDate(ic.created_at),
          priority: computePriority(ic.email, ic.phone, ic.mobile),
          channels: inferChannels(ic.email, ic.phone, ic.mobile),
          email: ic.email || "",
          phone: ic.mobile || ic.phone || "",
          origin: "manual" as ContactOrigin,
          originDetail: ic.origin || "Manuale",
          sourceType: st,
          sourceId: sid,
          partnerId: item.partner_id,
          linkedinUrl: icLinkedin,
          contactAlias: ic.contact_alias || undefined,
          companyAlias: ic.company_alias || undefined,
          deepSearchAt: ic.deep_search_at || undefined,
          enrichmentData: ic.enrichment_data || undefined,
          ...icMeta,
        });
      }
    }

    // Add scheduled return activities
    for (const act of scheduledActivities) {
      const meta = (act.source_meta || {}) as any;
      const existsAlready = result.some(r => r.sourceId === act.source_id);
      if (existsAlready) continue;
      result.push({
        id: `act-${act.id}`,
        queueId: act.id,
        name: meta.name || act.title || "—",
        company: meta.company || "—",
        role: "",
        country: meta.country || "",
        language: inferLanguage(meta.country),
        lastContact: formatRelativeDate(act.created_at),
        priority: act.priority === "high" ? 8 : act.priority === "low" ? 3 : 5,
        channels: inferChannels(meta.email, null, null),
        email: meta.email || "",
        phone: meta.phone || meta.mobile || "",
        origin: "wca" as ContactOrigin,
        originDetail: `📅 Riprogrammato`,
        sourceType: act.source_type,
        sourceId: act.source_id,
        partnerId: act.partner_id,
        linkedinUrl: act.partner_id ? (socialLinksMap[act.partner_id] || "") : "",
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

/**
 * Remove contacts from cockpit_queue
 */
export function useDeleteCockpitContacts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (prefixedIds: string[]) => {
      // We need to find the queue IDs for these contacts
      // But we can also just delete by source criteria
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const sourceEntries: { type: string; id: string }[] = [];
      for (const pid of prefixedIds) {
        if (pid.startsWith("pc-")) sourceEntries.push({ type: "partner_contact", id: pid.slice(3) });
        else if (pid.startsWith("bc-")) sourceEntries.push({ type: "business_card", id: pid.slice(3) });
        else if (pid.startsWith("prc-")) sourceEntries.push({ type: "prospect_contact", id: pid.slice(4) });
        else if (pid.startsWith("ic-")) sourceEntries.push({ type: "contact", id: pid.slice(3) });
      }

      // Delete from cockpit_queue by source matches
      for (const entry of sourceEntries) {
        await supabase
          .from("cockpit_queue")
          .delete()
          .eq("user_id", user.id)
          .eq("source_type", entry.type)
          .eq("source_id", entry.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cockpit-queue"] });
    },
  });
}

/**
 * Send partner contacts to cockpit_queue
 */
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

      const { error } = await supabase.from("cockpit_queue").upsert(inserts as any, {
        onConflict: "user_id,source_type,source_id",
        ignoreDuplicates: true,
      });
      if (error) throw error;

      // Store source IDs for auto-preselection in Cockpit
      const { addCockpitPreselection } = await import("@/lib/cockpitPreselection");
      addCockpitPreselection(items.map(i => i.sourceId));

      // Auto-assign agents silently for each contact
      for (const item of items) {
        try {
          await autoAssignAgent({
            sourceId: item.sourceId,
            sourceType: item.sourceType,
            countryCode: item.countryCode || null,
            userId: user.id,
          });
        } catch (e) {
          log.warn("auto-assign failed", { sourceId: item.sourceId, message: e instanceof Error ? e.message : String(e) });
        }
      }

      return inserts.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["cockpit-queue"] });
      queryClient.invalidateQueries({ queryKey: ["client-assignments"] });
    },
  });
}
