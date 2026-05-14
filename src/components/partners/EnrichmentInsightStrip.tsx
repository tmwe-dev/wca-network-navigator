import type { PartnerViewModel } from "@/types/partner-views";
import { ArrowUpRight, Building2, Calendar, Sparkles, Truck, Users, Warehouse } from "lucide-react";
import { getCountryFlag, resolveCountryCode, formatServiceCategory } from "@/lib/countries";
import { cn } from "@/lib/utils";
import { EnrichmentBadge } from "@/v2/ui/atoms/EnrichmentBadge";
import { getServiceIcon } from "@/components/partners/shared/ServiceIcons";

interface PartnerService {
  readonly service_category: string;
}

interface BranchCountry {
  readonly code: string;
  readonly name: string;
}

interface RouteLike {
  readonly from?: string;
  readonly origin?: string;
  readonly to?: string;
  readonly destination?: string;
}

interface Props {
  readonly partner: PartnerViewModel;
  readonly enrichment: Record<string, unknown> | null;
  readonly services: readonly PartnerService[];
  readonly branchCountries: readonly BranchCountry[];
}

const COUNTRY_ALIASES: Readonly<Record<string, string>> = {
  cina: "CN",
  ucraina: "UA",
  polonia: "PL",
  germania: "DE",
  slovacchia: "SK",
  slovenia: "SI",
  romania: "RO",
  mondo: "",
};

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function textValue(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function firstText(...values: readonly unknown[]): string | null {
  for (const value of values) {
    const text = textValue(value);
    if (text) return text;
  }
  return null;
}

function countryCodeFromLabel(label: string): string | null {
  const clean = label.toLowerCase().replace(/[()]/g, " ").split(/[\/,;|]/)[0]?.trim() ?? "";
  return COUNTRY_ALIASES[clean] || resolveCountryCode(label) || resolveCountryCode(clean);
}

function routeItems(value: unknown): RouteLike[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): RouteLike[] => {
    if (typeof item === "string" && item.trim()) return [{ from: item.trim(), to: "" }];
    if (!item || typeof item !== "object") return [];
    const route = item as Record<string, unknown>;
    return [{
      from: textValue(route.from),
      origin: textValue(route.origin),
      to: textValue(route.to),
      destination: textValue(route.destination),
    }];
  });
}

function serviceKeyFromLabel(label: string): string {
  const normalized = label.toLowerCase();
  if (normalized.includes("air") || normalized.includes("aereo")) return "air_freight";
  if (normalized.includes("sea") || normalized.includes("ocean") || normalized.includes("mare")) return "ocean_fcl";
  if (normalized.includes("warehouse") || normalized.includes("magazz")) return "warehousing";
  if (normalized.includes("custom") || normalized.includes("dogan")) return "customs_broker";
  if (normalized.includes("road") || normalized.includes("truck") || normalized.includes("camion")) return "road_freight";
  if (normalized.includes("rail") || normalized.includes("ferro")) return "rail_freight";
  return label;
}

export function EnrichmentInsightStrip({ partner, enrichment, services, branchCountries }: Props): React.ReactElement | null {
  const companyProfile = enrichment?.company_profile && typeof enrichment.company_profile === "object"
    ? enrichment.company_profile as Record<string, unknown>
    : null;
  const aiProfile = enrichment?.ai_profile && typeof enrichment.ai_profile === "object"
    ? enrichment.ai_profile as Record<string, unknown>
    : null;

  const summary = firstText(enrichment?.summary_it, enrichment?.summary_en, aiProfile?.summary, companyProfile?.recent_news);
  const markets = stringArray(enrichment?.key_markets).slice(0, 8);
  const routes = routeItems(enrichment?.key_routes).slice(0, 4);
  const additionalServices = stringArray(enrichment?.additional_services).slice(0, 8);
  const specialties = stringArray(companyProfile?.specialties).slice(0, 8);
  const serviceLabels = [...new Set([
    ...services.map((service) => service.service_category),
    ...additionalServices,
    ...specialties,
  ])].slice(0, 12);

  const warehouseSqm = numberValue(enrichment?.warehouse_sqm);
  const employeeCount = numberValue(enrichment?.employee_count) ?? numberValue(companyProfile?.employee_count_estimate);
  const foundingYear = numberValue(enrichment?.founding_year) ?? numberValue(companyProfile?.founded_year);
  const fleetDetails = textValue(enrichment?.fleet_details);
  const warehouseDetails = textValue(enrichment?.warehouse_details);
  const hasWarehouses = enrichment?.has_warehouses === true || warehouseSqm !== null || !!warehouseDetails;
  const hasData = !!summary || serviceLabels.length > 0 || markets.length > 0 || routes.length > 0 || hasWarehouses || employeeCount !== null || foundingYear !== null || !!fleetDetails || branchCountries.length > 0;

  if (!hasData && !partner.enriched_at) return null;

  return (
    <div className="mt-3 rounded-xl border border-primary/15 bg-primary/[0.04] px-3 py-2.5 space-y-2">
      <div className="flex items-start gap-2">
        <EnrichmentBadge partner={partner} variant="pill" className="shrink-0" />
        {summary && <p className="text-[11px] leading-relaxed text-foreground/80 line-clamp-3">{summary}</p>}
      </div>

      {(serviceLabels.length > 0 || hasWarehouses || employeeCount !== null || foundingYear !== null || !!fleetDetails) && (
        <div className="flex flex-wrap gap-1.5">
          {serviceLabels.map((label) => {
            const key = serviceKeyFromLabel(label);
            const Icon = getServiceIcon(key);
            return (
              <span key={label} className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-card/70 px-2 py-1 text-[10px] font-medium text-foreground/80">
                <Icon className="h-3 w-3 text-primary" strokeWidth={1.6} />
                {formatServiceCategory(label)}
              </span>
            );
          })}
          {hasWarehouses && (
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-card/70 px-2 py-1 text-[10px] font-medium text-foreground/80">
              <Warehouse className="h-3 w-3 text-primary" strokeWidth={1.6} />
              {warehouseSqm ? `${warehouseSqm.toLocaleString("it-IT")} mq warehouse` : "Warehousing"}
            </span>
          )}
          {employeeCount !== null && <Metric icon={Users} label={`${employeeCount.toLocaleString("it-IT")} dip.`} />}
          {foundingYear !== null && <Metric icon={Calendar} label={`Dal ${foundingYear}`} />}
          {fleetDetails && <Metric icon={Truck} label={fleetDetails} />}
        </div>
      )}

      {(markets.length > 0 || routes.length > 0 || branchCountries.length > 0) && (
        <div className="space-y-1.5 border-t border-primary/10 pt-2">
          {(markets.length > 0 || branchCountries.length > 0) && (
            <div className="flex flex-wrap gap-1.5">
              {branchCountries.slice(0, 6).map((country) => (
                <CountryChip key={country.code} code={country.code} label={`Filiale ${country.name}`} />
              ))}
              {markets.map((market) => (
                <CountryChip key={market} code={countryCodeFromLabel(market)} label={market} />
              ))}
            </div>
          )}
          {routes.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {routes.map((route, index) => {
                const from = route.from || route.origin || "";
                const to = route.to || route.destination || "";
                const fromCode = countryCodeFromLabel(from);
                const toCode = countryCodeFromLabel(to);
                return (
                  <span key={`${from}-${to}-${index}`} className="inline-flex items-center gap-1 rounded-lg border border-primary/15 bg-card/60 px-2 py-1 text-[10px] text-foreground/80">
                    <span>{fromCode ? getCountryFlag(fromCode) : from || "🌍"}</span>
                    <ArrowUpRight className="h-3 w-3 text-primary" strokeWidth={1.6} />
                    <span>{toCode ? getCountryFlag(toCode) : to || "🌍"}</span>
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}

      {(warehouseDetails || fleetDetails) && (
        <div className="flex flex-col gap-1 border-t border-primary/10 pt-2 text-[10px] leading-relaxed text-muted-foreground">
          {warehouseDetails && <span><Building2 className="mr-1 inline h-3 w-3 text-primary" />{warehouseDetails}</span>}
        </div>
      )}
    </div>
  );
}

function CountryChip({ code, label }: { readonly code: string | null; readonly label: string }): React.ReactElement {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-primary/15 bg-card/60 px-2 py-1 text-[10px] font-medium text-foreground/80" title={label}>
      <span>{code ? getCountryFlag(code) : "🌍"}</span>
      <span className="max-w-[8rem] truncate">{label}</span>
    </span>
  );
}

function Metric({ icon: Icon, label, className }: { readonly icon: React.ElementType; readonly label: string; readonly className?: string }): React.ReactElement {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border border-primary/15 bg-card/60 px-2 py-1 text-[10px] font-medium text-foreground/80", className)}>
      <Icon className="h-3 w-3 text-primary" strokeWidth={1.6} />
      {label}
    </span>
  );
}