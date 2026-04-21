/**
 * EnrichmentExtraInfo — LOVABLE-75
 * Icona info read-only che mostra in popover lo stato Deep Search e Sherlock
 * per un partner direttamente dalla lista Settings → Arricchimento.
 * NON lancia ricerche — solo lettura.
 */
import * as React from "react";
import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useUnifiedEnrichmentSnapshot } from "@/hooks/useUnifiedEnrichmentSnapshot";

interface Props {
  readonly partnerId: string;
}

export function EnrichmentExtraInfo({ partnerId }: Props): React.ReactElement | null {
  const { data: snapshot } = useUnifiedEnrichmentSnapshot(partnerId);
  if (!snapshot) return null;
  if (!snapshot.deep.available && !snapshot.sherlock.available) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="p-0.5 rounded hover:bg-accent transition-colors"
          title="Dati avanzati disponibili"
          onClick={(e) => e.stopPropagation()}
        >
          <Info className="w-3.5 h-3.5 text-primary" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-64 text-xs space-y-1.5"
        onClick={(e) => e.stopPropagation()}
      >
        {snapshot.deep.available && (
          <p className="text-foreground">
            🔍 <span className="font-semibold">Deep Search:</span>{" "}
            {snapshot.deep.fields.join(", ")}
            {snapshot.deep.age_days !== null && (
              <span className="text-muted-foreground"> ({snapshot.deep.age_days} gg fa)</span>
            )}
          </p>
        )}
        {snapshot.sherlock.available && (
          <p className="text-foreground">
            🕵️ <span className="font-semibold">Sherlock</span>
            {snapshot.sherlock.level && ` Lv${snapshot.sherlock.level}`}
            {snapshot.sherlock.age_days !== null && (
              <span className="text-muted-foreground"> ({snapshot.sherlock.age_days} gg fa)</span>
            )}
          </p>
        )}
        <p className="text-xs text-foreground/70 italic pt-1 border-t border-border">
          Sola lettura — Deep Search e Sherlock si eseguono da Email Forge.
        </p>
      </PopoverContent>
    </Popover>
  );
}