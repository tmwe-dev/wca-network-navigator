import { useState } from "react";
import type { PartnerViewModel, EnrichmentData } from "@/types/partner-views";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Star, StarOff, Phone, Mail, Globe, MapPin, MessageCircle, UserCheck, UserX, AlertTriangle } from "lucide-react";
import {
  getCountryFlag,
  getYearsMember,
  formatPartnerType,
  formatServiceCategory,
  getServiceColor,
} from "@/lib/countries";
import { cn } from "@/lib/utils";
import { getPartnerContactQuality } from "@/hooks/useContactCompleteness";
import { OptimizedImage } from "@/components/shared/OptimizedImage";
function cleanPhoneForWhatsApp(phone: string): string {
  return phone.replace(/[\s\-\(\)\+]/g, "").replace(/^00/, "");
}

function getMemberBadgeColor(years: number): string {
  if (years >= 10) return "bg-emerald-700 text-white dark:bg-emerald-800";
  if (years >= 5) return "bg-emerald-500 text-white dark:bg-emerald-600";
  if (years >= 2) return "bg-primary text-primary-foreground";
  return "bg-muted text-muted-foreground";
}

interface PartnerCardProps {
  partner: PartnerViewModel;
  onToggleFavorite: (id: string, isFavorite: boolean) => void;
}

export default function PartnerCard({ partner, onToggleFavorite }: PartnerCardProps) {
  const [logoError, setLogoError] = useState(false);
  const [faviconError, setFaviconError] = useState(false);
  const hasWebsite = !!partner.website;
  const yearsM = partner.member_since ? getYearsMember(partner.member_since) : null;
  const whatsappNumber = partner.mobile || partner.phone;
  const domain = hasWebsite
    ? partner.website.replace(/^https?:\/\//, "").replace(/\/.*$/, "")
    : null;

  return (
    <Card
      className={cn(
        "group hover:shadow-lg transition-all relative",
        hasWebsite
          ? "border-l-2 border-l-emerald-500/60"
          : "border-l-2 border-l-destructive/40"
      )}
    >
      <CardContent className="p-4">
        {/* Office type badge */}
        {partner.office_type && (
          <span className="absolute top-2 right-2 text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase tracking-wider">
            {partner.office_type === "head_office" ? "HQ" : "Branch"}
          </span>
        )}

        {/* Header: logo + info */}
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-11 h-11 rounded-lg bg-muted/50 border flex items-center justify-center overflow-hidden">
            {partner.logo_url && !logoError ? (
              <OptimizedImage src={partner.logo_url} alt="" className="w-8 h-8 object-contain" onError={() => setLogoError(true)} />
            ) : hasWebsite && !faviconError ? (
              <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`} alt="" className="w-8 h-8 object-contain" onError={() => setFaviconError(true)} />
            ) : (
              <span className="text-2xl">{getCountryFlag(partner.country_code)}</span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <Link to={`/partners/${partner.id}`} className="text-sm font-semibold hover:text-primary transition-colors truncate block">
                {partner.company_name}
              </Link>
              {partner.company_alias && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 shrink-0">{partner.company_alias}</span>}
              <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" aria-label="Preferito" onClick={() => onToggleFavorite(partner.id, !partner.is_favorite)}>
                {partner.is_favorite ? (
                  <Star className="w-3.5 h-3.5 fill-primary text-primary" />
                ) : (
                  <StarOff className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </Button>
            </div>

            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{partner.city}, {partner.country_name}</span>
              <span className="text-base ml-0.5">{getCountryFlag(partner.country_code)}</span>
            </div>

            {/* Rating */}
            {partner.rating != null && partner.rating > 0 && (
              <div className="flex items-center gap-0.5 mt-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={cn(
                      "w-3 h-3",
                      i < Math.round(partner.rating)
                        ? "fill-primary text-primary"
                        : "text-muted-foreground/50"
                    )}
                  />
                ))}
                <span className="text-[10px] text-muted-foreground ml-1">{partner.rating.toFixed(1)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Badges row */}
        <div className="flex flex-wrap items-center gap-1.5 mt-3">
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {formatPartnerType(partner.partner_type)}
          </Badge>
          {yearsM != null && (
            <span className={cn("text-[10px] px-1.5 py-0.5 rounded", getMemberBadgeColor(yearsM))}>
              {yearsM} yrs
            </span>
          )}
          {!!(partner.enrichment_data as Record<string, unknown>)?.deep_search_at && (
            <Tooltip>
              <TooltipTrigger>
                <span className="w-5 h-5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm">D</span>
              </TooltipTrigger>
              <TooltipContent>Deep Search – {new Date(String((partner.enrichment_data as Record<string, any>).deep_search_at)).toLocaleDateString("it-IT")}</TooltipContent>
            </Tooltip>
          )}
          {(() => {
            const quality = getPartnerContactQuality(partner.partner_contacts);
            if (quality === "complete") return (
              <Tooltip>
                <TooltipTrigger>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 flex items-center gap-0.5">
                    <UserCheck className="w-3 h-3" /> Contatti OK
                  </span>
                </TooltipTrigger>
                <TooltipContent>Ha email e telefono personale del responsabile</TooltipContent>
              </Tooltip>
            );
            if (quality === "partial") return (
              <Tooltip>
                <TooltipTrigger>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary flex items-center gap-0.5">
                    <AlertTriangle className="w-3 h-3" /> Parziale
                  </span>
                </TooltipTrigger>
                <TooltipContent>Manca email o telefono personale</TooltipContent>
              </Tooltip>
            );
            return (
              <Tooltip>
                <TooltipTrigger>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive flex items-center gap-0.5">
                    <UserX className="w-3 h-3" /> No contatti
                  </span>
                </TooltipTrigger>
                <TooltipContent>Nessuna email o telefono personale del responsabile</TooltipContent>
              </Tooltip>
            );
          })()}
        </div>

        {/* Services */}
        {partner.partner_services?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {partner.partner_services.slice(0, 4).map((s: { service_category: string }, i: number) => (
              <Tooltip key={i}>
                <TooltipTrigger>
                  <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-medium", getServiceColor(s.service_category))}>
                    {formatServiceCategory(s.service_category)}
                  </span>
                </TooltipTrigger>
                <TooltipContent>{formatServiceCategory(s.service_category)}</TooltipContent>
              </Tooltip>
            ))}
            {partner.partner_services.length > 4 && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                +{partner.partner_services.length - 4}
              </span>
            )}
          </div>
        )}

        {/* Networks */}
        {partner.partner_networks?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {partner.partner_networks.slice(0, 3).map((n: { id?: string; network_name: string; expires?: string }) => (
              <Tooltip key={n.id || n.network_name}>
                <TooltipTrigger>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium truncate max-w-[100px] inline-block">
                    {n.network_name}
                  </span>
                </TooltipTrigger>
                <TooltipContent>{n.network_name}{n.expires ? ` — Scade ${new Date(n.expires).toLocaleDateString("it-IT")}` : ""}</TooltipContent>
              </Tooltip>
            ))}
            {partner.partner_networks.length > 3 && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                +{partner.partner_networks.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Primary contact info */}
        {(() => {
          const contacts = partner.partner_contacts || [];
          const primary = contacts.find((c: Record<string, any>) => c.is_primary) || contacts[0];
          if (!primary) return (
            <div className="mt-3 pt-2 border-t">
              <span className="text-xs text-destructive font-medium">Nessun contatto personale</span>
            </div>
          );
          return (
            <div className="mt-3 pt-2 border-t space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs">
                <UserCheck className="w-3 h-3 text-muted-foreground shrink-0" />
                <span className="font-semibold text-foreground truncate">{primary.contact_alias || primary.name}</span>
                {primary.title && <span className="text-[10px] text-muted-foreground">· {primary.title}</span>}
              </div>
              {primary.email && (
                <div className="flex items-center gap-1.5 text-xs ml-4">
                  <Mail className="w-3 h-3 text-primary shrink-0" />
                  <a href={`mailto:${primary.email}`} className="text-primary hover:underline truncate max-w-[180px] font-medium">{primary.email}</a>
                </div>
              )}
              {(primary.direct_phone || primary.mobile) && (
                <div className="flex items-center gap-1.5 text-xs ml-4">
                  <Phone className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span className="text-emerald-400 font-medium">{primary.direct_phone || primary.mobile}</span>
                </div>
              )}
            </div>
          );
        })()}

        {/* Action bar */}
        <div className="flex items-center gap-1 mt-2 pt-2 border-t">
          {partner.phone && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" asChild aria-label="Chiama">
                  <a href={`tel:${partner.phone}`}><Phone className="w-4 h-4 text-muted-foreground" /></a>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Chiama</TooltipContent>
            </Tooltip>
          )}
          {partner.email && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" asChild aria-label="Chiama">
                  <a href={`mailto:${partner.email}`}><Mail className="w-4 h-4 text-primary" /></a>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Email</TooltipContent>
            </Tooltip>
          )}
          {whatsappNumber && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" asChild aria-label="Chiama">
                  <a href={`https://wa.me/${cleanPhoneForWhatsApp(whatsappNumber)}`} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="w-4 h-4 text-emerald-500" />
                  </a>
                </Button>
              </TooltipTrigger>
              <TooltipContent>WhatsApp</TooltipContent>
            </Tooltip>
          )}
          {hasWebsite && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" asChild aria-label="Chiama">
                  <a href={`https://${domain}`} target="_blank" rel="noopener noreferrer">
                    <Globe className="w-4 h-4 text-primary" />
                  </a>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Sito web</TooltipContent>
            </Tooltip>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
