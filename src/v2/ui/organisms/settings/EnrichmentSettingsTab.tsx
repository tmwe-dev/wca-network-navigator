/**
 * EnrichmentSettingsTab — Enrichment counts by source
 */
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FormSection } from "../../organisms/FormSection";
import { Loader2 } from "lucide-react";

interface SourceCount {
  readonly label: string;
  readonly count: number;
  readonly color: string;
}

export function EnrichmentSettingsTab(): React.ReactElement {
  const { data: counts, isLoading } = useQuery({
    queryKey: ["v2-enrichment-counts"],
    queryFn: async () => {
      const [partners, contacts, emails, bca] = await Promise.all([
        supabase.from("partners").select("id", { count: "exact", head: true }),
        supabase.from("imported_contacts").select("id", { count: "exact", head: true }),
        supabase.from("channel_messages").select("id", { count: "exact", head: true }).eq("channel", "email"),
        supabase.from("business_cards").select("id", { count: "exact", head: true }),
      ]);

      return [
        { label: "WCA Partners", count: partners.count ?? 0, color: "bg-blue-500" },
        { label: "Contatti", count: contacts.count ?? 0, color: "bg-emerald-500" },
        { label: "Email", count: emails.count ?? 0, color: "bg-amber-500" },
        { label: "Business Cards", count: bca.count ?? 0, color: "bg-violet-500" },
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
