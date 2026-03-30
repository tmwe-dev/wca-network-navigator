import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import type { ContactOrigin } from "@/pages/Cockpit";

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
  origin: ContactOrigin;
  originDetail: string;
  sourceType: string;
  sourceId: string;
  partnerId: string | null;
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
      const pcIds = queue.filter((q: any) => q.source_type === "partner_contact").map((q: any) => q.source_id);
      const bcIds = queue.filter((q: any) => q.source_type === "business_card").map((q: any) => q.source_id);
      const prcIds = queue.filter((q: any) => q.source_type === "prospect_contact").map((q: any) => q.source_id);

      // Fetch source data in parallel
      const [pcData, bcData, prcData] = await Promise.all([
        pcIds.length > 0
          ? supabase.from("partner_contacts").select("id, name, title, email, direct_phone, mobile, partner_id").in("id", pcIds).then(r => r.data || [])
          : Promise.resolve([]),
        bcIds.length > 0
          ? supabase.from("business_cards").select("id, contact_name, company_name, position, email, phone, mobile, event_name, met_at, created_at").in("id", bcIds).then(r => r.data || [])
          : Promise.resolve([]),
        prcIds.length > 0
          ? supabase.from("prospect_contacts").select("id, name, role, email, phone, prospect_id").in("id", prcIds).then(r => r.data || [])
          : Promise.resolve([]),
      ]);

      // Also fetch partner names for partner_contacts
      const partnerIds = [
        ...queue.filter((q: any) => q.partner_id).map((q: any) => q.partner_id),
        ...(pcData as any[]).filter((c: any) => c.partner_id).map((c: any) => c.partner_id),
      ];
      const uniquePartnerIds = [...new Set(partnerIds)];
      let partnersMap: Record<string, any> = {};
      if (uniquePartnerIds.length > 0) {
        const { data: pData } = await supabase.from("partners").select("id, company_name, country_code").in("id", uniquePartnerIds);
        for (const p of pData || []) partnersMap[p.id] = p;
      }

      // Build lookup maps
      const pcMap: Record<string, any> = {};
      for (const c of pcData as any[]) pcMap[c.id] = c;
      const bcMap: Record<string, any> = {};
      for (const c of bcData as any[]) bcMap[c.id] = c;
      const prcMap: Record<string, any> = {};
      for (const c of prcData as any[]) prcMap[c.id] = c;

      return { queue, pcMap, bcMap, prcMap, partnersMap };
    },
    staleTime: 30_000,
  });

  const contacts = useMemo<CockpitContact[]>(() => {
    if (!q.data || Array.isArray(q.data)) return [];
    const { queue, pcMap, bcMap, prcMap, partnersMap } = q.data;
    const result: CockpitContact[] = [];

    for (const item of queue) {
      const st = item.source_type;
      const sid = item.source_id;

      if (st === "partner_contact") {
        const pc = pcMap[sid];
        if (!pc) continue;
        const partner = partnersMap[pc.partner_id] || partnersMap[item.partner_id];
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
          origin: "wca" as ContactOrigin,
          originDetail: partner?.company_name || "Partner",
          sourceType: st,
          sourceId: sid,
          partnerId: pc.partner_id || item.partner_id,
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
          origin: "import" as ContactOrigin,
          originDetail: bc.event_name ? `BCA · ${bc.event_name}` : "Biglietto da visita",
          sourceType: st,
          sourceId: sid,
          partnerId: item.partner_id,
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
          origin: "report_aziende" as ContactOrigin,
          originDetail: "Prospect",
          sourceType: st,
          sourceId: sid,
          partnerId: item.partner_id,
        });
      }
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
    mutationFn: async (items: { sourceType: string; sourceId: string; partnerId?: string }[]) => {
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
      return inserts.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["cockpit-queue"] });
    },
  });
}
