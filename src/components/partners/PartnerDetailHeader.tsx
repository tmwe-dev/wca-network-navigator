import type { PartnerViewModel } from "@/types/partner-views";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Star, StarOff, Phone, Mail, Globe, Plane, Box } from "lucide-react";
import { isInHoldingPattern } from "@/constants/holdingPattern";
import { formatPartnerType, getCountryFlag } from "@/lib/countries";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { getPartnerDisplayCity } from "@/lib/partnerUtils";
import { PARTNER_TYPE_ICONS } from "@/components/partners/shared/ServiceIcons";
import { SocialLinks } from "@/components/partners/SocialLinks";
import { EnrichmentInsightStrip } from "@/components/partners/EnrichmentInsightStrip";

interface PartnerDetailHeaderProps {
  partner: PartnerViewModel;
  enrichment: Record<string, unknown> | null;
  networks: { id: string; network_name: string }[];
  services: { service_category: string }[];
  branchCountries: { code: string; name: string }[];
  years: number;
  expiryDate: Date | null;
  isExpiringSoon: boolean;
  isExpired: boolean;
  onToggleFavorite: () => void;
}

/** Link contatto ridotto alla sola icona (tooltip con il valore completo). */
function ContactIcon({
  href,
  label,
  icon: Icon,
  external,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  external?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <a
          href={href}
          {...(external ? { target: "_blank", rel: "noopener" } : {})}
          aria-label={label}
          className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-primary/20 bg-card/70 text-primary hover:bg-primary/10 hover:border-primary/40 transition-colors"
        >
          <Icon className="w-4 h-4" strokeWidth={1.6} />
        </a>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function PartnerDetailHeader({
  partner,
  enrichment,
  networks,
  services,
  branchCountries,
  years,
  expiryDate,
  isExpiringSoon,
  isExpired,
  onToggleFavorite,
}: PartnerDetailHeaderProps) {
  const PartnerTypeIcon = PARTNER_TYPE_ICONS[String(partner.partner_type || "")] || Box;
  const inHolding = isInHoldingPattern(partner.lead_status as string | null | undefined);
  const displayCity = getPartnerDisplayCity(partner);
  void years;

  // Le icone servizi comprendono anche i servizi emersi dall'arricchimento,
  // così non spariscono quando `partner_services` è vuoto.

  return (
    <div className="bg-gradient-to-br from-primary/5 via-card to-primary/5 backdrop-blur-sm border border-primary/10 rounded-2xl p-3">
      {/* Riga 1 — tipologia + geografia sotto, preferiti a destra */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 text-sm text-foreground flex-wrap">
            <PartnerTypeIcon className="w-4 h-4 opacity-60" strokeWidth={1.5} />
            <span>{formatPartnerType(String(partner.partner_type || ""))}</span>
            {partner.office_type && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 font-medium text-foreground">
                {partner.office_type === "head_office" ? "HQ" : "Branch"}
              </span>
            )}
            {networks.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full border border-primary/20 text-foreground font-medium">
                {networks.length} network
              </span>
            )}
            {inHolding && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30 font-medium">
                    <Plane className="w-3.5 h-3.5" /> In attesa
                  </span>
                </TooltipTrigger>
                <TooltipContent>Azienda nel circuito di attesa ({String(partner.lead_status)})</TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* Riga 2 — bandiera + paese · città · #WCA, subito sotto la tipologia */}
          <div className="flex items-center gap-2 text-sm">
            {partner.country_code && (
              <span className="text-base leading-none">{getCountryFlag(String(partner.country_code))}</span>
            )}
            <span className="text-foreground">{String(partner.country_name || "")}</span>
            {displayCity && <span className="text-primary">{displayCity}</span>}
            {partner.wca_id && (
              <span className="text-xs text-muted-foreground font-mono">#{String(partner.wca_id)}</span>
            )}
          </div>

          {/* Le icone servizi sono mostrate nella testata, sotto il nome azienda. */}

        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleFavorite}
                className={cn("h-8 w-8 p-0 rounded-lg", partner.is_favorite && "shadow-sm shadow-primary/30")}
              >
                {partner.is_favorite ? (
                  <Star className="w-5 h-5 fill-primary text-primary" />
                ) : (
                  <StarOff className="w-5 h-5 text-muted-foreground" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{partner.is_favorite ? "Rimuovi preferiti" : "Aggiungi preferiti"}</TooltipContent>
          </Tooltip>
        </div>
      </div>


      {/* Riga 3 — contatti come sole icone, tutti sulla stessa riga */}
      <div className="flex items-center gap-2 mt-3">
        {partner.phone && (
          <ContactIcon href={`tel:${String(partner.phone)}`} label={String(partner.phone)} icon={Phone} />
        )}
        {partner.email && (
          <ContactIcon href={`mailto:${String(partner.email)}`} label={String(partner.email)} icon={Mail} />
        )}
        {partner.website && (
          <ContactIcon
            href={
              String(partner.website).startsWith("http") ? String(partner.website) : `https://${String(partner.website)}`
            }
            label={String(partner.website)}
            icon={Globe}
            external
          />
        )}
        <SocialLinks partnerId={String(partner.id)} compact />
      </div>

      <EnrichmentInsightStrip
        partner={partner}
        enrichment={enrichment}
        services={services}
        branchCountries={branchCountries}
        networks={networks}
        showServiceIcons={false}
      />

      {/* Riga finale — scadenza WCA in basso a destra */}
      <div className="flex justify-end mt-3">
        <span
          className={cn(
            "text-xs px-2 py-0.5 rounded-full border font-medium",
            isExpired
              ? "border-destructive/30 text-destructive"
              : isExpiringSoon
                ? "border-primary/30 text-primary"
                : "border-emerald-500/20 text-emerald-400",
          )}
        >
          {expiryDate ? `Scade ${format(expiryDate, "MM/yyyy")}` : "Scadenza N/A"}
        </span>
      </div>
    </div>
  );
}
