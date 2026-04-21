/**
 * usePreContext (LOVABLE-83) — sintetizza un PreGenerationContext
 * dai dati partner/recipient correnti per alimentare <ContextSummary>.
 * Read-only: non muta nulla, solo aggrega ciò che il backend troverà.
 */
import * as React from "react";
import { useUnifiedEnrichmentSnapshot } from "@/hooks/useUnifiedEnrichmentSnapshot";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import type { ForgeRecipient } from "../ForgeRecipientPicker";
import type { PreGenerationContext } from "../components/ContextSummary";
import type { ResolvedEmailType } from "../types/contract";

interface RelationshipSnap {
  touch_count: number;
  has_replied: boolean;
  days_since_last: number | null;
  last_channel: string | null;
  partner_status: string;
  partner_country: string | null;
}

function useRelationshipSnap(partnerId: string | null | undefined) {
  return useQuery({
    queryKey: ["pre-context-relationship", partnerId],
    enabled: !!partnerId,
    staleTime: 30_000,
    queryFn: async (): Promise<RelationshipSnap> => {
      if (!partnerId) throw new Error("partnerId required");
      const [{ data: partner }, { data: messages, count }] = await Promise.all([
        supabase.from("partners").select("lead_status, country").eq("id", partnerId).maybeSingle(),
        supabase
          .from("channel_messages")
          .select("direction, channel, created_at", { count: "exact" })
          .eq("partner_id", partnerId)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);
      const list = (messages ?? []) as Array<{ direction: string; channel: string | null; created_at: string }>;
      const last = list[0];
      const inbound = list.filter((m) => m.direction === "inbound");
      const days = last ? Math.floor((Date.now() - new Date(last.created_at).getTime()) / 86400000) : null;
      const p = partner as { lead_status?: string; country?: string | null } | null;
      return {
        touch_count: count ?? 0,
        has_replied: inbound.length > 0,
        days_since_last: days,
        last_channel: last?.channel ?? null,
        partner_status: p?.lead_status ?? "new",
        partner_country: p?.country ?? null,
      };
    },
  });
}

export function usePreContext(
  recipient: ForgeRecipient | null,
  opts: {
    typeResolution?: ResolvedEmailType | null;
    kbCategories?: string[] | null;
    language?: string;
    tone?: string;
  } = {},
): PreGenerationContext | undefined {
  const partnerId = recipient?.partnerId ?? null;
  const { data: enrich } = useUnifiedEnrichmentSnapshot(partnerId);
  const { data: rel } = useRelationshipSnap(partnerId);

  return React.useMemo(() => {
    if (!recipient) return undefined;
    return {
      partner: {
        name: recipient.companyName ?? "",
        status: rel?.partner_status ?? "new",
        country: rel?.partner_country ?? recipient.countryName ?? recipient.countryCode ?? null,
      },
      contact: recipient.contactName ? { name: recipient.contactName } : undefined,
      relationship: {
        touch_count: rel?.touch_count ?? 0,
        has_replied: rel?.has_replied ?? false,
        days_since_last: rel?.days_since_last ?? null,
        last_channel: rel?.last_channel ?? null,
      },
      enrichment: {
        base: enrich?.base.available ?? false,
        deep_search: enrich?.deep.available ?? false,
        sherlock: enrich?.sherlock.available ?? false,
      },
      kb: {
        sections_available: opts.kbCategories ?? [],
      },
      memory: { count: 0 },
      style: {
        language: opts.language ?? "italiano",
        tone: opts.tone,
      },
      type_resolution: opts.typeResolution ?? null,
    };
  }, [recipient, rel, enrich, opts.typeResolution, opts.kbCategories, opts.language, opts.tone]);
}