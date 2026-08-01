/**
 * EnrichmentBadge — Mostra a colpo d'occhio il livello di "indagine" su un partner.
 *
 * Priorità (mostra il badge più alto + pallini per gli altri compresenti):
 *   1. Deep Search   → enrichment_data.deep_search_at  (icona Brain, primary)
 *   2. Arricchito    → enriched_at                     (icona Sparkles, emerald)
 *
 * NB: Il livello Sherlock viene mostrato a parte tramite <SherlockLevelBadge>
 * perché richiede un hook async dedicato (useSherlockLevel).
 */
import * as React from "react";
import { Brain, Sparkles } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface PartnerLikeForBadge {
  enriched_at?: string | null;
  enrichment_data?: unknown;
}

type Variant = "icon" | "pill";

interface Props {
  partner: PartnerLikeForBadge;
  variant?: Variant;
  className?: string;
}

function safeDate(d: string | null | undefined): string {
  if (!d) return "";
  try {
    return format(new Date(d), "d MMM yyyy", { locale: it });
  } catch {
    return "";
  }
}

export function EnrichmentBadge({ partner, variant = "icon", className }: Props): React.ReactElement | null {
  const enrichment = (partner.enrichment_data && typeof partner.enrichment_data === "object")
    ? (partner.enrichment_data as Record<string, unknown>)
    : null;
  const deepSearchAt = enrichment && typeof enrichment.deep_search_at === "string" ? enrichment.deep_search_at : null;
  const enrichedAt = partner.enriched_at ?? null;

  if (!deepSearchAt && !enrichedAt) return null;

  // Deep Search vince come badge principale
  if (deepSearchAt) {
    if (variant === "pill") {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={cn(
              "inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30 font-medium",
              className,
            )}>
              <Brain className="w-3 h-3" />
              Deep Search
              {enrichedAt && <Sparkles className="w-2.5 h-2.5 text-emerald-500" />}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            Deep Search — {safeDate(deepSearchAt)}
            {enrichedAt && <div className="text-[10px] opacity-80">+ Arricchito {safeDate(enrichedAt)}</div>}
          </TooltipContent>
        </Tooltip>
      );
    }
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn("inline-flex items-center", className)}>
            <Brain className="w-4 h-4 text-primary drop-shadow-[0_0_3px_hsl(var(--primary)/0.4)]" />
            {enrichedAt && <Sparkles className="w-2.5 h-2.5 text-emerald-500 -ml-0.5" />}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          Deep Search — {safeDate(deepSearchAt)}
          {enrichedAt && <div className="text-[10px] opacity-80">+ Arricchito {safeDate(enrichedAt)}</div>}
        </TooltipContent>
      </Tooltip>
    );
  }

  // Solo arricchimento
  if (variant === "pill") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn(
            "inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-medium",
            className,
          )}>
            <Sparkles className="w-3 h-3" /> Arricchito
          </span>
        </TooltipTrigger>
        <TooltipContent>Arricchito AI — {safeDate(enrichedAt)}</TooltipContent>
      </Tooltip>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("inline-flex items-center", className)}>
          <Sparkles className="w-4 h-4 text-emerald-500 drop-shadow-[0_0_3px_rgba(16,185,129,0.4)]" />
        </span>
      </TooltipTrigger>
      <TooltipContent>Arricchito AI — {safeDate(enrichedAt)}</TooltipContent>
    </Tooltip>
  );
}