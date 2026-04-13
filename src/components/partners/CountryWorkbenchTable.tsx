import { Checkbox } from "@/components/ui/checkbox";
import { getCountryFlag } from "@/lib/countries";
import { cn } from "@/lib/utils";
import { User, Globe, Trophy } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MiniStars } from "@/components/partners/shared/MiniStars";
import { getServiceIcon, TRANSPORT_SERVICES, SPECIALTY_SERVICES } from "@/components/partners/shared/ServiceIcons";
import { getYearsMember, formatServiceCategory } from "@/lib/countries";
import { getRealLogoUrl, getBranchCountries } from "@/lib/partnerUtils";
import type { PartnerRowData } from "./CountryWorkbenchTypes";

interface CountryWorkbenchTableProps {
  filteredPartners: PartnerRowData[];
  selectedId: string | null;
  selectedIds: Set<string>;
  onSelectPartner: (id: string) => void;
  onToggleSelection: (id: string) => void;
}

export function CountryWorkbenchTable({
  filteredPartners, selectedId, selectedIds, onSelectPartner, onToggleSelection,
}: CountryWorkbenchTableProps) {
  return (
    <ScrollArea className="flex-1">
      <div className="py-1">
        {filteredPartners.map((partner, index: number) => {
          const isSelected = selectedIds.has(partner.id);
          const years = getYearsMember(partner.member_since);
          const services = partner.partner_services || [];
          const allServices = [
            ...services.filter((s) => TRANSPORT_SERVICES.includes(s.service_category)),
            ...services.filter((s) => SPECIALTY_SERVICES.includes(s.service_category)),
          ];
          const networks = partner.partner_networks || [];
          const contacts = partner.partner_contacts || [];
          const primaryContact = contacts.find((c) => c.is_primary) || contacts[0];
          const extraContacts = contacts.length > 1 ? contacts.length - 1 : 0;
          const branches = getBranchCountries(partner);
          const flag = getCountryFlag(partner.country_code);

          return (
            <div key={partner.id} onClick={() => onSelectPartner(partner.id)}
              className={cn(
                "mx-2 mb-1 px-3 py-3 cursor-pointer transition-all rounded-xl flex items-start gap-2",
                "hover:bg-accent/40",
                selectedId === partner.id && "bg-accent/60 shadow-sm",
                isSelected && "bg-primary/[0.06] ring-1 ring-primary/20",
              )}>
              {/* Left: number + checkbox */}
              <div className="flex flex-col items-center shrink-0 gap-0.5">
                <span className="text-[10px] text-muted-foreground/60 font-mono">{index + 1}</span>
                <div onClick={(e) => { e.stopPropagation(); onToggleSelection(partner.id); }}>
                  <Checkbox checked={isSelected} className="data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
                </div>
              </div>

              {/* Logo */}
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted/30 border border-border/40 flex items-center justify-center shrink-0 self-center">
                {getRealLogoUrl(partner.logo_url) ? (
                  <img src={getRealLogoUrl(partner.logo_url)!} alt="" className="w-full h-full object-contain p-0.5" />
                ) : (
                  <span className="text-2xl opacity-50">{flag}</span>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-[13px] font-semibold truncate leading-tight text-foreground">{partner.company_name}</p>

                {primaryContact ? (
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <User className="w-3 h-3 text-muted-foreground shrink-0" />
                    <span className="font-medium text-foreground truncate">{primaryContact.contact_alias || primaryContact.name}</span>
                    {extraContacts > 0 && (
                      <span className="flex items-center gap-0.5 text-[10px] text-foreground/60">
                        +{extraContacts}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-[10px] italic text-destructive/80">Nessun contatto</span>
                )}

                {(allServices.length > 0 || branches.length > 0) && (
                  <>
                    <div className="border-t border-border/30 pt-1" />
                    {allServices.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap">
                        {allServices.map((s, i: number) => {
                          const Icon = getServiceIcon(s.service_category);
                          return (
                            <Tooltip key={i}>
                              <TooltipTrigger>
                                <Icon className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.5} />
                              </TooltipTrigger>
                              <TooltipContent>{formatServiceCategory(s.service_category)}</TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </div>
                    )}
                    {branches.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap">
                        {branches.map((b) => (
                          <Tooltip key={b.code}>
                            <TooltipTrigger>
                              <span className="text-sm leading-none">{getCountryFlag(b.code)}</span>
                            </TooltipTrigger>
                            <TooltipContent className="text-xs">{b.name}</TooltipContent>
                          </Tooltip>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Right column */}
              <div className="flex flex-col items-end gap-1.5 shrink-0 self-start pt-0.5">
                {years > 0 && (
                  <span className="flex items-center gap-0.5 text-primary">
                    <Trophy className="w-3.5 h-3.5 fill-primary text-primary" />
                    <span className="text-[11px] font-bold">{years}</span>
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <span className="text-sm leading-none">{flag}</span>
                  {networks.length > 0 && (
                    <Tooltip>
                      <TooltipTrigger>
                        <span className="flex items-center gap-0.5 text-muted-foreground">
                          <Globe className="w-3 h-3" />
                          <span className="text-[10px] font-bold">{networks.length}</span>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="text-xs">
                        {networks.map((n) => n.network_name.replace("WCA ", "")).join(", ")}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </span>
                {(partner.rating ?? 0) > 0 && (
                  <div className="flex items-center gap-1">
                    <MiniStars rating={Number(partner.rating)} size="w-2.5 h-2.5" />
                    <span className="text-[10px] font-bold text-primary">{Number(partner.rating).toFixed(1)}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
