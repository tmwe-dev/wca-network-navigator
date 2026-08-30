/**
 * Cestino — maschera Lista. "Cosa ho eliminato?"
 * Righe soft-deleted delle tabelle business. Sola lettura.
 */
import * as React from "react";
import { ChevronLeft, ChevronRight, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { PageFrame } from "@/v3/app/PageFrame";
import { Button } from "@/components/ui/button";

import { useCestino, V3_PERIODI_CESTINO, V3_TIPI_CESTINO } from "../useCestino";

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
  return d.toLocaleString("it-IT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function CestinoPage(): React.ReactElement {
  const {
    righe,
    totale,
    pagina,
    pagineTotali,
    isLoading,
    isFetching,
    error,
    conteggi,
    tipo,
    setTipo,
    giorni,
    setGiorni,
    vaiA,
    azzeraFiltri,
    refetch,
  } = useCestino();

  const filters = (
    <>
      <RailGroup label="Tipo">
        <div className="flex flex-col gap-1">
          {V3_TIPI_CESTINO.map((item) => (
            <Button
              key={item.tipo}
              variant={tipo === item.tipo ? "secondary" : "ghost"}
              size="sm"
              className="h-7 justify-between px-2 text-xs"
              onClick={() => setTipo(item.tipo)}
            >
              <span>{item.etichetta}</span>
              <span className="text-muted-foreground">{(conteggi[item.tipo] ?? 0).toLocaleString("it-IT")}</span>
            </Button>
          ))}
        </div>
      </RailGroup>

      <RailGroup label="Periodo">
        <div className="flex flex-wrap gap-1">
          <Button
            variant={giorni === null ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setGiorni(null)}
          >
            Tutto
          </Button>
          {V3_PERIODI_CESTINO.map((value) => (
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

      <Button variant="ghost" size="sm" className="h-7 w-full px-2 text-xs" onClick={azzeraFiltri}>
        Azzera filtri
      </Button>
    </>
  );

  const workflow = (
    <>
      <RailGroup label="Azioni">
        <Button variant="outline" size="sm" className="h-8 w-full justify-start text-xs" disabled>
          Ripristina
        </Button>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Il ripristino tocca la governance del soft-delete: arriva con la mutazione dedicata, non da qui.
        </p>
      </RailGroup>

      <RailGroup label="Nel cestino">
        {V3_TIPI_CESTINO.map((item) => (
          <p key={item.tipo} className="text-xs text-muted-foreground">
            {item.etichetta}: {(conteggi[item.tipo] ?? 0).toLocaleString("it-IT")}
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
        <Trash2 className="h-3.5 w-3.5" />
        {isLoading ? "…" : `${totale.toLocaleString("it-IT")} elementi`}
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
    <PageFrame pageId="cestino" filters={filters} workflow={workflow} toolbar={toolbar}>
      {isLoading ? (
        <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Caricamento cestino…
        </div>
      ) : error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Impossibile caricare il cestino: {error.message}
        </div>
      ) : righe.length === 0 ? (
        <div className="rounded-md border border-border p-6 text-center text-sm text-muted-foreground">
          Niente di eliminato con questi filtri.
        </div>
      ) : (
        <ul className="space-y-2">
          {righe.map((riga) => (
            <li key={`${riga.tipo}-${riga.id}`} className="rounded-md border border-border px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-sm font-medium text-foreground">{riga.titolo}</span>
                <span className="ml-auto text-[11px] text-muted-foreground">
                  eliminato {dataOra(riga.eliminatoIl)}
                </span>
              </div>
              {riga.dettaglio && <p className="truncate text-xs text-muted-foreground">{riga.dettaglio}</p>}
            </li>
          ))}
        </ul>
      )}
    </PageFrame>
  );
}

export default CestinoPage;
