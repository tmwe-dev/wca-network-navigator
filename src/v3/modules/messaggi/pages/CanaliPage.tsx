/**
 * Canali — maschera Lista. "Cosa arriva da WhatsApp e LinkedIn?"
 * Conversazioni aggregate per contatto. Sola lettura.
 */
import * as React from "react";
import { Loader2, MessageSquare, RefreshCw } from "lucide-react";
import { PageFrame } from "@/v3/app/PageFrame";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { useCanali, V3_CANALI_NON_EMAIL, V3_PERIODI_CANALI } from "../useCanali";

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

export function CanaliPage(): React.ReactElement {
  const {
    conversazioni,
    perCanale,
    isLoading,
    isFetching,
    error,
    canale,
    setCanale,
    ricerca,
    setRicerca,
    giorni,
    setGiorni,
    aperta,
    apri,
    azzeraFiltri,
    refetch,
  } = useCanali();

  const filters = (
    <>
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
          {V3_CANALI_NON_EMAIL.map((value) => (
            <Button
              key={value}
              variant={canale === value ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setCanale(value)}
            >
              {value}
            </Button>
          ))}
        </div>
      </RailGroup>

      <RailGroup label="Contatto">
        <Input
          value={ricerca}
          onChange={(event) => setRicerca(event.target.value)}
          placeholder="Nome o numero"
          className="h-8 text-xs"
        />
      </RailGroup>

      <RailGroup label="Periodo">
        <div className="flex flex-wrap gap-1">
          {V3_PERIODI_CANALI.map((value) => (
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
          Apri conversazione
        </Button>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Le risposte su WhatsApp e LinkedIn passano dalle estensioni: restano dove sono finché non innestiamo «Scrivi».
        </p>
      </RailGroup>

      <RailGroup label="Volumi nel periodo">
        {perCanale.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nessun messaggio.</p>
        ) : (
          perCanale.map((item) => (
            <p key={item.canale} className="text-xs text-muted-foreground">
              {item.canale}: {item.conteggio.toLocaleString("it-IT")} messaggi
            </p>
          ))
        )}
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
        <MessageSquare className="h-3.5 w-3.5" />
        {isLoading ? "…" : `${conversazioni.length} conversazioni`}
      </span>
      {isFetching && !isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      <span className="ml-auto text-[11px] text-muted-foreground">campione: 500 messaggi più recenti</span>
    </>
  );

  return (
    <PageFrame pageId="canali" filters={filters} workflow={workflow} toolbar={toolbar}>
      {isLoading ? (
        <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Caricamento conversazioni…
        </div>
      ) : error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Impossibile caricare i canali: {error.message}
        </div>
      ) : conversazioni.length === 0 ? (
        <div className="rounded-md border border-border p-6 text-center text-sm text-muted-foreground">
          Nessuna conversazione WhatsApp o LinkedIn nel periodo.
        </div>
      ) : (
        <ul className="space-y-2">
          {conversazioni.map((conv) => {
            const attiva = conv.chiave === aperta;
            return (
              <li key={conv.chiave}>
                <button
                  type="button"
                  onClick={() => apri(attiva ? null : conv.chiave)}
                  className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                    attiva ? "border-primary bg-muted/60" : "border-border hover:bg-muted/40"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-[11px]">
                      {conv.canale}
                    </Badge>
                    <span className="truncate text-sm font-medium text-foreground">{conv.contatto}</span>
                    <Badge variant="secondary" className="text-[11px]">
                      {conv.totale} messaggi
                    </Badge>
                    {conv.nonLetti > 0 && (
                      <Badge className="text-[11px]">{conv.nonLetti} non letti</Badge>
                    )}
                    <span className="ml-auto text-[11px] text-muted-foreground">{dataOra(conv.ultimaData)}</span>
                  </div>
                  <p className={`mt-1 text-xs text-muted-foreground ${attiva ? "" : "line-clamp-2"}`}>
                    {conv.ultimoMessaggio ?? "Nessun testo disponibile."}
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

export default CanaliPage;
