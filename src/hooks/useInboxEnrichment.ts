/**
 * useInboxEnrichment — arricchisce i messaggi della Inbox con
 * partner_snapshot (logo, country, lead_status, città) e sender_intel
 * (dominio noto / partner_id desunto), riusando lo stesso modello di
 * Funnemail. Best-effort: in caso di errore restituisce mappe vuote.
 *
 * Lettura sola, nessun side-effect.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ChannelMessage } from "@/hooks/useChannelMessages";
import {
  listPartnerSnapshotsByIds,
  listSenderIntelByDomains,
  type FunnemailPartnerSnapshot,
  type SenderIntelRow,
} from "@/data/funnemailInbox";
import { findAiSuggestedGroupsForEmails } from "@/data/emailAddressRules";

function extractEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = raw.match(/<([^>]+)>/);
  const addr = (m ? m[1] : raw).trim().toLowerCase();
  return addr || null;
}

function extractDomain(raw: string | null | undefined): string | null {
  const a = extractEmail(raw);
  if (!a) return null;
  const d = a.split("@")[1];
  return d ?? null;
}

export interface InboxEnrichment {
  partner: FunnemailPartnerSnapshot | null;
  intel: SenderIntelRow | null;
  aiSuggestedGroup: string | null;
}

export function useInboxEnrichment(messages: ChannelMessage[]) {
  const partnerIds = useMemo(
    () => Array.from(new Set(messages.map((m) => m.partner_id).filter((v): v is string => Boolean(v)))),
    [messages],
  );

  const domains = useMemo(
    () =>
      Array.from(new Set(messages.map((m) => extractDomain(m.from_address)).filter((v): v is string => Boolean(v)))),
    [messages],
  );

  const addresses = useMemo(
    () => Array.from(new Set(messages.map((m) => extractEmail(m.from_address)).filter((v): v is string => Boolean(v)))),
    [messages],
  );

  const partnersQ = useQuery({
    queryKey: ["inbox-enrichment", "partners", partnerIds.join(",")],
    enabled: partnerIds.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<FunnemailPartnerSnapshot[]> => {
      return listPartnerSnapshotsByIds(partnerIds);
    },
  });

  const intelQ = useQuery({
    queryKey: ["inbox-enrichment", "intel", domains.join(",")],
    enabled: domains.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<SenderIntelRow[]> => {
      return listSenderIntelByDomains(domains);
    },
  });

  // Per partner suggerito da intel non ancora caricato
  const intelPartnerIds = useMemo(
    () =>
      Array.from(
        new Set(
          (intelQ.data ?? [])
            .map((r) => r.partner_id)
            .filter((v): v is string => Boolean(v))
            .filter((id) => !partnerIds.includes(id)),
        ),
      ),
    [intelQ.data, partnerIds],
  );

  const intelPartnersQ = useQuery({
    queryKey: ["inbox-enrichment", "intel-partners", intelPartnerIds.join(",")],
    enabled: intelPartnerIds.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<FunnemailPartnerSnapshot[]> => {
      return listPartnerSnapshotsByIds(intelPartnerIds);
    },
  });

  const suggestionsQ = useQuery({
    queryKey: ["inbox-enrichment", "ai-suggestions", addresses.join(",")],
    enabled: addresses.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<Array<{ email_address: string; ai_suggested_group: string | null }>> => {
      return findAiSuggestedGroupsForEmails(addresses);
    },
  });

  const partnersById = useMemo(() => {
    const map = new Map<string, FunnemailPartnerSnapshot>();
    (partnersQ.data ?? []).forEach((p) => map.set(p.id, p));
    (intelPartnersQ.data ?? []).forEach((p) => {
      if (!map.has(p.id)) map.set(p.id, p);
    });
    return map;
  }, [partnersQ.data, intelPartnersQ.data]);

  const intelByDomain = useMemo(() => {
    const map = new Map<string, SenderIntelRow>();
    (intelQ.data ?? []).forEach((r) => map.set(r.email_domain, r));
    return map;
  }, [intelQ.data]);

  const suggestionByAddress = useMemo(() => {
    const map = new Map<string, string>();
    (suggestionsQ.data ?? []).forEach((r) => {
      const k = (r.email_address || "").toLowerCase();
      if (k && r.ai_suggested_group) map.set(k, r.ai_suggested_group);
    });
    return map;
  }, [suggestionsQ.data]);

  function getEnrichment(msg: ChannelMessage): InboxEnrichment {
    const domain = extractDomain(msg.from_address);
    const addr = extractEmail(msg.from_address);
    const intel = domain ? (intelByDomain.get(domain) ?? null) : null;
    let partner: FunnemailPartnerSnapshot | null = null;
    if (msg.partner_id) partner = partnersById.get(msg.partner_id) ?? null;
    if (!partner && intel?.partner_id) partner = partnersById.get(intel.partner_id) ?? null;
    const aiSuggestedGroup = addr ? (suggestionByAddress.get(addr) ?? null) : null;
    return { partner, intel, aiSuggestedGroup };
  }

  return { getEnrichment };
}
