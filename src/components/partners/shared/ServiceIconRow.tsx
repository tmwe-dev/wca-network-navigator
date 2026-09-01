/**
 * ServiceIconRow — riga di icone dei servizi svolti dall'azienda.
 * Unisce i servizi anagrafici (`partner_services`) e quelli emersi
 * dall'arricchimento, mostrandoli come icone allineate a sinistra.
 */
import * as React from "react";
import { formatServiceCategory } from "@/lib/countries";
import { resolveServiceIcon } from "@/components/partners/shared/ServiceIcons";
import { cn } from "@/lib/utils";

export interface ServiceIconRowProps {
  readonly services?: ReadonlyArray<{ service_category: string }> | null;
  readonly enrichment?: Record<string, unknown> | null;
  readonly max?: number;
  readonly className?: string;
}

export function serviceLabelsOf(
  services?: ReadonlyArray<{ service_category: string }> | null,
  enrichment?: Record<string, unknown> | null,
  max = 12,
): string[] {
  const extra = [
    ...(Array.isArray(enrichment?.additional_services) ? (enrichment!.additional_services as unknown[]) : []),
    ...(Array.isArray((enrichment?.company_profile as Record<string, unknown> | undefined)?.specialties)
      ? (((enrichment!.company_profile as Record<string, unknown>).specialties as unknown[]) ?? [])
      : []),
  ].filter((s): s is string => typeof s === "string" && s.trim().length > 0);

  return [...new Set([...(services ?? []).map((s) => s.service_category), ...extra])].slice(0, max);
}

export function ServiceIconRow({
  services,
  enrichment,
  max = 12,
  className,
}: ServiceIconRowProps): React.ReactElement | null {
  const labels = serviceLabelsOf(services, enrichment, max);
  if (labels.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {labels.map((label) => {
        const Icon = resolveServiceIcon(label);
        return (
          <span
            key={label}
            title={formatServiceCategory(label)}
            aria-label={formatServiceCategory(label)}
            className="inline-flex items-center justify-center h-7 w-7 rounded-md border border-primary/20 bg-card/70 hover:bg-primary/10 transition-colors cursor-help"
          >
            <Icon className="h-4 w-4 text-primary" strokeWidth={1.6} />
          </span>
        );
      })}
    </div>
  );
}

export default ServiceIconRow;
