import { cn } from "@/lib/utils";
import { useUnifiedEnrichmentSnapshot } from "@/hooks/useUnifiedEnrichmentSnapshot";

interface Row {
  on: boolean;
  label: string;
  age: number | null;
}

function EnrichmentRow({ on, label, age }: Row) {
  return (
    <div className="flex items-center gap-1 text-[10px] leading-tight">
      <span
        className={cn(
          "shrink-0 w-3 text-center",
          on ? "text-success" : "text-muted-foreground/50"
        )}
      >
        {on ? "✓" : "○"}
      </span>
      <span className={on ? "text-foreground/80" : "text-muted-foreground"}>
        {label}
      </span>
      {age !== null && (
        <span className="text-muted-foreground/60 ml-auto pl-1">{age}gg fa</span>
      )}
    </div>
  );
}

export default function EnrichmentStatusBadges({
  partnerId,
}: {
  partnerId: string | null;
}) {
  const { data: snapshot, isLoading } = useUnifiedEnrichmentSnapshot(partnerId);

  if (!partnerId || isLoading || !snapshot) return null;

  const noData =
    !snapshot.base.available &&
    !snapshot.deep.available &&
    !snapshot.sherlock.available;

  return (
    <div className="rounded-md border border-border/60 bg-muted/20 px-2 py-1.5 space-y-1">
      <div className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground/80 mb-0.5">
        Dati disponibili
      </div>
      <EnrichmentRow
        on={snapshot.base.available}
        label={`Base: ${
          snapshot.base.available
            ? snapshot.base.fields.join(", ")
            : "non eseguito"
        }`}
        age={snapshot.base.age_days}
      />
      <EnrichmentRow
        on={snapshot.deep.available}
        label={`Deep: ${
          snapshot.deep.available
            ? snapshot.deep.fields.join(", ")
            : "mai eseguito"
        }`}
        age={snapshot.deep.age_days}
      />
      <EnrichmentRow
        on={snapshot.sherlock.available}
        label={`Sherlock: ${
          snapshot.sherlock.available ? `Lv ${snapshot.sherlock.level}` : "mai eseguito"
        }`}
        age={snapshot.sherlock.age_days}
      />
      {noData && (
        <div className="mt-1 pt-1 border-t border-border/30 text-[10px] text-warning-foreground/90 flex items-start gap-1">
          <span className="shrink-0">💡</span>
          <span>
            Esegui prima l'arricchimento da Settings → Arricchimento
          </span>
        </div>
      )}
    </div>
  );
}
