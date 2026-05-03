/**
 * RecipientHeroCard — header del Compose che presenta il destinatario in modo
 * leggibile: logo azienda (o monogramma colorato), bandiera reale, nome
 * azienda grande, contatto/email, lead status, freschezza Deep Search.
 *
 * Sostituisce il chip minuscolo + il vecchio `RecipientSnapshotHeader`.
 * In modalità bulk (>1 destinatario) mostra una versione compatta con conteggio.
 */
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Building2, MapPin, Sparkles, X, Mail, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getCountryFlag } from "@/lib/countries";
import { cn } from "@/lib/utils";
import type { SelectedRecipient } from "@/contexts/MissionContext";

interface PartnerSnapshot {
  company_name: string | null;
  company_alias: string | null;
  country_name: string | null;
  country_code: string | null;
  city: string | null;
  logo_url: string | null;
  last_interaction_at: string | null;
  interaction_count: number | null;
  enrichment_data: { deep_search_at?: string } | null;
  lead_status: string | null;
}

interface RecipientHeroCardProps {
  readonly recipients: ReadonlyArray<SelectedRecipient>;
  readonly manualEmail: string;
  readonly onManualEmailChange: (v: string) => void;
  readonly onAddManualEmail: () => void;
  readonly onRemoveRecipient: (idx: number) => void;
}

function relTime(iso: string | null): string {
  if (!iso) return "mai";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return "oggi";
  if (days === 1) return "ieri";
  if (days < 30) return `${days}g fa`;
  if (days < 365) return `${Math.floor(days / 30)} mesi fa`;
  return `${Math.floor(days / 365)}a fa`;
}

function deepSearchTone(at: string | undefined | null): { label: string; tone: "fresh" | "stale" | "missing" } {
  if (!at) return { label: "no Deep Search", tone: "missing" };
  const days = Math.floor((Date.now() - new Date(at).getTime()) / 86_400_000);
  if (days <= 30) return { label: `Deep Search ${days}g`, tone: "fresh" };
  return { label: `Deep Search ${days}g (vecchia)`, tone: "stale" };
}

function monogramHue(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return h;
}

function CompanyAvatar({ logoUrl, companyName }: { logoUrl: string | null; companyName: string }) {
  const [errored, setErrored] = React.useState(false);
  if (logoUrl && !errored) {
    return (
      <img
        src={logoUrl}
        alt={companyName}
        onError={() => setErrored(true)}
        className="h-12 w-12 rounded-lg object-contain bg-card border border-border/50 shrink-0"
      />
    );
  }
  const initials = companyName
    .replace(/["'`]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";
  const hue = monogramHue(companyName);
  return (
    <div
      className="h-12 w-12 rounded-lg flex items-center justify-center font-bold text-sm text-white shrink-0 border border-border/50"
      style={{ backgroundColor: `hsl(${hue} 55% 42%)` }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}

function ManualEmailField(props: Pick<RecipientHeroCardProps, "manualEmail" | "onManualEmailChange" | "onAddManualEmail"> & { isFirst: boolean }) {
  const { manualEmail, onManualEmailChange, onAddManualEmail, isFirst } = props;
  return (
    <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md border border-dashed border-border/50 bg-muted/20">
      <Plus className="h-3 w-3 text-muted-foreground shrink-0" />
      <input
        type="email"
        value={manualEmail}
        onChange={(e) => onManualEmailChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            onAddManualEmail();
          }
        }}
        onBlur={() => { if (manualEmail.trim()) onAddManualEmail(); }}
        placeholder={isFirst ? "Aggiungi email destinatario…" : "Aggiungi un altro destinatario…"}
        className="flex-1 min-w-[160px] text-xs bg-transparent outline-none placeholder:text-muted-foreground/60 h-5"
      />
    </div>
  );
}

export function RecipientHeroCard({
  recipients,
  manualEmail,
  onManualEmailChange,
  onAddManualEmail,
  onRemoveRecipient,
}: RecipientHeroCardProps): React.ReactElement {
  const single = recipients.length === 1 ? recipients[0] : null;
  const partnerId = single?.partnerId && single.partnerId.length === 36 && single.isEnriched ? single.partnerId : null;

  const { data } = useQuery({
    queryKey: ["compose-recipient-hero", partnerId],
    queryFn: async (): Promise<PartnerSnapshot | null> => {
      if (!partnerId) return null;
      const { data: row } = await supabase
        .from("partners")
        .select("company_name, company_alias, country_name, country_code, city, logo_url, last_interaction_at, interaction_count, enrichment_data, lead_status")
        .eq("id", partnerId)
        .maybeSingle();
      return (row as unknown as PartnerSnapshot) ?? null;
    },
    enabled: !!partnerId,
    staleTime: 30_000,
  });

  // Empty state
  if (recipients.length === 0) {
    return (
      <div className="mb-2 flex items-center gap-2 px-2 py-1 rounded-md border border-dashed border-border/50 bg-muted/10">
        <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground shrink-0">
          Nessun destinatario
        </span>
        <div className="flex-1 min-w-0">
          <ManualEmailField
            manualEmail={manualEmail}
            onManualEmailChange={onManualEmailChange}
            onAddManualEmail={onAddManualEmail}
            isFirst
          />
        </div>
      </div>
    );
  }

  // Bulk mode
  if (recipients.length > 1) {
    return (
      <div className="mb-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Modalità bulk</span>
            <Badge variant="secondary" className="text-[10px]">{recipients.length} destinatari</Badge>
          </div>
          <ManualEmailField
            manualEmail={manualEmail}
            onManualEmailChange={onManualEmailChange}
            onAddManualEmail={onAddManualEmail}
            isFirst={false}
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {recipients.map((r, i) => (
            <Badge key={i} variant="outline" className="gap-1 pl-1.5 pr-1 py-0.5 text-[10px] font-normal">
              <span className="text-sm leading-none">{getCountryFlag(r.countryCode || "")}</span>
              <span className="truncate max-w-[180px]">
                {r.companyAlias || r.companyName}
              </span>
              <button
                onClick={() => onRemoveRecipient(i)}
                className="ml-0.5 p-0.5 rounded-full hover:bg-destructive/10"
                aria-label="Rimuovi"
              >
                <X className="w-2.5 h-2.5 text-muted-foreground hover:text-destructive" />
              </button>
            </Badge>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground italic">
          Snapshot disabilitato in bulk. La generazione AI userà tipo/tono/brief impostati nella sidebar filtri.
        </p>
      </div>
    );
  }

  // Single recipient → hero card
  const r = single!;
  const company = data?.company_alias || r.companyAlias || data?.company_name || r.companyName || "Destinatario";
  const contactName = r.contactAlias || r.contactName || "";
  const email = r.email || "";
  const countryCode = data?.country_code || r.countryCode || "";
  const countryName = data?.country_name || r.countryName || "";
  const city = data?.city || r.city || "";
  const ds = deepSearchTone(data?.enrichment_data?.deep_search_at);

  return (
    <div className="mb-3 rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 to-card px-4 py-3 shadow-sm">
      <div className="flex items-start gap-3">
        <CompanyAvatar logoUrl={data?.logo_url ?? null} companyName={company} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-bold text-foreground truncate">{company}</h2>
            {countryCode && (
              <span className="text-lg leading-none" title={countryName} aria-label={countryName}>
                {getCountryFlag(countryCode)}
              </span>
            )}
            {countryName && (
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {city ? `${city}, ${countryName}` : countryName}
              </span>
            )}
          </div>

          {(contactName || email) && (
            <div className="mt-1 flex items-center gap-2 text-xs text-foreground/80 flex-wrap">
              {contactName && <span className="font-medium">{contactName}</span>}
              {email && (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <Mail className="h-3 w-3" />
                  <span className="font-mono">{email}</span>
                </span>
              )}
            </div>
          )}

          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            {data?.lead_status && (
              <Badge variant="outline" className="h-5 text-[10px] px-1.5 capitalize">
                {data.lead_status.replace(/_/g, " ")}
              </Badge>
            )}
            {data && (
              <Badge variant="secondary" className="h-5 text-[10px] px-1.5">
                {data.interaction_count && data.interaction_count > 0
                  ? `${data.interaction_count} interaz · ${relTime(data.last_interaction_at)}`
                  : "primo contatto"}
              </Badge>
            )}
            <Badge
              variant={ds.tone === "fresh" ? "default" : ds.tone === "stale" ? "secondary" : "outline"}
              className={cn(
                "h-5 text-[10px] px-1.5",
                ds.tone === "missing" && "border-dashed text-muted-foreground",
              )}
            >
              {ds.label}
            </Badge>
            {!r.isEnriched && (
              <Badge variant="outline" className="h-5 text-[10px] px-1.5 border-warning/40 text-warning">
                non ancora nel CRM
              </Badge>
            )}
          </div>
        </div>

        <button
          onClick={() => onRemoveRecipient(0)}
          className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
          aria-label="Rimuovi destinatario"
          title="Rimuovi destinatario"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3">
        <ManualEmailField
          manualEmail={manualEmail}
          onManualEmailChange={onManualEmailChange}
          onAddManualEmail={onAddManualEmail}
          isFirst={false}
        />
      </div>
    </div>
  );
}
