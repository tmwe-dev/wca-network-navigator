/**
 * Campagne — maschera Lista. "Cosa sta partendo e quando?"
 * Lotti reali ricavati da `campaign_batch_id` sulle attività. Sola lettura.
 */
import * as React from "react";
import { Loader2, RefreshCw, Send } from "lucide-react";
import { PageFrame } from "@/v3/app/PageFrame";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { useCampagne, V3_PERIODI_CAMPAGNE } from "../useCampagne";

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

export function CampagnePage(): React.ReactElement {
  const {
    righe,
    totaleMessaggi,
    totaleInviati,
    totaleRisposte,
    isLoading,
    isFetching,
    error,
    giorni,
    setGiorni,
    selezionata,
    seleziona,
    refetch,
  } = useCampagne();

  const filters = (
    <>
      <RailGroup label="Periodo">
        <div className="flex flex-wrap gap-1">
          {V3_PERIODI_CAMPAGNE.map((value) => (
            <Button
              key={value}
              variant={giorni === value ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setGiorni(value)}
            >
              {value} giorni
            </Button>
          ))}
        </div>
      </RailGroup>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Campione: le 2.000 attività più recenti che dichiarano un lotto di campagna.
      </p>
    </>
  );

  const workflow = (
    <>
      <RailGroup label="Azioni">
        <Button variant="outline" size="sm" className="h-8 w-full justify-start text-xs" disabled>
          Avvia
        </Button>
        <Button variant="outline" size="sm" className="h-8 w-full justify-start text-xs" disabled>
          Sospendi
        </Button>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Avvio e sospensione toccano la pipeline di invio: restano nella versione attuale finché non innestiamo «Scrivi».
        </p>
      </RailGroup>

      <RailGroup label="Sintesi periodo">
        <p className="text-xs text-muted-foreground">{righe.length} lotti</p>
        <p className="text-xs text-muted-foreground">{totaleInviati.toLocaleString("it-IT")} inviate su {totaleMessaggi.toLocaleString("it-IT")}</p>
        <p className="text-xs text-muted-foreground">{totaleRisposte.toLocaleString("it-IT")} con risposta</p>
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
        <Send className="h-3.5 w-3.5" />
        {isLoading ? "…" : `${righe.length} lotti`}
      </span>
      {isFetching && !isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
    </>
  );

  return (
    <PageFrame pageId="campagne" filters={filters} workflow={workflow} toolbar={toolbar}>
      {isLoading ? (
        <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Caricamento campagne…
        </div>
      ) : error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Impossibile caricare le campagne: {error.message}
        </div>
      ) : righe.length === 0 ? (
        <div className="rounded-md border border-border p-6 text-center text-sm text-muted-foreground">
          Nessun lotto di campagna nel periodo.
        </div>
      ) : (
        <ul className="space-y-2">
          {righe.map((riga) => {
            const attiva = riga.lotto === selezionata;
            const tassoRisposta = riga.inviate > 0 ? Math.round((riga.conRisposta / riga.inviate) * 100) : 0;
            return (
              <li key={riga.lotto}>
                <button
                  type="button"
                  onClick={() => seleziona(attiva ? null : riga.lotto)}
                  className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                    attiva ? "border-primary bg-muted/60" : "border-border hover:bg-muted/40"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium text-foreground">{riga.lotto}</span>
                    <Badge variant="secondary" className="text-[11px]">
                      {riga.inviate}/{riga.totale} inviate
                    </Badge>
                    <Badge variant="outline" className="text-[11px]">
                      {tassoRisposta}% risposte
                    </Badge>
                    <span className="ml-auto text-[11px] text-muted-foreground">{dataOra(riga.ultimoInvio)}</span>
                  </div>
                  {attiva && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Primo invio {dataOra(riga.primoInvio)} · ultimo invio {dataOra(riga.ultimoInvio)} ·{" "}
                      {riga.conRisposta} risposte su {riga.inviate} messaggi partiti
                    </p>
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

export default CampagnePage;
