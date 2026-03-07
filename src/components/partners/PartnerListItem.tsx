import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Mail, Phone, ChevronRight, User } from "lucide-react";
import { getPartnerContactQuality } from "@/hooks/useContactCompleteness";
import { getCountryFlag, getYearsMember, formatServiceCategory } from "@/lib/countries";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { getServiceIcon, TRANSPORT_SERVICES, SPECIALTY_SERVICES } from "@/components/partners/shared/ServiceIcons";
import { MiniStars } from "@/components/partners/shared/MiniStars";
import { TrophyRow } from "@/components/partners/shared/TrophyRow";
import { CardSocialIcons } from "@/components/partners/shared/CardSocialIcons";
import { getBranchCountries, asEnrichment } from "@/lib/partnerUtils";
import type { SocialLink } from "@/hooks/useSocialLinks";

interface PartnerListItemProps {
  partner: any;
  isSelected: boolean;
  isChecked: boolean;
  socialLinks: SocialLink[];
  onSelect: (id: string) => void;
  onToggleSelection: (id: string, e?: React.MouseEvent) => void;
}

export function PartnerListItem({
  partner,
  isSelected,
  isChecked,
  socialLinks,
  onSelect,
  onToggleSelection,
}: PartnerListItemProps) {
  const q = getPartnerContactQuality(partner.partner_contacts);
  const years = getYearsMember(partner.member_since);
  const services = partner.partner_services || [];
  const branchCountries = getBranchCountries(partner);

  return (
    <div
      onClick={() => onSelect(partner.id)}
      className={cn(
        "w-full text-left p-3 transition-colors cursor-pointer relative group/card",
        "hover:bg-muted/50",
        isSelected && "bg-muted",
        isChecked && "bg-primary/5",
        q === "missing" && "border-l-2 border-l-destructive",
        q === "partial" && "border-l-2 border-l-warning",
        q === "complete" && "border-l-2 border-l-primary",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-1" onClick={(e) => onToggleSelection(partner.id, e)}>
          <Checkbox checked={isChecked} />
        </div>
        {/* Company logo/favicon */}
        <div className="relative shrink-0 mt-0.5">
          {partner.website ? (
            <img
              src={`https://www.google.com/s2/favicons?domain=${partner.website.replace(/^https?:\/\//, "").replace(/\/.*$/, "")}&sz=64`}
              alt=""
              className="w-8 h-8 rounded-md object-contain bg-muted border border-border p-1"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
                (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
              }}
            />
          ) : null}
          {partner.website ? (
            <div className="hidden w-8 h-8 rounded-md bg-muted border border-border" />
          ) : (
            <div className="w-8 h-8 rounded-md bg-muted border border-border" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate text-foreground">{partner.city}</p>
              <p className="text-xs text-muted-foreground truncate">{partner.company_name}</p>
            </div>
            <div className="flex flex-col items-end gap-0.5 shrink-0 text-right">
              {!!asEnrichment(partner.enrichment_data)?.deep_search_at && (
                <Tooltip>
                  <TooltipTrigger>
                    <span className="w-5 h-5 bg-sky-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm">D</span>
                  </TooltipTrigger>
                  <TooltipContent>Deep Search – {format(new Date(asEnrichment(partner.enrichment_data)!.deep_search_at!), "dd/MM/yyyy")}</TooltipContent>
                </Tooltip>
              )}
              {partner.member_since && (
                <span className="text-[10px] text-muted-foreground">
                  Est. {new Date(partner.member_since).getFullYear()}
                </span>
              )}
              {years > 0 && <TrophyRow years={years} />}
              {partner.membership_expires && (
                <span className={cn(
                  "text-[10px]",
                  new Date(partner.membership_expires) < new Date() ? "text-destructive" : "text-muted-foreground"
                )}>
                  Exp {format(new Date(partner.membership_expires), "MM/yy")}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xl leading-none">{getCountryFlag(partner.country_code)}</span>
            {partner.rating > 0 && <MiniStars rating={Number(partner.rating)} />}
          </div>
          {/* Inline contacts status */}
          <div className="mt-1.5 space-y-0.5">
            {(() => {
              const contacts = partner.partner_contacts || [];
              const primaryContact = contacts.find((c: any) => c.is_primary) || contacts[0];
              if (!primaryContact) return <span className="italic text-xs text-destructive/70">Nessun contatto personale</span>;
              return (
                <>
                  <div className="flex items-center gap-1.5 text-xs">
                    <User className="w-3 h-3 text-muted-foreground shrink-0" />
                    <span className="font-medium text-foreground truncate max-w-[140px]">{primaryContact.contact_alias || primaryContact.name}</span>
                    {primaryContact.title && <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">· {primaryContact.title}</span>}
                    {contacts.length > 1 && (
                      <span className="text-[10px] text-muted-foreground">+{contacts.length - 1}</span>
                    )}
                  </div>
                  {primaryContact.email && (
                    <div className="flex items-center gap-1.5 text-xs ml-4">
                      <Mail className="w-3 h-3 text-sky-400 shrink-0" />
                      <a href={`mailto:${primaryContact.email}`} onClick={(e) => e.stopPropagation()} className="text-sky-400 hover:underline truncate max-w-[180px] font-medium">{primaryContact.email}</a>
                    </div>
                  )}
                  {(primaryContact.direct_phone || primaryContact.mobile) && (
                    <div className="flex items-center gap-1.5 text-xs ml-4">
                      <Phone className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span className="text-emerald-400 font-medium truncate max-w-[140px]">{primaryContact.direct_phone || primaryContact.mobile}</span>
                    </div>
                  )}
                  {!primaryContact.email && !primaryContact.direct_phone && !primaryContact.mobile && (
                    <span className="text-[10px] text-destructive/70 ml-4">Manca email e telefono</span>
                  )}
                </>
              );
            })()}
          </div>
          {/* Service icons */}
          {(() => {
            const transport = services.filter((s: any) => TRANSPORT_SERVICES.includes(s.service_category));
            const specialty = services.filter((s: any) => SPECIALTY_SERVICES.includes(s.service_category));
            if (transport.length === 0 && specialty.length === 0) return null;
            return (
              <div className="flex items-start gap-3 mt-1.5">
                {transport.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    {transport.map((s: any, i: number) => {
                      const Icon = getServiceIcon(s.service_category);
                      return (
                        <Tooltip key={i}>
                          <TooltipTrigger>
                            <Icon className="w-4 h-4 text-sky-500" strokeWidth={1.5} />
                          </TooltipTrigger>
                          <TooltipContent>{formatServiceCategory(s.service_category)}</TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                )}
                {transport.length > 0 && specialty.length > 0 && (
                  <span className="text-border">│</span>
                )}
                {specialty.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    {specialty.map((s: any, i: number) => {
                      const Icon = getServiceIcon(s.service_category);
                      return (
                        <Tooltip key={i}>
                          <TooltipTrigger>
                            <Icon className="w-4 h-4 text-violet-400" strokeWidth={1.5} />
                          </TooltipTrigger>
                          <TooltipContent>{formatServiceCategory(s.service_category)}</TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}
          {/* Social */}
          <CardSocialIcons links={socialLinks} />
          {/* Branch country flags */}
          {branchCountries.length > 0 && (
            <div className="flex items-center gap-0.5 mt-1.5 flex-wrap">
              {branchCountries.slice(0, 10).map(({ code, name }) => (
                <Tooltip key={code}>
                  <TooltipTrigger><span className="text-base leading-none">{getCountryFlag(code)}</span></TooltipTrigger>
                  <TooltipContent>{name}</TooltipContent>
                </Tooltip>
              ))}
              {branchCountries.length > 10 && (
                <span className="text-[9px] text-muted-foreground ml-0.5">+{branchCountries.length - 10}</span>
              )}
            </div>
          )}
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
      </div>
    </div>
  );
}
