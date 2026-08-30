/**
 * Agenda — maschera Operativa. "Cosa devo fare oggi?"
 * Unisce attività e promemoria con scadenza. Sola lettura.
 */
import * as React from "react";
import { CalendarClock, Loader2, RefreshCw } from "lucide-react";
import { PageFrame } from "@/v3/app/PageFrame";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { useAgenda, V3_FINESTRE, V3_TIPI_ATTIVITA, type V3VoceAgenda } from "../useAgenda";

function RailGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function data(value: string | null): string {
  if (!value) return "senza scadenza";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "senza scadenza";
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
}

function Blocco({ titolo, voci, tono }: { titolo: string; voci: readonly V3VoceAgenda[]; tono?: "urgente" }) {
  if (voci.length === 0) return null;
  return (
    <section className="mb-4">
      <h2 className={`mb-2 text-xs font-semibold uppercase tracking-wide ${tono === "urgente" ? "text-destructive" : "text-muted-foreground"}`}>
        {titolo} · {voci.length}
      </h2>
      <ul className="space-y-2">
        {voci.map((voce) => (
          <li
            key={`${voce.origine}-${voce.id}`}
            className="rounded-md border border-border px-3 py-2 transition-colors hover:bg-muted/40"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-[11px]">
                {voce.origine === "attivita" ? (voce.tipo ?? "attività") : "promemoria"}
              </Badge>
              {voce.priorita && (
                <Badge variant="secondary" className="text-[11px]">
                  {voce.priorita}
                </Badge>
              )}
              <span className="ml-auto text-[11px] text-muted-foreground">{data(voce.scadenza)}</span>
            </div>
            <p className="mt-1 text-sm font-medium text-foreground">{voce.titolo}</p>
            {voce.descrizione && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{voce.descrizione}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function AgendaPage(): React.ReactElement {
  const {
    voci,
    scadute,
    oggi,
    prossime,
    isLoading,
    isFetching,
    error,
    giorni,
    setGiorni,
    tipo,
    setTipo,
    stato,
    setStato,
    soloScadute,
    setSoloScadute,
    azzeraFiltri,
    refetch,
  } = useAgenda();

  const filters = (
    <>
      <RailGroup label="Giorno">
        <div className="flex flex-wrap gap-1">
          {V3_FINESTRE.map((value) => (
            <Button
              key={value}
              variant={giorni === value ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setGiorni(value)}
            >
              {value === 1 ? "Oggi" : `${value} giorni`}
            </Button>
          ))}
        </div>
      </RailGroup>

      <RailGroup label="Tipo">
        <select
          value={tipo ?? ""}
          onChange={(event) => setTipo(event.target.value || null)}
          className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground"
        >
          <option value="">Tutti (con promemoria)</option>
          {V3_TIPI_ATTIVITA.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </RailGroup>

      <RailGroup label="Stato">
        <div className="flex flex-wrap gap-1">
          {[
            { label: "Da fare", value: "pending" as string | null },
            { label: "In corso", value: "in_progress" as string | null },
            { label: "Completate", value: "completed" as string | null },
            { label: "Tutte", value: null as string | null },
          ].map((item) => (
            <Button
              key={item.label}
              variant={stato === item.value ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setStato(item.value)}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </RailGroup>

      <RailGroup label="Priorità">
        <Button
          variant={soloScadute ? "secondary" : "ghost"}
          size="sm"
          className="h-7 w-full justify-start px-2 text-xs"
          onClick={() => setSoloScadute(!soloScadute)}
        >
          Solo scadute
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
          Completa
        </Button>
        <Button variant="outline" size="sm" className="h-8 w-full justify-start text-xs" disabled>
          Rimanda
        </Button>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Le scritture sull'agenda arrivano con le mutazioni del Modulo 6.
        </p>
      </RailGroup>

      <RailGroup label="Sintesi">
        <p className="text-xs text-muted-foreground">{scadute.length} scadute</p>
        <p className="text-xs text-muted-foreground">{oggi.length} in scadenza oggi</p>
        <p className="text-xs text-muted-foreground">{prossime.length} in arrivo</p>
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
        <CalendarClock className="h-3.5 w-3.5" />
        {isLoading ? "…" : `${voci.length} voci in finestra`}
      </span>
      {isFetching && !isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
    </>
  );

  return (
    <PageFrame pageId="agenda" filters={filters} workflow={workflow} toolbar={toolbar}>
      {isLoading ? (
        <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Caricamento agenda…
        </div>
      ) : error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Impossibile caricare l'agenda: {error.message}
        </div>
      ) : voci.length === 0 ? (
        <div className="rounded-md border border-border p-6 text-center text-sm text-muted-foreground">
          Niente in scadenza con questi filtri.
        </div>
      ) : (
        <>
          <Blocco titolo="Scadute" voci={scadute} tono="urgente" />
          <Blocco titolo="Oggi" voci={oggi} />
          <Blocco titolo="Prossime" voci={prossime} />
        </>
      )}
    </PageFrame>
  );
}

export default AgendaPage;
