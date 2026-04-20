/**
 * RecipientSnapshotHeader — Inline snapshot of single recipient in composer header.
 * Shows: company, country, last interaction, deep search freshness.
 * Hidden when 0 or >1 recipients (bulk mode).
 */
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Building2, MapPin, Clock, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface RecipientSnapshotHeaderProps {
  readonly partnerId: string | null;
  readonly recipientCount: number;
  readonly fallbackCompany?: string;
  readonly fallbackCountry?: string;
}

interface PartnerSnapshot {
  company_name: string | null;
  company_alias: string | null;
  country_name: string | null;
  city: string | null;
  last_interaction_at: string | null;
  interaction_count: number | null;
  enrichment_data: { deep_search_at?: string } | null;
  lead_status: string | null;
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "mai";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days < 1) return "oggi";
  if (days === 1) return "1 giorno fa";
  if (days < 30) return `${days} giorni fa`;
  if (days < 365) return `${Math.floor(days / 30)} mesi fa`;
  return `${Math.floor(days / 365)} anni fa`;
}

function deepSearchBadge(deepSearchAt: string | undefined | null): { label: string; tone: "fresh" | "stale" | "missing" } {
  if (!deepSearchAt) return { label: "no Deep Search", tone: "missing" };
  const days = Math.floor((Date.now() - new Date(deepSearchAt).getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 30) return { label: `Deep Search ${days}g`, tone: "fresh" };
  return { label: `Deep Search ${days}g (stale)`, tone: "stale" };
}

export function RecipientSnapshotHeader({
  partnerId, recipientCount, fallbackCompany, fallbackCountry,
}: RecipientSnapshotHeaderProps): React.ReactElement | null {
  const { data, isLoading } = useQuery({
    queryKey: ["composer-snapshot", partnerId],
    queryFn: async (): Promise<PartnerSnapshot | null> => {
      if (!partnerId) return null;
      const { data: row } = await supabase
        .from("partners")
        .select("company_name, company_alias, country_name, city, last_interaction_at, interaction_count, enrichment_data, lead_status")
        .eq("id", partnerId)
        .maybeSingle();
      return (row as unknown as PartnerSnapshot) ?? null;
    },
    enabled: !!partnerId && recipientCount === 1,
    staleTime: 30_000,
  });

  // Hidden in bulk mode or empty
  if (recipientCount === 0) return null;
  if (recipientCount > 1) {
    return (
      <div className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded-md bg-muted/30 border border-border/30 text-xs">
        <Sparkles className="w-3 h-3 text-primary" />
        <span className="text-muted-foreground">
          Modalità bulk: <strong className="text-foreground">{recipientCount}</strong> destinatari — snapshot disabilitato
        </span>
      </div>
    );
  }

  const company = data?.company_alias || data?.company_name || fallbackCompany || "Destinatario";
  const country = data?.country_name || fallbackCountry || "";
  const ds = deepSearchBadge(data?.enrichment_data?.deep_search_at);

  return (
    <div className="flex items-center gap-3 flex-wrap mb-2 px-3 py-2 rounded-md bg-primary/5 border border-primary/20 text-xs">
      <div className="flex items-center gap-1.5 font-medium text-foreground">
        <Building2 className="w-3.5 h-3.5 text-primary" />
        {company}
      </div>
      {country && (
        <div className="flex items-center gap-1 text-muted-foreground">
          <MapPin className="w-3 h-3" />
          {country}
        </div>
      )}
      {data && (
        <>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="w-3 h-3" />
            {data.interaction_count && data.interaction_count > 0
              ? `${data.interaction_count} interazioni · ultima ${formatRelativeTime(data.last_interaction_at)}`
              : "nessuna interazione precedente"}
          </div>
          <Badge
            variant={ds.tone === "fresh" ? "default" : ds.tone === "stale" ? "secondary" : "outline"}
            className="h-5 text-[10px] px-1.5"
          >
            {ds.label}
          </Badge>
          {data.lead_status && (
            <Badge variant="outline" className="h-5 text-[10px] px-1.5 capitalize">
              {data.lead_status.replace(/_/g, " ")}
            </Badge>
          )}
        </>
      )}
      {isLoading && <span className="text-muted-foreground italic">caricamento contesto…</span>}
    </div>
  );
}
