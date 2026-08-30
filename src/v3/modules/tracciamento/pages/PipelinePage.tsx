/**
 * Pipeline — maschera Operativa. "A che punto sono le trattative?"
 * Partner per fase di relazione (`lead_status`). Sola lettura.
 */
import * as React from "react";
import { ChevronLeft, ChevronRight, GitBranch, Loader2, RefreshCw } from "lucide-react";
import { PageFrame } from "@/v3/app/PageFrame";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { usePipeline, V3_ETICHETTA_FASE } from "../usePipeline";

function RailGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function data(value: string | null): string {
  if (!value) return "mai contattato";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "mai contattato";
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
}

export function PipelinePage(): React.ReactElement {
  const {
    righe,
    totale,
    pagina,
    pagineTotali,
    isLoading,
    isFetching,
    error,
    fasi,
    fase,
    setFase,
    ricerca,
    setRicerca,
    selezionato,
    seleziona,
    vaiA,
    azzeraFiltri,
    refetch,
  } = usePipeline();

  const filters = (
    <>
      <RailGroup label="Fase">
        <div className="flex flex-col gap-1">
          {fasi.map((item) => (
            <Button
              key={item.fase}
              variant={fase === item.fase ? "secondary" : "ghost"}
              size="sm"
              className="h-7 justify-between px-2 text-xs"
              onClick={() => setFase(item.fase)}
            >
              <span>{V3_ETICHETTA_FASE[item.fase] ?? item.fase}</span>
              <span className="text-muted-foreground">{item.conteggio.toLocaleString("it-IT")}</span>
            </Button>
          ))}
        </div>
      </RailGroup>

      <RailGroup label="Ricerca">
        <Input
          value={ricerca}
          onChange={(event) => setRicerca(event.target.value)}
          placeholder="Azienda, email, paese"
          className="h-8 text-xs"
        />
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
          Sposta di fase
        </Button>
        <Button variant="outline" size="sm" className="h-8 w-full justify-start text-xs" disabled>
          Crea attività
        </Button>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Le scritture sulla pipeline arrivano con le mutazioni del Modulo 7.
        </p>
      </RailGroup>

      <RailGroup label="Distribuzione">
        {fasi.map((item) => (
          <p key={item.fase} className="text-xs text-muted-foreground">
            {V3_ETICHETTA_FASE[item.fase] ?? item.fase}: {item.conteggio.toLocaleString("it-IT")}
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
        <GitBranch className="h-3.5 w-3.5" />
        {isLoading ? "…" : `${totale.toLocaleString("it-IT")} in «${V3_ETICHETTA_FASE[fase] ?? fase}»`}
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
    <PageFrame pageId="pipeline" filters={filters} workflow={workflow} toolbar={toolbar}>
      {isLoading ? (
        <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Caricamento pipeline…
        </div>
      ) : error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Impossibile caricare la pipeline: {error.message}
        </div>
      ) : righe.length === 0 ? (
        <div className="rounded-md border border-border p-6 text-center text-sm text-muted-foreground">
          Nessun partner in questa fase.
        </div>
      ) : (
        <ul className="space-y-2">
          {righe.map((riga) => {
            const attiva = riga.id === selezionato;
            return (
              <li key={riga.id}>
                <button
                  type="button"
                  onClick={() => seleziona(attiva ? null : riga.id)}
                  className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                    attiva ? "border-primary bg-muted/60" : "border-border hover:bg-muted/40"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium text-foreground">{riga.azienda}</span>
                    {riga.paese && (
                      <Badge variant="outline" className="text-[11px]">
                        {riga.paese}
                      </Badge>
                    )}
                    <Badge variant="secondary" className="text-[11px]">
                      {riga.interazioni} interazioni
                    </Badge>
                    <span className="ml-auto text-[11px] text-muted-foreground">{data(riga.ultimoContatto)}</span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {[riga.citta, riga.email].filter(Boolean).join(" · ") || "nessun recapito"}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </PageFrame>
  );
}

export default PipelinePage;
