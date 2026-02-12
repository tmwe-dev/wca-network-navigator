import { Sparkles } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface EnrichmentCardProps {
  partner: {
    id: string;
    enriched_at?: string | null;
    enrichment_data?: any;
    ai_parsed_at?: string | null;
  };
}

export function EnrichmentCard({ partner }: EnrichmentCardProps) {
  if (!partner.enriched_at && !partner.ai_parsed_at) return null;

  return (
    <div className="bg-gradient-to-br from-violet-500/5 via-card to-purple-500/5 backdrop-blur-sm border border-violet-500/10 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-violet-400" />
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Enrichment</p>
      </div>
      <div className="space-y-2 text-sm text-muted-foreground">
        {partner.enriched_at && (
          <p>
            🌐 Website analizzato:{" "}
            {format(new Date(partner.enriched_at), "dd MMM yyyy", { locale: it })}
          </p>
        )}
        {partner.ai_parsed_at && (
          <p>
            🤖 AI parsing:{" "}
            {format(new Date(partner.ai_parsed_at), "dd MMM yyyy", { locale: it })}
          </p>
        )}
        {partner.enrichment_data && typeof partner.enrichment_data === "object" && (
          <div className="mt-2 text-xs space-y-1">
            {(partner.enrichment_data as any).description && (
              <p className="text-foreground/80">{(partner.enrichment_data as any).description}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
