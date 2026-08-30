/**
 * Qualità classificazione — maschera Lista. "Sta classificando bene?"
 */
import * as React from "react";
import { ChevronLeft, ChevronRight, Gauge, Loader2, RefreshCw, ShieldCheck, Wand2 } from "lucide-react";
import { PageFrame } from "@/v3/app/PageFrame";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { SOGLIA_INCERTEZZA, useClassificazioni, V3_PERIODI } from "../useClassificazioni";

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
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function percentuale(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

export function ClassificazionePage(): React.ReactElement {
  const {
    righe,
    totale,
    pagina,
    perPagina,
    pagineTotali,
    isLoading,
    isFetching,
    error,
    qualita,
    giorni,
    setGiorni,
    categoria,
    setCategoria,
    soloIncerte,
    setSoloIncerte,
    vaiA,
    azzeraFiltri,
    refetch,
  } = useClassificazioni();

  const filters = (
    <>
      <RailGroup label="Periodo">
        <div className="flex flex-wrap gap-1">
          {V3_PERIODI.map((value) => (
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

      <RailGroup label="Categoria">
        <select
          value={categoria ?? ""}
          onChange={(event) => setCategoria(event.target.value || null)}
          className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground"
        >
          <option value="">Tutte le categorie</option>
          {(qualita?.perCategoria ?? []).map((item) => (
            <option key={item.categoria} value={item.categoria}>
              {item.categoria} ({item.conteggio})
            </option>
          ))}
        </select>
      </RailGroup>

      <RailGroup label="Esito">
        <Button
          variant={soloIncerte ? "secondary" : "ghost"}
          size="sm"
          className="h-7 w-full justify-start px-2 text-xs"
          onClick={() => setSoloIncerte(!soloIncerte)}
        >
          Solo incerte (&lt; {Math.round(SOGLIA_INCERTEZZA * 100)}%)
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
        <Button variant="outline" size="sm" className="h-8 w-full justify-start gap-2 text-xs" disabled>
          <Wand2 className="h-3.5 w-3.5" />
          Correggi classificazione
        </Button>
        <Button variant="outline" size="sm" className="h-8 w-full justify-start gap-2 text-xs" disabled>
          <ShieldCheck className="h-3.5 w-3.5" />
          Promuovi a regola
        </Button>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Le correzioni scrivono sul classificatore: arrivano con le mutazioni del Modulo 4.
        </p>
      </RailGroup>

      <RailGroup label="Sintesi periodo">
        <p className="text-xs text-muted-foreground">
          {(qualita?.totale ?? 0).toLocaleString("it-IT")} classificazioni
        </p>
        <p className="text-xs text-muted-foreground">
          Confidenza media {percentuale(qualita?.confidenzaMedia ?? null)}
        </p>
        <p className="text-xs text-muted-foreground">
          {(qualita?.incerte ?? 0).toLocaleString("it-IT")} incerte nel campione
        </p>
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
        <Gauge className="h-3.5 w-3.5" />
        {isLoading ? "…" : `${totale.toLocaleString("it-IT")} esiti`}
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
    <PageFrame pageId="classificazione" filters={filters} workflow={workflow} toolbar={toolbar}>
      {qualita && (
        <div className="mb-3 grid gap-2 sm:grid-cols-3">
          {qualita.perCategoria.slice(0, 6).map((item) => (
            <button
              key={item.categoria}
              type="button"
              onClick={() => setCategoria(categoria === item.categoria ? null : item.categoria)}
              className="rounded-md border border-border px-3 py-2 text-left transition-colors hover:bg-muted/50"
            >
              <p className="truncate text-xs text-muted-foreground">{item.categoria}</p>
              <p className="text-sm font-medium text-foreground">{item.conteggio.toLocaleString("it-IT")}</p>
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Caricamento esiti…
        </div>
      ) : error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Impossibile caricare le classificazioni: {error.message}
        </div>
      ) : righe.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nessuna classificazione nel periodo selezionato.
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-md border border-border">
          {righe.map((riga) => {
            const incerta = riga.confidenza !== null && riga.confidenza < SOGLIA_INCERTEZZA;
            return (
              <li key={riga.id} className="flex items-start gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <p className="truncate text-sm text-foreground">{riga.indirizzo ?? "—"}</p>
                    {riga.categoria && (
                      <Badge variant="secondary" className="shrink-0 text-[10px]">
                        {riga.categoria}
                      </Badge>
                    )}
                    {riga.urgenza && (
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        {riga.urgenza}
                      </Badge>
                    )}
                    {incerta && (
                      <Badge variant="destructive" className="shrink-0 text-[10px]">
                        incerta
                      </Badge>
                    )}
                  </div>
                  <p className="truncate text-sm text-foreground/90">{riga.oggetto ?? "(senza oggetto)"}</p>
                  {riga.motivazione && (
                    <p className="line-clamp-2 text-xs text-muted-foreground">{riga.motivazione}</p>
                  )}
                  {riga.azioneSuggerita && (
                    <p className="text-[11px] text-muted-foreground">Suggerito: {riga.azioneSuggerita}</p>
                  )}
                </div>
                <div className="shrink-0 text-right text-[11px] text-muted-foreground">
                  <p className="text-foreground/90">{percentuale(riga.confidenza)}</p>
                  <p>{dataOra(riga.data)}</p>
                  {riga.sentiment && <p>{riga.sentiment}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!isLoading && righe.length > 0 && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Righe {pagina * perPagina + 1}–{pagina * perPagina + righe.length} di {totale.toLocaleString("it-IT")}.
        </p>
      )}
    </PageFrame>
  );
}

export default ClassificazionePage;
