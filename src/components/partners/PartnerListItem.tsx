import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Mail, Phone, ChevronRight, User, Brain, Handshake } from "lucide-react";
import { getCountryFlag, getYearsMember, formatServiceCategory } from "@/lib/countries";
import { asEnrichment } from "@/lib/partnerUtils";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { getServiceIcon, TRANSPORT_SERVICES, SPECIALTY_SERVICES } from "@/components/partners/shared/ServiceIcons";
import { MiniStars } from "@/components/partners/shared/MiniStars";
import { TrophyRow } from "@/components/partners/shared/TrophyRow";
import { getBranchCountries } from "@/lib/partnerUtils";
import type { SocialLink } from "@/hooks/useSocialLinks";

interface ServiceItem { service_category: string }
interface NetworkItem { id: string; network_name: string }
interface ContactItem { id: string; name: string; email: string | null; direct_phone: string | null; mobile: string | null; is_primary: boolean | null; contact_alias: string | null }

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic Supabase join shape with 20+ fields
interface PartnerListItemProps {
  partner: Record<string, any>;
  isSelected: boolean;
  isChecked: boolean;
  socialLinks: SocialLink[];
  hasBusinessCard?: boolean;
  onSelect: (id: string) => void;
  onToggleSelection: (id: string, e?: React.MouseEvent) => void;
  index?: number;
}

export function PartnerListItem({
  partner,
  isSelected,
  isChecked,
  socialLinks: _socialLinks,
  hasBusinessCard,
  onSelect,
  onToggleSelection,
  index,
}: PartnerListItemProps) {
  const years = getYearsMember(partner.member_since);
  const services: ServiceItem[] = partner.partner_services || [];
  const allServices = [
    ...services.filter((s) => TRANSPORT_SERVICES.includes(s.service_category)),
    ...services.filter((s) => SPECIALTY_SERVICES.includes(s.service_category)),
  ];
  const branchCountries = getBranchCountries(partner);
  const enrichment = asEnrichment(partner.enrichment_data);
  const hasDeepSearch = !!enrichment?.deep_search_at;
  const contacts: ContactItem[] = partner.partner_contacts || [];
  const primaryContact = contacts.find((c) => c.is_primary) || contacts[0];
  const contactEmail = primaryContact?.email;
  const contactPhone = primaryContact?.direct_phone || primaryContact?.mobile;
  const networks: NetworkItem[] = partner.partner_networks || [];

  return (
    <div
      onClick={() => onSelect(partner.id)}
      className={cn(
        "w-full text-left px-3 py-2.5 transition-colors cursor-pointer",
        "hover:bg-accent/40",
        isSelected && "bg-accent/60",
        isChecked && "bg-primary/[0.06]",
      )}
    >
      <div className="flex items-start gap-2">
        {/* Progressive number */}
        {index !== undefined && (
          <span className="text-[10px] text-muted-foreground/50 font-mono w-5 shrink-0 text-right mt-2.5">
            {index + 1}
          </span>
        )}

        <div className="mt-1" onClick={(e) => onToggleSelection(partner.id, e)}>
          <Checkbox checked={isChecked} />
        </div>

        {/* Flag */}
        <span className="text-xl mt-0.5 shrink-0">{getCountryFlag(partner.country_code)}</span>

        <div className="flex-1 min-w-0">
          {/* Row 1: Company name + rating */}
          <div className="flex items-center gap-1.5 min-w-0">
            <p className="font-semibold text-sm truncate">{partner.company_name}</p>
            {(partner.rating ?? 0) > 0 && <MiniStars rating={Number(partner.rating)} />}
          </div>

          {/* Row 2: City + years */}
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
            <span className="truncate">{partner.city}, {partner.country_name}</span>
            {years > 0 && <TrophyRow years={years} />}
          </div>

          {/* Row 3: Contact info — always visible */}
          <div className="mt-1 space-y-0.5">
            {primaryContact ? (
              <>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <User className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                  <span className="font-medium text-foreground truncate">{primaryContact.contact_alias || primaryContact.name}</span>
                  {contacts.length > 1 && (
                    <span className="text-[10px] text-muted-foreground">+{contacts.length - 1}</span>
                  )}
                </div>
                {contactEmail && (
                  <a href={`mailto:${contactEmail}`} onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:underline truncate ml-[18px]">
                    <Mail className="w-3 h-3 shrink-0" />{contactEmail}
                  </a>
                )}
                {contactPhone && (
                  <a href={`tel:${contactPhone}`} onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1.5 text-[11px] text-emerald-400 truncate ml-[18px]">
                    <Phone className="w-3 h-3 shrink-0" />{contactPhone}
                  </a>
                )}
              </>
            ) : (
              <span className="text-[10px] italic text-destructive/60">Nessun contatto</span>
            )}
          </div>

          {/* Row 4: Service icons */}
          {allServices.length > 0 && (
            <div className="flex items-center gap-1 mt-1.5">
              {allServices.slice(0, 6).map((s, i: number) => {
                const Icon = getServiceIcon(s.service_category);
                return (
                  <Tooltip key={i}>
                    <TooltipTrigger>
                      <Icon className="w-3.5 h-3.5 text-muted-foreground/70" strokeWidth={1.5} />
                    </TooltipTrigger>
                    <TooltipContent>{formatServiceCategory(s.service_category)}</TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          )}

          {/* Row 5: Networks */}
          {networks.length > 0 && (
            <div className="flex items-center gap-1 mt-1">
              {networks.slice(0, 3).map((n) => (
                <span key={n.id} className="text-[9px] px-1.5 py-0.5 rounded bg-primary/[0.08] text-primary/80 font-medium truncate max-w-[80px]">
                  {n.network_name.replace("WCA ", "").substring(0, 10)}
                </span>
              ))}
              {networks.length > 3 && (
                <span className="text-[9px] text-muted-foreground/60">+{networks.length - 3}</span>
              )}
            </div>
          )}

          {/* Branch flags */}
          {branchCountries.length > 0 && (
            <div className="flex items-center gap-0.5 mt-1 flex-wrap">
              {branchCountries.slice(0, 8).map(({ code, name }) => (
                <Tooltip key={code}>
                  <TooltipTrigger><span className="text-sm leading-none">{getCountryFlag(code)}</span></TooltipTrigger>
                  <TooltipContent>{name}</TooltipContent>
                </Tooltip>
              ))}
              {branchCountries.length > 8 && (
                <span className="text-[9px] text-muted-foreground">+{branchCountries.length - 8}</span>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-col items-center gap-1 shrink-0 mt-1">
          {hasBusinessCard && (
            <Tooltip>
              <TooltipTrigger>
                <Handshake className="w-4 h-4 text-emerald-400 drop-shadow-[0_0_3px_rgba(52,211,153,0.4)]" />
              </TooltipTrigger>
              <TooltipContent>Incontrato personalmente</TooltipContent>
            </Tooltip>
          )}
          {hasDeepSearch && (
            <Tooltip>
              <TooltipTrigger>
                <Brain className="w-4 h-4 text-primary drop-shadow-[0_0_3px_hsl(var(--primary)/0.4)]" />
              </TooltipTrigger>
              <TooltipContent>
                Deep Search — {format(new Date(enrichment!.deep_search_at!), "d MMM yyyy", { locale: it })}
              </TooltipContent>
            </Tooltip>
          )}
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>
    </div>
  );
}
