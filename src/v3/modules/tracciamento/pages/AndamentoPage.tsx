/**
 * Andamento — maschera Lista. "Sta funzionando?"
 * Volumi in/out, risposte e attività nel periodo. Sola lettura.
 */
import * as React from "react";
import { Activity, Loader2, RefreshCw } from "lucide-react";
import { PageFrame } from "@/v3/app/PageFrame";
import { Button } from "@/components/ui/button";

import { useAndamento, V3_PERIODI_ANDAMENTO } from "../useAndamento";

function RailGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function Metrica({ titolo, valore, nota }: { titolo: string; valore: string; nota?: string }) {
  return (
    <div className="rounded-md border border-border px-3 py-3">
      <p className="text-xs text-muted-foreground">{titolo}</p>
      <p className="mt-1 text-xl font-semibold text-foreground">{valore}</p>
      {nota && <p className="mt-0.5 text-[11px] text-muted-foreground">{nota}</p>}
    </div>
  );
}

export function AndamentoPage(): React.ReactElement {
  const { dati, isLoading, isFetching, error, giorni, setGiorni, refetch } = useAndamento();

  const tassoRisposta =
    dati && dati.inviati > 0 ? `${Math.round((dati.conRisposta / dati.inviati) * 100)}%` : "—";

  const filters = (
    <RailGroup label="Periodo">
      <div className="flex flex-wrap gap-1">
        {V3_PERIODI_ANDAMENTO.map((value) => (
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
  );

  const workflow = (
    <>
      <RailGroup label="Azioni">
        <Button variant="outline" size="sm" className="h-8 w-full justify-start text-xs" disabled>
          Esporta
        </Button>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          L'esportazione arriva con il modulo di reportistica.
        </p>
      </RailGroup>

      <RailGroup label="Canali nel periodo">
        {(dati?.perCanale ?? []).map((item) => (
          <p key={item.canale} className="text-xs text-muted-foreground">
            {item.canale}: {item.conteggio.toLocaleString("it-IT")}
          </p>
        ))}
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
        <Activity className="h-3.5 w-3.5" />
        Ultimi {giorni} giorni
      </span>
      {isFetching && !isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
    </>
  );

  return (
    <PageFrame pageId="andamento" filters={filters} workflow={workflow} toolbar={toolbar}>
      {isLoading ? (
        <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Calcolo andamento…
        </div>
      ) : error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Impossibile calcolare l'andamento: {error.message}
        </div>
      ) : dati ? (
        <>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <Metrica titolo="Messaggi ricevuti" valore={dati.ricevuti.toLocaleString("it-IT")} />
            <Metrica titolo="Messaggi inviati" valore={dati.inviati.toLocaleString("it-IT")} />
            <Metrica titolo="Tasso di risposta" valore={tassoRisposta} nota="attività con risposta / inviati" />
            <Metrica titolo="Attività create" valore={dati.attivitaCreate.toLocaleString("it-IT")} />
            <Metrica titolo="Attività completate" valore={dati.attivitaCompletate.toLocaleString("it-IT")} />
            <Metrica titolo="Attività con risposta" valore={dati.conRisposta.toLocaleString("it-IT")} />
          </div>

          <section className="mt-4">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Ripartizione per canale
            </h2>
            {dati.perCanale.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessun messaggio nel periodo.</p>
            ) : (
              <ul className="space-y-1">
                {dati.perCanale.map((item) => {
                  const totale = dati.perCanale.reduce((sum, c) => sum + c.conteggio, 0);
                  const quota = totale > 0 ? Math.round((item.conteggio / totale) * 100) : 0;
                  return (
                    <li key={item.canale} className="rounded-md border border-border px-3 py-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-foreground">{item.canale}</span>
                        <span className="text-muted-foreground">
                          {item.conteggio.toLocaleString("it-IT")} · {quota}%
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-full rounded-full bg-muted">
                        <div className="h-1.5 rounded-full bg-primary" style={{ width: `${quota}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-2 text-[11px] text-muted-foreground">
              Ripartizione calcolata sul campione dei 2.000 messaggi più recenti del periodo.
            </p>
          </section>
        </>
      ) : null}
    </PageFrame>
  );
}

export default AndamentoPage;
