/**
 * Coda di invio — maschera Lista. "Cosa è in coda e cosa si è bloccato?"
 * Legge `email_campaign_queue`. Sola lettura.
 */
import * as React from "react";
import { ChevronLeft, ChevronRight, ListChecks, Loader2, RefreshCw } from "lucide-react";
import { PageFrame } from "@/v3/app/PageFrame";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { useCoda } from "../useCoda";

function RailGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function dataOra(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function CodaPage(): React.ReactElement {
  const {
    righe,
    totale,
    pagina,
    pagineTotali,
    isLoading,
    isFetching,
    error,
    statiDisponibili,
    stato,
    setStato,
    soloErrori,
    setSoloErrori,
    selezionata,
    seleziona,
    vaiA,
    azzeraFiltri,
    refetch,
  } = useCoda();

  const filters = (
    <>
      <RailGroup label="Stato">
        <div className="flex flex-wrap gap-1">
          <Button
            variant={stato === null ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setStato(null)}
          >
            Tutti
          </Button>
          {statiDisponibili.map((item) => (
            <Button
              key={item.stato}
              variant={stato === item.stato ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setStato(item.stato)}
            >
              {item.stato} ({item.conteggio})
            </Button>
          ))}
        </div>
      </RailGroup>

      <RailGroup label="Errore">
        <Button
          variant={soloErrori ? "secondary" : "ghost"}
          size="sm"
          className="h-7 w-full justify-start px-2 text-xs"
          onClick={() => setSoloErrori(!soloErrori)}
        >
          Solo con errore
        </Button>
      </RailGroup>

      <Button variant="ghost" size="sm" className="h-7 w-full px-2 text-xs" onClick={azzeraFiltri}>
        Azzera filtri
      </Button>
    </>
  );

  const workflow = (
    <>
      <RailGroup label="Azioni">
        <Button variant="outline" size="sm" className="h-8 w-full justify-start text-xs" disabled>
          Riprova
        </Button>
        <Button variant="outline" size="sm" className="h-8 w-full justify-start text-xs" disabled>
          Annulla
        </Button>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Riprova e annullamento agiscono sulla pipeline di invio: restano dove sono finché non innestiamo «Scrivi».
        </p>
      </RailGroup>

      <RailGroup label="Coda">
        <p className="text-xs text-muted-foreground">{totale.toLocaleString("it-IT")} righe con questi filtri</p>
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs" onClick={refetch}>
          <RefreshCw className="h-3.5 w-3.5" />
          Aggiorna
        </Button>
      </RailGroup>
    </>
  );

  const toolbar = (
    <>
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <ListChecks className="h-3.5 w-3.5" />
        {isLoading ? "…" : `${totale.toLocaleString("it-IT")} in coda`}
      </span>
      {isFetching && !isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      <div className="ml-auto flex items-center gap-1">
        <span className="text-xs text-muted-foreground">
          Pagina {pagina + 1} di {pagineTotali}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="Pagina precedente"
          disabled={pagina === 0}
          onClick={() => vaiA(pagina - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="Pagina successiva"
          disabled={pagina + 1 >= pagineTotali}
          onClick={() => vaiA(pagina + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </>
  );

  return (
    <PageFrame pageId="coda" filters={filters} workflow={workflow} toolbar={toolbar}>
      {isLoading ? (
        <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Caricamento coda…
        </div>
      ) : error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Impossibile caricare la coda: {error.message}
        </div>
      ) : righe.length === 0 ? (
        <div className="rounded-md border border-border p-6 text-center text-sm text-muted-foreground">
          Nessuna riga in coda con questi filtri.
        </div>
      ) : (
        <ul className="space-y-2">
          {righe.map((riga) => {
            const attiva = riga.id === selezionata;
            return (
              <li key={riga.id}>
                <button
                  type="button"
                  onClick={() => seleziona(attiva ? null : riga.id)}
                  className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                    attiva ? "border-primary bg-muted/60" : "border-border hover:bg-muted/40"
                  } ${riga.errore ? "border-destructive/40" : ""}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={riga.errore ? "destructive" : "outline"} className="text-[11px]">
                      {riga.stato}
                    </Badge>
                    {riga.tentativi > 0 && (
                      <Badge variant="secondary" className="text-[11px]">
                        {riga.tentativi} tentativi
                      </Badge>
                    )}
                    {riga.aperture > 0 && (
                      <Badge variant="secondary" className="text-[11px]">
                        {riga.aperture} aperture
                      </Badge>
                    )}
                    <span className="ml-auto text-[11px] text-muted-foreground">
                      {riga.inviatoIl ? `inviata ${dataOra(riga.inviatoIl)}` : `in coda dal ${dataOra(riga.creatoIl)}`}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm font-medium text-foreground">
                    {riga.destinatario ?? "destinatario non indicato"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{riga.oggetto ?? "senza oggetto"}</p>
                  {riga.errore && (
                    <p className={`mt-1 text-xs text-destructive ${attiva ? "" : "line-clamp-1"}`}>{riga.errore}</p>
                  )}
                  {attiva && riga.programmatoIl && (
                    <p className="mt-1 text-xs text-muted-foreground">Programmata per {dataOra(riga.programmatoIl)}</p>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </PageFrame>
  );
}

export default CodaPage;
