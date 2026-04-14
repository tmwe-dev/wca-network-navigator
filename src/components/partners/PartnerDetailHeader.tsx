import type { PartnerViewModel } from "@/types/partner-views";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Star, StarOff, Phone, Mail, Globe, Brain,
} from "lucide-react";
import { getCountryFlag, formatPartnerType } from "@/lib/countries";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { getRealLogoUrl } from "@/lib/partnerUtils";
import { PARTNER_TYPE_ICONS } from "@/components/partners/shared/ServiceIcons";
import { MiniStars } from "@/components/partners/shared/MiniStars";
import { TrophyRow } from "@/components/partners/shared/TrophyRow";
import { SocialLinks } from "@/components/partners/SocialLinks";
import { Box } from "lucide-react";

 
interface PartnerDetailHeaderProps {
  partner: PartnerViewModel;
  enrichment: Record<string, unknown> | null;
  networks: { id: string; network_name: string }[];
  years: number;
  expiryDate: Date | null;
  isExpiringSoon: boolean;
  isExpired: boolean;
  onToggleFavorite: () => void;
}

export function PartnerDetailHeader({
  partner, enrichment, networks, years, expiryDate, isExpiringSoon, isExpired, onToggleFavorite,
}: PartnerDetailHeaderProps) {
  const PartnerTypeIcon = PARTNER_TYPE_ICONS[String(partner.partner_type || "")] || Box;

  return (
    <div className="bg-gradient-to-br from-primary/5 via-card to-primary/5 backdrop-blur-sm border border-primary/10 rounded-2xl p-4">
      <div className="flex items-start gap-3">
        <div className="shrink-0">
          {getRealLogoUrl(partner.logo_url as string | null) ? (
            <img
              src={getRealLogoUrl(partner.logo_url as string | null)!}
              alt={String(partner.company_name)}
              className="w-12 h-12 rounded-xl object-contain bg-muted/30 border border-border/30"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-muted/30 border border-border/30 flex items-center justify-center">
              <span className="text-2xl">{getCountryFlag(String(partner.country_code))}</span>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-foreground truncate">{String(partner.company_name)}</h2>
            {enrichment && typeof enrichment === "object" && "deep_search_at" in enrichment && enrichment.deep_search_at && (
              <Tooltip>
                <TooltipTrigger>
                  <Brain className="w-4 h-4 text-primary drop-shadow-[0_0_3px_hsl(var(--primary)/0.4)]" />
                </TooltipTrigger>
                <TooltipContent>
                  Deep Search — {format(new Date(String(enrichment.deep_search_at)), "d MMM yyyy", { locale: it })}
                </TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={onToggleFavorite}
                  className={cn("h-7 w-7 p-0 rounded-lg", partner.is_favorite && "shadow-sm shadow-primary/30")}>
                  {partner.is_favorite ? <Star className="w-4 h-4 fill-primary text-primary" /> : <StarOff className="w-4 h-4 text-muted-foreground" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{partner.is_favorite ? "Rimuovi preferiti" : "Aggiungi preferiti"}</TooltipContent>
            </Tooltip>
          </div>

          <div className="flex items-center gap-1.5 mt-1 text-xs text-foreground/80 flex-wrap">
            <span className="text-base leading-none">{getCountryFlag(String(partner.country_code))}</span>
            <span>{String(partner.country_name)}</span>
            <span className="text-muted-foreground/60">·</span>
            <span>{String(partner.city)}</span>
            <span className="text-muted-foreground/60">·</span>
            <PartnerTypeIcon className="w-3.5 h-3.5 opacity-60" strokeWidth={1.5} />
            <span>{formatPartnerType(String(partner.partner_type || ""))}</span>
            {partner.office_type && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 font-medium text-foreground/70">
                {partner.office_type === "head_office" ? "HQ" : "Branch"}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
            {Number(partner.rating || 0) > 0 && <MiniStars rating={Number(partner.rating)} size="w-3.5 h-3.5" />}
            {years > 0 && <TrophyRow years={years} />}
            {partner.wca_id && <span className="text-[10px] text-muted-foreground font-mono">#{String(partner.wca_id)}</span>}
            <span className={cn(
              "text-[10px] px-1.5 py-0.5 rounded-full border font-medium",
              isExpired ? "border-destructive/30 text-destructive" :
              isExpiringSoon ? "border-primary/30 text-primary" :
              "border-emerald-500/20 text-emerald-400"
            )}>
              {expiryDate ? `Scade ${format(expiryDate, "MM/yyyy")}` : "N/A"}
            </span>
            {networks.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-primary/20 text-foreground/70 font-medium">
                {networks.length} network
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 mt-2 text-xs flex-wrap">
            {partner.phone && (
              <a href={`tel:${String(partner.phone)}`} className="flex items-center gap-1 text-foreground/80 hover:text-foreground transition-colors">
                <Phone className="w-3 h-3" strokeWidth={1.5} /> {String(partner.phone)}
              </a>
            )}
            {partner.email && (
              <a href={`mailto:${String(partner.email)}`} className="flex items-center gap-1 text-foreground/80 hover:text-foreground transition-colors">
                <Mail className="w-3 h-3" strokeWidth={1.5} /> {String(partner.email)}
              </a>
            )}
            {partner.website && (
              <a href={String(partner.website).startsWith("http") ? String(partner.website) : `https://${String(partner.website)}`}
                target="_blank" rel="noopener"
                className="flex items-center gap-1 text-foreground/80 hover:text-foreground transition-colors">
                <Globe className="w-3 h-3" strokeWidth={1.5} /> {String(partner.website)}
              </a>
            )}
          </div>
          <div className="mt-1">
            <SocialLinks partnerId={String(partner.id)} compact />
          </div>
        </div>
      </div>
    </div>
  );
}
