import { Suspense, lazy } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Phone, Mail, Globe, MapPin, Calendar, Users, User,
  Building2, ArrowUpRight, ShieldCheck, FileText,
  Hash, ChevronDown, Box,
} from "lucide-react";
import { getCountryFlag, getYearsMember, formatServiceCategory, resolveCountryCode } from "@/lib/countries";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { EnrichmentCard } from "@/components/partners/EnrichmentCard";
import { SocialLinks } from "@/components/partners/SocialLinks";
import { getServiceIcon } from "@/components/partners/shared/ServiceIcons";
import { getNetworkLogo } from "@/components/partners/shared/NetworkLogos";
import { getBranchCountries } from "@/lib/partnerUtils";

const PartnerMiniGlobe = lazy(() =>
  import("@/components/partners/PartnerMiniGlobe").then((m) => ({ default: m.PartnerMiniGlobe }))
);

interface PartnerContact {
  id: string;
  name: string;
  title?: string;
  email?: string;
  direct_phone?: string;
  mobile?: string;
  is_primary?: boolean;
}

interface PartnerNetwork {
  id: string;
  network_name: string;
  expires?: string;
}

interface PartnerService {
  service_category: string;
}

interface PartnerCertification {
  certification: string;
}

function Section({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn(
      "bg-gradient-to-br from-primary/5 via-card to-primary/5 backdrop-blur-sm border border-primary/10 rounded-2xl p-4 space-y-2",
      className
    )}>
      {children}
    </div>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-3.5 h-3.5 text-primary" strokeWidth={1.5} />
      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{children}</p>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface PartnerDetailInfoProps {
  partner: Record<string, any>;
  enrichment: Record<string, any> | null;
  contacts: PartnerContact[];
  networks: PartnerNetwork[];
  allServices: PartnerService[];
  branchCountries: { code: string; name: string }[];
  hasBranches: boolean;
}

export function PartnerDetailInfo({
  partner, enrichment, contacts, networks, allServices, branchCountries, hasBranches,
}: PartnerDetailInfoProps) {
  const partnerCertifications = (partner.partner_certifications || []) as PartnerCertification[];

  return (
    <>
      <EnrichmentCard partner={partner} />

      {partner.profile_description && (
        <Section>
          <SectionTitle icon={FileText}>Profilo Aziendale</SectionTitle>
          <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">{String(partner.profile_description)}</p>
        </Section>
      )}

      {contacts.length > 0 && (
        <Section>
          <SectionTitle icon={Users}>Contatti Ufficio ({contacts.length})</SectionTitle>
          <div className="space-y-2">
            {contacts.map((c) => (
              <div key={c.id} className="bg-card/60 border border-primary/10 rounded-lg p-2.5 space-y-1">
                <div className="flex items-center gap-2">
                  <User className="w-3 h-3 text-primary" strokeWidth={1.5} />
                  <span className="text-xs font-medium text-foreground">{c.name}</span>
                  {c.is_primary && (
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-semibold uppercase">Primary</span>
                  )}
                </div>
                {c.title && <p className="text-[11px] text-foreground/70 ml-5">{c.title}</p>}
                <div className="flex flex-col gap-0.5 ml-5">
                  {c.email && (
                    <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 text-xs text-foreground/80 hover:text-foreground">
                      <Mail className="w-3 h-3" /> {c.email}
                    </a>
                  )}
                  {c.direct_phone && (
                    <a href={`tel:${c.direct_phone}`} className="flex items-center gap-1.5 text-xs text-foreground/80 hover:text-foreground">
                      <Phone className="w-3 h-3" /> {c.direct_phone}
                    </a>
                  )}
                  {c.mobile && (
                    <a href={`tel:${c.mobile}`} className="flex items-center gap-1.5 text-xs text-foreground/80 hover:text-foreground">
                      <Phone className="w-3 h-3" /> {c.mobile}
                    </a>
                  )}
                  {(() => {
                    const waNumber = c.mobile || c.direct_phone;
                    if (!waNumber) return null;
                    const cleaned = waNumber.replace(/[\s\-\(\)\.]/g, '').replace(/^\+/, '');
                    return (
                      <a href={`https://wa.me/${cleaned}`} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs text-foreground/80 hover:text-foreground">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                        WhatsApp
                      </a>
                    );
                  })()}
                </div>
                <div className="ml-5">
                  <SocialLinks partnerId={String(partner.id)} contactId={c.id} compact />
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {networks.length > 0 && (
        <Section>
          <SectionTitle icon={Hash}>Network ({networks.length})</SectionTitle>
          <div className="flex items-center gap-2 overflow-x-auto">
            {networks.map((n) => {
              const logo = getNetworkLogo(n.network_name);
              return (
                <Tooltip key={n.id}>
                  <TooltipTrigger>
                    <div className="shrink-0 flex flex-col items-center gap-1 bg-card/60 border border-primary/10 rounded-xl px-3 py-2 hover:bg-primary/5 transition-colors min-w-[70px]">
                      {logo ? (
                        <img src={logo} alt={n.network_name} className="h-8 w-auto object-contain" />
                      ) : (
                        <span className="text-xs font-medium text-foreground">{n.network_name}</span>
                      )}
                      <span className="text-[9px] text-muted-foreground text-center leading-tight max-w-[80px] truncate">
                        {n.network_name.replace("WCA ", "")}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    {n.network_name}
                    {n.expires && <> — Scade {format(new Date(n.expires), "MMM yyyy")}</>}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </Section>
      )}

      {allServices.length > 0 && (
        <Section>
          <SectionTitle icon={Box}>Servizi ({allServices.length})</SectionTitle>
          <div className="flex flex-wrap gap-1.5">
            {allServices.map((s, i: number) => {
              const Icon = getServiceIcon(s.service_category);
              return (
                <div key={i} className="flex items-center gap-1.5 bg-card/60 border border-primary/10 rounded-lg px-2.5 py-1.5">
                  <Icon className="w-3.5 h-3.5 text-primary" strokeWidth={1.5} />
                  <span className="text-[10px] text-foreground/80">{formatServiceCategory(s.service_category)}</span>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* Advanced details collapsible */}
      {(partnerCertifications.length > 0 || branchCountries.length > 0 || (enrichment?.key_markets as unknown[])?.length > 0 || (enrichment?.key_routes as unknown[])?.length > 0 || hasBranches || partner.address || partner.member_since) && (
        <Collapsible>
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center gap-2 cursor-pointer hover:bg-primary/5 rounded-xl px-3 py-2 transition-colors border border-primary/10">
              <Building2 className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-medium text-foreground/80">Dettagli Avanzati</span>
              <ChevronDown className="w-3 h-3 text-muted-foreground ml-auto" />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-3 mt-2">
              {(partner.address || partner.member_since || partner.fax) && (
                <Section>
                  <SectionTitle icon={Building2}>Anagrafica</SectionTitle>
                  <div className="space-y-1.5">
                    {partner.address && (
                      <div className="flex items-start gap-2 text-xs text-foreground/80">
                        <MapPin className="w-3 h-3 mt-0.5 text-primary" strokeWidth={1.5} />
                        <span>{String(partner.address)}</span>
                      </div>
                    )}
                    {partner.member_since && (
                      <div className="flex items-center gap-2 text-xs text-foreground/80">
                        <Calendar className="w-3 h-3 text-primary" strokeWidth={1.5} />
                        <span>Membro dal {format(new Date(String(partner.member_since)), "MMMM yyyy", { locale: it })}</span>
                      </div>
                    )}
                    {partner.fax && (
                      <div className="flex items-center gap-2 text-xs text-foreground/80">
                        <FileText className="w-3 h-3 text-primary" strokeWidth={1.5} />
                        <span>Fax: {String(partner.fax)}</span>
                      </div>
                    )}
                  </div>
                </Section>
              )}

              {partnerCertifications.length > 0 && (
                <Section>
                  <SectionTitle icon={ShieldCheck}>Certificazioni</SectionTitle>
                  <div className="flex flex-wrap gap-1.5">
                    {partnerCertifications.map((c, i: number) => (
                      <span key={i} className="flex items-center gap-1 bg-card/60 border border-primary/10 rounded-lg px-2 py-1 text-xs text-foreground/80">
                        <ShieldCheck className="w-3 h-3 text-primary" strokeWidth={1.5} />
                        {c.certification}
                      </span>
                    ))}
                  </div>
                </Section>
              )}

              {branchCountries.length > 0 && (
                <Section>
                  <SectionTitle icon={Globe}>Paesi Collegati ({branchCountries.length})</SectionTitle>
                  <div className="flex flex-wrap gap-1.5">
                    {branchCountries.map(({ code, name }) => (
                      <span key={code} className="flex items-center gap-1.5 text-xs bg-card/60 border border-primary/10 rounded-lg py-1 px-2 text-foreground/80">
                        <span className="text-sm">{getCountryFlag(code)}</span> {name}
                      </span>
                    ))}
                  </div>
                </Section>
              )}

              {enrichment?.key_markets && Array.isArray(enrichment.key_markets) && (enrichment.key_markets as string[]).length > 0 && (
                <Section>
                  <SectionTitle icon={Globe}>Mercati Principali</SectionTitle>
                  <div className="flex flex-wrap gap-1.5">
                    {(enrichment.key_markets as string[]).map((market: string, i: number) => {
                      const code = resolveCountryCode(market);
                      return (
                        <span key={i} className="flex items-center gap-1 text-xs bg-card/60 border border-primary/10 rounded-lg py-1 px-2 text-foreground/80">
                          <span className="text-sm">{code ? getCountryFlag(code) : "🌍"}</span> {market}
                        </span>
                      );
                    })}
                  </div>
                </Section>
              )}

              {enrichment?.key_routes && Array.isArray(enrichment.key_routes) && (enrichment.key_routes as { from?: string; origin?: string; to?: string; destination?: string }[]).length > 0 && (
                <Section>
                  <SectionTitle icon={ArrowUpRight}>Routing</SectionTitle>
                  <div className="space-y-1">
                    {(enrichment.key_routes as { from?: string; origin?: string; to?: string; destination?: string }[]).map((route, i: number) => {
                      const fromCode = resolveCountryCode(route.from || route.origin || "");
                      const toCode = resolveCountryCode(route.to || route.destination || "");
                      return (
                        <div key={i} className="flex items-center justify-center gap-3 bg-card/60 border border-primary/10 rounded-lg py-1.5 px-3">
                          <span className="text-base">{fromCode ? getCountryFlag(fromCode) : "🌍"}</span>
                          <ArrowUpRight className="w-3 h-3 text-primary rotate-45 shrink-0" />
                          <span className="text-base">{toCode ? getCountryFlag(toCode) : "🌍"}</span>
                        </div>
                      );
                    })}
                  </div>
                </Section>
              )}

              {hasBranches && (
                <Section>
                  <SectionTitle icon={Globe}>Mappa Filiali</SectionTitle>
                  <Suspense fallback={<Skeleton className="w-full h-[200px] rounded-lg" />}>
                    <PartnerMiniGlobe
                      partnerCountryCode={String(partner.country_code)}
                      partnerCity={String(partner.city)}
                      branchCities={partner.branch_cities as unknown[]}
                    />
                  </Suspense>
                </Section>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </>
  );
}
