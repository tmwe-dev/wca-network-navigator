import type { PartnerViewModel } from "@/types/partner-views";
import type * as React from "react";
import { ArrowRight, Building2, Calendar, Truck, Users, Warehouse, MapPin, Globe2, Building } from "lucide-react";
import { getCountryFlag, resolveCountryCode, formatServiceCategory } from "@/lib/countries";
import { cn } from "@/lib/utils";
import { EnrichmentBadge } from "@/v2/ui/atoms/EnrichmentBadge";
import { resolveServiceIcon } from "@/components/partners/shared/ServiceIcons";

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
  readonly networks?: readonly { readonly id: string; readonly network_name: string }[];
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
      from: textValue(route.from) ?? undefined,
      origin: textValue(route.origin) ?? undefined,
      to: textValue(route.to) ?? undefined,
      destination: textValue(route.destination) ?? undefined,
    }];
  });
}

export function EnrichmentInsightStrip({ partner, enrichment, services, branchCountries, networks = [] }: Props): React.ReactElement | null {
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
  const hasData = !!summary || serviceLabels.length > 0 || markets.length > 0 || routes.length > 0 || hasWarehouses || employeeCount !== null || foundingYear !== null || !!fleetDetails || branchCountries.length > 0 || networks.length > 0;

  if (!hasData && !partner.enriched_at) return null;

  return (
    <div className="mt-3 rounded-xl border border-primary/15 bg-primary/[0.04] px-3 py-2.5 space-y-2.5">
      {/* Row 1 — pitch in una riga */}
      <div className="flex items-start gap-2">
        <EnrichmentBadge partner={partner} variant="pill" className="shrink-0" />
        {summary && <p className="text-[11px] leading-relaxed text-foreground/85 line-clamp-2">{summary}</p>}
      </div>

      {/* Row 2 — capabilities (icone distinte per ogni servizio) */}
      {serviceLabels.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {serviceLabels.map((label) => {
            const Icon = resolveServiceIcon(label);
            return (
              <span
                key={label}
                title={formatServiceCategory(label)}
                aria-label={formatServiceCategory(label)}
                className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-primary/20 bg-card/70 text-foreground/85 hover:bg-primary/10 hover:border-primary/40 transition-colors cursor-help"
              >
                <Icon className="h-5 w-5 text-primary" strokeWidth={1.6} />
              </span>
            );
          })}
        </div>
      )}

      {/* Row 3 — footprint operativo (numeri compatti) */}
      {(hasWarehouses || employeeCount !== null || foundingYear !== null || !!fleetDetails) && (
        <div className="flex flex-wrap gap-1.5">
          {hasWarehouses && (
            <Metric
              icon={Warehouse}
              label={warehouseSqm ? `${warehouseSqm.toLocaleString("it-IT")} m² warehouse` : "Warehousing"}
            />
          )}
          {employeeCount !== null && <Metric icon={Users} label={`${employeeCount.toLocaleString("it-IT")} dipendenti`} />}
          {foundingYear !== null && <Metric icon={Calendar} label={`Dal ${foundingYear}`} />}
          {fleetDetails && <Metric icon={Truck} label={fleetDetails} />}
        </div>
      )}

      {/* Row 4 — geografia (paesi con RUOLO) */}
      {(markets.length > 0 || branchCountries.length > 0) && (
        <div className="border-t border-primary/10 pt-2">
          <div className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/80 mb-1 flex items-center gap-1">
            <Globe2 className="h-3 w-3" /> Presenza geografica
          </div>
          <div className="flex flex-wrap gap-1.5">
            {branchCountries.slice(0, 8).map((country) => (
              <CountryChip key={`b-${country.code}`} code={country.code} label={country.name} role="Filiale" tone="branch" />
            ))}
            {markets.map((market) => (
              <CountryChip key={`m-${market}`} code={countryCodeFromLabel(market)} label={market} role="Mercato" tone="market" />
            ))}
          </div>
        </div>
      )}

      {/* Row 5 — rotte principali */}
      {routes.length > 0 && (
        <div>
          <div className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/80 mb-1 flex items-center gap-1">
            <MapPin className="h-3 w-3" /> Rotte principali
          </div>
          <div className="flex flex-wrap gap-1.5">
            {routes.map((route, index) => {
              const from = route.from || route.origin || "";
              const to = route.to || route.destination || "";
              const fromCode = countryCodeFromLabel(from);
              const toCode = countryCodeFromLabel(to);
              return (
                <span key={`${from}-${to}-${index}`} className="inline-flex items-center gap-1.5 rounded-md border border-primary/15 bg-card/60 px-2 py-1 text-[10px] text-foreground/85">
                  <span className="text-sm leading-none">{fromCode ? getCountryFlag(fromCode) : "🌍"}</span>
                  <span className="max-w-[7rem] truncate text-foreground/70">{from || "—"}</span>
                  <ArrowRight className="h-3 w-3 text-primary shrink-0" strokeWidth={1.8} />
                  <span className="text-sm leading-none">{toCode ? getCountryFlag(toCode) : "🌍"}</span>
                  <span className="max-w-[7rem] truncate text-foreground/70">{to || "—"}</span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Row 6 — network di appartenenza (loghi orizzontali) */}
      {networks.length > 0 && (
        <div className="border-t border-primary/10 pt-2">
          <div className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/80 mb-1 flex items-center gap-1">
            <Building className="h-3 w-3" /> Network ({networks.length})
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {networks.map((n) => (
              <NetworkBadge key={n.id} name={n.network_name} />
            ))}
          </div>
        </div>
      )}

      {warehouseDetails && (
        <div className="flex flex-col gap-1 border-t border-primary/10 pt-2 text-[10px] leading-relaxed text-muted-foreground">
          <span><Building2 className="mr-1 inline h-3 w-3 text-primary" />{warehouseDetails}</span>
        </div>
      )}
    </div>
  );
}

function CountryChip({
  code, label, role, tone,
}: {
  readonly code: string | null;
  readonly label: string;
  readonly role: "Filiale" | "Mercato" | "Hub";
  readonly tone: "branch" | "market";
}): React.ReactElement {
  const toneClasses = tone === "branch"
    ? "border-primary/35 bg-primary/10 text-foreground"
    : "border-primary/15 bg-card/60 text-foreground/85";
  const roleClasses = tone === "branch"
    ? "bg-primary/25 text-primary-foreground"
    : "bg-muted/60 text-muted-foreground";
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md border px-1.5 py-1 text-[10px] font-medium", toneClasses)} title={`${role} · ${label}`}>
      <span className="text-sm leading-none">{code ? getCountryFlag(code) : "🌍"}</span>
      <span className="max-w-[7rem] truncate">{label}</span>
      <span className={cn("rounded px-1 py-0 text-[8px] font-bold uppercase tracking-wider", roleClasses)}>{role}</span>
    </span>
  );
}

function NetworkBadge({ name }: { readonly name: string }): React.ReactElement {
  // Estrae acronimo riconoscibile (es. "WCA Pharma" → "WCA")
  const initials = name
    .split(/[\s.-]+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 4)
    .toUpperCase();
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-gradient-to-br from-primary/15 to-primary/5 pl-1 pr-2 py-0.5 text-[10px] font-medium text-foreground" title={name}>
      <span className="inline-flex items-center justify-center h-5 min-w-[1.25rem] rounded bg-primary/80 px-1 text-[9px] font-extrabold tracking-tight text-primary-foreground">
        {initials}
      </span>
      <span className="max-w-[10rem] truncate">{name}</span>
    </span>
  );
}

function Metric({ icon: Icon, label, className }: { readonly icon: React.ElementType; readonly label: string; readonly className?: string }): React.ReactElement {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md border border-primary/15 bg-card/60 px-2 py-1 text-[10px] font-medium text-foreground/85", className)}>
      <Icon className="h-3.5 w-3.5 text-primary" strokeWidth={1.6} />
      {label}
    </span>
  );
}