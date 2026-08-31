/**
 * Inbox — maschera Operativa. "Cosa è arrivato e cosa richiede risposta?"
 */
import * as React from "react";
import { Link } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Inbox,
  Loader2,
  RefreshCw,
  Send,
  SlidersHorizontal,
  Square,
} from "lucide-react";
import { PageFrame } from "@/v3/app/PageFrame";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useMessaggi } from "../useMessaggi";
import { useSync } from "../useSync";
import { V3_CANALI, dataMessaggio, etichettaCanale, mittente } from "../canali";

function RailGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

export function InboxPage(): React.ReactElement {
  const {
    righe,
    totale,
    pagina,
    perPagina,
    pagineTotali,
    isLoading,
    isFetching,
    error,
    ricerca,
    setRicerca,
    canale,
    setCanale,
    casellaId,
    setCasellaId,
    direzione,
    setDirezione,
    soloNonLetti,
    setSoloNonLetti,
    caselle,
    vaiA,
    azzeraFiltri,
    refetch,
  } = useMessaggi();

  const filters = (
    <>
      <RailGroup label="Ricerca">
        <Input
          value={ricerca}
          onChange={(event) => setRicerca(event.target.value)}
          placeholder="Oggetto, mittente, destinatario"
          className="h-8 text-xs"
        />
      </RailGroup>

      <RailGroup label="Casella">
        <select
          value={casellaId ?? ""}
          onChange={(event) => setCasellaId(event.target.value || null)}
          className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground"
        >
          <option value="">Tutte le caselle</option>
          {caselle.map((item) => (
            <option key={item.id} value={item.id}>
              {item.etichetta}
            </option>
          ))}
        </select>
      </RailGroup>

      <RailGroup label="Canale">
        <div className="flex flex-wrap gap-1">
          <Button
            variant={canale === null ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setCanale(null)}
          >
            Tutti
          </Button>
          {V3_CANALI.map((value) => (
            <Button
              key={value}
              variant={canale === value ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setCanale(value)}
            >
              {etichettaCanale(value)}
            </Button>
          ))}
        </div>
      </RailGroup>

      <RailGroup label="Direzione">
        <div className="flex flex-wrap gap-1">
          <Button
            variant={direzione === "inbound" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setDirezione("inbound")}
          >
            Ricevuti
          </Button>
          <Button
            variant={direzione === "outbound" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setDirezione("outbound")}
          >
            Inviati
          </Button>
          <Button
            variant={direzione === null ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setDirezione(null)}
          >
            Tutti
          </Button>
        </div>
      </RailGroup>

      <RailGroup label="Stato">
        <Button
          variant={soloNonLetti ? "secondary" : "ghost"}
          size="sm"
          className="h-7 w-full justify-start px-2 text-xs"
          onClick={() => setSoloNonLetti(!soloNonLetti)}
        >
          Solo non letti
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
          <Send className="h-3.5 w-3.5" />
          Rispondi
        </Button>
        <Button variant="outline" size="sm" className="h-8 w-full justify-start gap-2 text-xs" disabled>
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Regole
        </Button>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Risposta e regole arrivano con i Moduli 4 e 5. Apri un messaggio per leggerlo per intero.
        </p>
      </RailGroup>

      <RailGroup label="Stato dati">
        <p className="text-xs text-muted-foreground">{totale.toLocaleString("it-IT")} messaggi nel filtro</p>
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
        <Inbox className="h-3.5 w-3.5" />
        {isLoading ? "…" : `${totale.toLocaleString("it-IT")} messaggi`}
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
    <PageFrame pageId="inbox" filters={filters} workflow={workflow} toolbar={toolbar}>
      {isLoading ? (
        <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Caricamento messaggi…
        </div>
      ) : error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Impossibile caricare i messaggi: {error.message}
        </div>
      ) : righe.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nessun messaggio corrisponde ai filtri.
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-md border border-border">
          {righe.map((riga) => (
            <li key={riga.id}>
              <Link
                to={`/v3/inbox/${riga.id}`}
                className={cn(
                  "flex items-start gap-3 px-3 py-2.5 transition-colors hover:bg-muted/50",
                  !riga.letto && "bg-primary/5",
                )}
              >
                <span
                  className={cn(
                    "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                    riga.letto ? "bg-transparent" : "bg-primary",
                  )}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <p
                      className={cn(
                        "truncate text-sm text-foreground",
                        !riga.letto && "font-semibold",
                      )}
                    >
                      {mittente(riga.daNome, riga.da)}
                    </p>
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {etichettaCanale(riga.canale)}
                    </Badge>
                    {riga.categoria && (
                      <Badge variant="secondary" className="shrink-0 text-[10px]">
                        {riga.categoria}
                      </Badge>
                    )}
                  </div>
                  <p className="truncate text-sm text-foreground/90">{riga.oggetto ?? "(senza oggetto)"}</p>
                  {riga.anteprima && (
                    <p className="line-clamp-1 text-xs text-muted-foreground">{riga.anteprima}</p>
                  )}
                </div>
                <span className="shrink-0 pt-0.5 text-[11px] text-muted-foreground">
                  {dataMessaggio(riga.data)}
                </span>
              </Link>
            </li>
          ))}
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

export default InboxPage;
