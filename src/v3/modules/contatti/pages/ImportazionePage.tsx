/**
 * Import — maschera Operativa. "Cosa sto caricando?"
 *
 * Storico dei file importati (import_logs) con stato, righe importate ed
 * errori. Il rilancio dell'elaborazione AI parte da qui; il caricamento di
 * nuovi file resta nella superficie V2 dedicata finché il flusso di mappatura
 * campi non viene innestato in V3.
 */
import * as React from "react";
import { ChevronLeft, ChevronRight, FileUp, Loader2, Play, RefreshCw } from "lucide-react";
import { PageFrame } from "@/v3/app/PageFrame";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useImportazione, V3_STATI_IMPORT } from "../useImportazione";

const ETICHETTA_STATO: Record<string, string> = {
  pending: "In attesa",
  processing: "In elaborazione",
  completed: "Completato",
  failed: "Fallito",
};

function dataOra(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function BadgeStato({ stato }: { readonly stato: string }) {
  const variant = stato === "completed" ? "default" : stato === "failed" ? "destructive" : "secondary";
  return <Badge variant={variant}>{ETICHETTA_STATO[stato] ?? stato}</Badge>;
}

export function ImportazionePage(): React.ReactElement {
  const {
    righe,
    totale,
    pagina,
    pagineTotali,
    isLoading,
    isFetching,
    error,
    stato,
    setStato,
    processa,
    isProcessando,
    erroreProcessazione,
    vaiA,
    refetch,
  } = useImportazione();

  return (
    <PageFrame
      pageId="importazione"
      actions={
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs" onClick={refetch} disabled={isFetching}>
          <RefreshCw className={isFetching ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
          Aggiorna
        </Button>
      }
      filters={
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-muted-foreground">Stato</p>
          <div className="space-y-0.5">
            <button
              type="button"
              onClick={() => setStato(null)}
              className={`w-full rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                stato === null ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/60"
              }`}
            >
              Tutti
            </button>
            {V3_STATI_IMPORT.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStato(s)}
                className={`w-full rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                  stato === s ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/60"
                }`}
              >
                {ETICHETTA_STATO[s] ?? s}
              </button>
            ))}
          </div>
        </div>
      }
      workflow={
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-muted-foreground">Caricamento</p>
          <p className="px-0.5 text-[11px] leading-relaxed text-muted-foreground/80">
            Il caricamento di nuovi file CSV / biglietti da visita resta nella superficie dedicata della versione
            precedente. Qui governi ciò che è già entrato: stato, errori, rilancio.
          </p>
        </div>
      }
    >
      <div className="space-y-2">
        {erroreProcessazione && (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {erroreProcessazione}
          </p>
        )}
        {error && (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error.message}
          </p>
        )}
        {isLoading && (
          <div className="flex items-center gap-2 px-1 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Caricamento storico import…
          </div>
        )}
        {!isLoading && righe.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <FileUp className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nessun import in questo stato.</p>
          </div>
        )}

        {righe.map((riga) => {
          const avanzamento =
            riga.batchTotali > 0 ? `${riga.batch}/${riga.batchTotali} batch` : null;
          return (
            <div
              key={riga.id}
              className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-foreground">{riga.nomeFile}</p>
                  <BadgeStato stato={riga.stato} />
                  {riga.gruppo && (
                    <Badge variant="outline" className="text-[10px]">
                      {riga.gruppo}
                    </Badge>
                  )}
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {riga.righeImportate} importate · {riga.righeErrore} errori · {riga.righeTotali} totali
                  {avanzamento ? ` · ${avanzamento}` : ""} · {dataOra(riga.creatoIl)}
                </p>
              </div>
              {(riga.stato === "pending" || riga.stato === "failed" || riga.stato === "processing") && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 shrink-0 gap-1.5 px-2 text-xs"
                  disabled={isProcessando}
                  onClick={() => processa(riga.id)}
                >
                  {isProcessando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                  Elabora
                </Button>
              )}
            </div>
          );
        })}

        {pagineTotali > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">
              {totale} import · pagina {pagina + 1} di {pagineTotali}
            </p>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" className="h-7 w-7" disabled={pagina === 0} onClick={() => vaiA(pagina - 1)}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                disabled={pagina >= pagineTotali - 1}
                onClick={() => vaiA(pagina + 1)}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </PageFrame>
  );
}

export default ImportazionePage;
