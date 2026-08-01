/**
 * EnrichmentSettingsTab — Enrichment counts by source
 */
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchEnrichmentSourceCounts } from "@/application/data/enrichmentSourceCounts";
import { FormSection } from "../../organisms/FormSection";
import { Loader2 } from "lucide-react";
import { queryKeys } from "@/lib/queryKeys";

interface SourceCount {
  readonly label: string;
  readonly count: number;
  readonly color: string;
}

export function EnrichmentSettingsTab(): React.ReactElement {
  const { data: counts, isLoading } = useQuery({
    queryKey: queryKeys.v2.enrichmentCounts,
    queryFn: async () => {
      const counts = await fetchEnrichmentSourceCounts();

      return [
        { label: "WCA Partners", count: counts.partners, color: "bg-blue-500" },
        { label: "Contatti", count: counts.contacts, color: "bg-emerald-500" },
        { label: "Email", count: counts.emails, color: "bg-amber-500" },
        { label: "Business Cards", count: counts.businessCards, color: "bg-violet-500" },
      ] as SourceCount[];
    },
  });

  return (
    <div className="space-y-6">
      <FormSection title="Arricchimento Dati" description="Conteggi per sorgente dati.">
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {counts?.map((source) => (
              <div key={source.label} className="flex items-center gap-3 p-3 rounded-md border">
                <div className={`w-2.5 h-2.5 rounded-full ${source.color}`} />
                <div>
                  <p className="text-sm font-medium text-foreground">{source.count.toLocaleString("it-IT")}</p>
                  <p className="text-xs text-muted-foreground">{source.label}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </FormSection>
    </div>
  );
}
