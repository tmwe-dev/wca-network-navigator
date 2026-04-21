/**
 * EnrichmentStatusInline — LOVABLE-77B
 *
 * Mostra in 3 righe lo stato dei dati di arricchimento per il partner selezionato.
 * Visibile sopra la CTA "Genera" così l'utente sa cosa l'AI ha a disposizione.
 */
import * as React from "react";
import { useUnifiedEnrichmentSnapshot } from "@/hooks/useUnifiedEnrichmentSnapshot";
import { Check, Circle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  partnerId: string | null | undefined;
}

function StatusRow({
  ok, label, age,
}: { ok: boolean; label: string; age: number | null }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      {ok ? (
        <Check className="w-3 h-3 text-primary shrink-0" />
      ) : (
        <Circle className="w-3 h-3 text-muted-foreground shrink-0" />
      )}
      <span className={cn("flex-1 truncate", ok ? "text-foreground" : "text-muted-foreground")}>
        {label}
      </span>
      {ok && age !== null && (
        <span className="text-muted-foreground/70 text-[10px] shrink-0">
          {age === 0 ? "oggi" : `${age}gg fa`}
        </span>
      )}
    </div>
  );
}

export function EnrichmentStatusInline({ partnerId }: Props): React.ReactElement | null {
  const { data: snap, isLoading } = useUnifiedEnrichmentSnapshot(partnerId);

  if (!partnerId) return null;
  if (isLoading || !snap) {
    return (
      <div className="rounded-md border border-border/40 bg-muted/20 px-2.5 py-2 text-xs text-muted-foreground">
        Verifica dati arricchimento…
      </div>
    );
  }

  const noData = !snap.base.available && !snap.deep.available && !snap.sherlock.available;

  return (
    <div className="rounded-md border border-border/40 bg-muted/20 px-2.5 py-2 space-y-1">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground/80 font-medium">
        Dati disponibili per l'AI
      </div>
      <StatusRow
        ok={snap.base.available}
        label={snap.base.available ? `Base: ${snap.base.fields.join(", ")}` : "Base: non eseguito"}
        age={snap.base.age_days}
      />
      <StatusRow
        ok={snap.deep.available}
        label={snap.deep.available ? `Deep: ${snap.deep.fields.join(", ")}` : "Deep Search: mai eseguito"}
        age={snap.deep.age_days}
      />
      <StatusRow
        ok={snap.sherlock.available}
        label={snap.sherlock.available ? `Sherlock${snap.sherlock.level ? ` Lv${snap.sherlock.level}` : ""}` : "Sherlock: mai eseguito"}
        age={snap.sherlock.age_days}
      />
      {noData && (
        <div className="flex items-start gap-1.5 mt-1.5 pt-1.5 border-t border-border/40">
          <AlertTriangle className="w-3 h-3 text-destructive shrink-0 mt-0.5" />
          <p className="text-[11px] text-destructive leading-snug">
            Nessun dato arricchimento. L'email sarà generica. Esegui Base da Settings → Arricchimento.
          </p>
        </div>
      )}
    </div>
  );
}