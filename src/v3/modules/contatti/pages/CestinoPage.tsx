/**
 * Cestino — maschera Lista. "Cosa ho eliminato?"
 *
 * Legge le righe soft-deleted tramite la RPC dedicata (le policy RLS le
 * nascondono alle query dirette). Il ripristino è disponibile per aziende e
 * contatti; i messaggi eliminati sono in sola lettura.
 */
import * as React from "react";
import { Building2, Loader2, Mail, RefreshCw, Trash2, Undo2, User } from "lucide-react";
import { PageFrame } from "@/v3/app/PageFrame";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCestino } from "../useCestino";
import type { V3TipoEliminato } from "@/v3/modules/contatti/useCestino";

const OPZIONI_TIPO: readonly { readonly value: V3TipoEliminato; readonly label: string }[] = [
  { value: "partner", label: "Aziende" },
  { value: "contatto", label: "Contatti" },
  { value: "messaggio", label: "Messaggi" },
];

function dataOra(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function IconaTipo({ tipo }: { readonly tipo: V3TipoEliminato }) {
  if (tipo === "partner") return <Building2 className="h-3.5 w-3.5 text-muted-foreground" />;
  if (tipo === "contatto") return <User className="h-3.5 w-3.5 text-muted-foreground" />;
  return <Mail className="h-3.5 w-3.5 text-muted-foreground" />;
}

export function CestinoPage(): React.ReactElement {
  const { righe, isLoading, isFetching, error, tipo, setTipo, ripristina, isRipristinando, erroreRipristino, refetch } =
    useCestino();

  return (
    <PageFrame
      pageId="cestino"
      actions={
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs" onClick={refetch} disabled={isFetching}>
          <RefreshCw className={isFetching ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
          Aggiorna
        </Button>
      }
      filters={
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-muted-foreground">Tipo</p>
          <div className="space-y-0.5">
            <button
              type="button"
              onClick={() => setTipo(null)}
              className={`w-full rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                tipo === null ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/60"
              }`}
            >
              Tutto
            </button>
            {OPZIONI_TIPO.map((opzione) => (
              <button
                key={opzione.value}
                type="button"
                onClick={() => setTipo(opzione.value)}
                className={`w-full rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                  tipo === opzione.value
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted/60"
                }`}
              >
                {opzione.label}
              </button>
            ))}
          </div>
          <p className="px-0.5 pt-2 text-[11px] text-muted-foreground/80">Ultimi 90 giorni, massimo 200 elementi.</p>
        </div>
      }
      workflow={
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-muted-foreground">Ripristino</p>
          <p className="px-0.5 text-[11px] leading-relaxed text-muted-foreground/80">
            Aziende e contatti tornano attivi con un tocco. I messaggi eliminati restano visibili ma non sono
            ripristinabili da questa maschera.
          </p>
        </div>
      }
    >
      <div className="space-y-2">
        {erroreRipristino && (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {erroreRipristino}
          </p>
        )}
        {error && (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error.message}
          </p>
        )}
        {isLoading && (
          <div className="flex items-center gap-2 px-1 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Caricamento elementi eliminati…
          </div>
        )}
        {!isLoading && righe.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Trash2 className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Il cestino è vuoto per questo filtro.</p>
          </div>
        )}

        {righe.map((riga) => (
          <div key={`${riga.tipo}-${riga.id}`} className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2">
            <IconaTipo tipo={riga.tipo} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{riga.nome}</p>
              <p className="truncate text-xs text-muted-foreground">
                {riga.dettaglio ? `${riga.dettaglio} · ` : ""}eliminato il {dataOra(riga.eliminatoIl)}
              </p>
            </div>
            <Badge variant="outline" className="shrink-0 text-[10px]">
              {OPZIONI_TIPO.find((o) => o.value === riga.tipo)?.label ?? riga.tipo}
            </Badge>
            {riga.tipo !== "messaggio" && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 shrink-0 gap-1.5 px-2 text-xs"
                disabled={isRipristinando}
                onClick={() => ripristina(riga)}
              >
                {isRipristinando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}
                Ripristina
              </Button>
            )}
          </div>
        ))}
      </div>
    </PageFrame>
  );
}

export default CestinoPage;
