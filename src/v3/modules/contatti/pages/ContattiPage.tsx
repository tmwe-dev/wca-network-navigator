/**
 * Contatti — maschera Lista. "Chi devo contattare?"
 * Anagrafica unificata: contatti CRM, biglietti da visita e partner WCA
 * nella stessa tabella, con badge di provenienza. UI senza logica.
 */
import * as React from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Loader2, RefreshCw, Upload, UserPlus, Users } from "lucide-react";
import { PageFrame } from "@/v3/app/PageFrame";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useContatti } from "../useContatti";
import { ETICHETTE_STATO_LEAD, V3_STATI_LEAD, etichettaStato } from "../statiLead";
import { ETICHETTE_FONTE, V3_FONTI_ANAGRAFICA, type V3AnagraficaRiga, type V3FonteAnagrafica } from "@/data/v3/anagrafiche";

const VARIANTI_FONTE: Record<V3FonteAnagrafica, "default" | "secondary" | "outline"> = {
  crm: "default",
  biglietti: "secondary",
  wca: "outline",
};

function RailGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function CellaContatto({ riga }: { riga: V3AnagraficaRiga }) {
  const corpo = (
    <>
      <p className="truncate text-sm font-medium text-foreground">{riga.nome ?? "Senza nome"}</p>
      <p className="truncate text-xs text-muted-foreground">{riga.email ?? "nessuna email"}</p>
    </>
  );
  // Solo i contatti CRM hanno una scheda dettaglio in V3.
  if (riga.fonte === "crm") {
    return (
      <Link to={`/v3/contatti/${riga.id}`} className="block min-w-0 hover:underline">
        {corpo}
      </Link>
    );
  }
  return <div className="min-w-0">{corpo}</div>;
}

export function ContattiPage(): React.ReactElement {
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
    fonte,
    setFonte,
    paese,
    setPaese,
    stato,
    setStato,
    soloConEmail,
    setSoloConEmail,
    paesiDisponibili,
    vaiA,
    azzeraFiltri,
    refetch,
  } = useContatti();

  const filters = (
    <>
      <RailGroup label="Ricerca">
        <Input
          value={ricerca}
          onChange={(event) => setRicerca(event.target.value)}
          placeholder="Nome, azienda, email"
          className="h-8 text-xs"
        />
      </RailGroup>

      <RailGroup label="Provenienza">
        <div className="flex flex-wrap gap-1">
          <Button
            variant={fonte === null ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setFonte(null)}
          >
            Tutte
          </Button>
          {V3_FONTI_ANAGRAFICA.map((value) => (
            <Button
              key={value}
              variant={fonte === value ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setFonte(value)}
            >
              {ETICHETTE_FONTE[value]}
            </Button>
          ))}
        </div>
      </RailGroup>

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
          {V3_STATI_LEAD.map((value) => (
            <Button
              key={value}
              variant={stato === value ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setStato(value)}
            >
              {ETICHETTE_STATO_LEAD[value] ?? value}
            </Button>
          ))}
        </div>
      </RailGroup>

      <RailGroup label="Paese">
        <select
          value={paese ?? ""}
          onChange={(event) => setPaese(event.target.value || null)}
          className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground"
        >
          <option value="">Tutti i paesi</option>
          {paesiDisponibili.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
      </RailGroup>

      <RailGroup label="Contattabilità">
        <Button
          variant={soloConEmail ? "secondary" : "ghost"}
          size="sm"
          className="h-7 w-full justify-start px-2 text-xs"
          onClick={() => setSoloConEmail(!soloConEmail)}
        >
          Solo con email
        </Button>
      </RailGroup>

      <Button variant="ghost" size="sm" className="h-7 w-full px-2 text-xs" onClick={azzeraFiltri}>
        Azzera filtri
      </Button>
    </>
  );

  const workflow = (
    <>
      <RailGroup label="Aggiungi">
        <Button variant="outline" size="sm" className="h-8 w-full justify-start gap-2 text-xs" disabled>
          <UserPlus className="h-3.5 w-3.5" />
          Nuovo contatto
        </Button>
        <Button variant="outline" size="sm" className="h-8 w-full justify-start gap-2 text-xs" disabled>
          <Upload className="h-3.5 w-3.5" />
          Import
        </Button>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Creazione e import restano in V2 finché il Modulo 2 non è completo.
        </p>
      </RailGroup>

      <RailGroup label="Stato dati">
        <p className="text-xs text-muted-foreground">{totale.toLocaleString("it-IT")} voci nel filtro</p>
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
        <Users className="h-3.5 w-3.5" />
        {isLoading ? "…" : `${totale.toLocaleString("it-IT")} voci`}
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
    <PageFrame pageId="contatti" filters={filters} workflow={workflow} toolbar={toolbar}>
      {isLoading ? (
        <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Caricamento anagrafica…
        </div>
      ) : error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Impossibile caricare l'anagrafica: {error.message}
        </div>
      ) : righe.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nessuna voce corrisponde ai filtri.
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Contatto</TableHead>
                <TableHead className="text-xs">Azienda</TableHead>
                <TableHead className="text-xs">Fonte</TableHead>
                <TableHead className="text-xs">Paese</TableHead>
                <TableHead className="text-xs">Stato</TableHead>
                <TableHead className="text-right text-xs">Interazioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {righe.map((riga) => (
                <TableRow key={`${riga.fonte}-${riga.id}`}>
                  <TableCell className="py-2">
                    <CellaContatto riga={riga} />
                  </TableCell>
                  <TableCell className="py-2">
                    <span className="line-clamp-1 text-xs text-muted-foreground">{riga.azienda ?? "—"}</span>
                  </TableCell>
                  <TableCell className="py-2">
                    <Badge variant={VARIANTI_FONTE[riga.fonte]} className="text-[11px]">
                      {ETICHETTE_FONTE[riga.fonte]}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-2 text-xs text-muted-foreground">{riga.paese ?? "—"}</TableCell>
                  <TableCell className="py-2">
                    <Badge variant="outline" className="text-[11px]">
                      {etichettaStato(riga.stato)}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-2 text-right text-xs tabular-nums text-muted-foreground">
                    {riga.interazioni}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {!isLoading && righe.length > 0 && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Righe {pagina * perPagina + 1}–{pagina * perPagina + righe.length} di {totale.toLocaleString("it-IT")}.
        </p>
      )}
    </PageFrame>
  );
}

export default ContattiPage;
