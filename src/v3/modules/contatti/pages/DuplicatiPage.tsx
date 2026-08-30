/**
 * Duplicati — maschera Lista. "Cosa devo unire?"
 * Gruppi di aziende che condividono email o nome. Sola lettura.
 */
import * as React from "react";
import { Copy, Loader2, RefreshCw } from "lucide-react";
import { PageFrame } from "@/v3/app/PageFrame";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { useDuplicati, V3_SOGLIE_DUPLICATI } from "../useDuplicati";

function RailGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

export function DuplicatiPage(): React.ReactElement {
  const {
    gruppi,
    campione,
    righeCoinvolte,
    isLoading,
    isFetching,
    error,
    tipo,
    setTipo,
    soglia,
    setSoglia,
    ricerca,
    setRicerca,
    aperto,
    apri,
    azzeraFiltri,
    refetch,
  } = useDuplicati();

  const filters = (
    <>
      <RailGroup label="Tipo">
        <div className="flex flex-wrap gap-1">
          {[
            { label: "Stessa email", value: "email" as const },
            { label: "Stesso nome", value: "azienda" as const },
          ].map((item) => (
            <Button
              key={item.value}
              variant={tipo === item.value ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setTipo(item.value)}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </RailGroup>

      <RailGroup label="Soglia">
        <div className="flex flex-wrap gap-1">
          {V3_SOGLIE_DUPLICATI.map((value) => (
            <Button
              key={value}
              variant={soglia === value ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setSoglia(value)}
            >
              {value}+ righe
            </Button>
          ))}
        </div>
      </RailGroup>

      <RailGroup label="Ricerca">
        <Input
          value={ricerca}
          onChange={(event) => setRicerca(event.target.value)}
          placeholder="Azienda o email"
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
          Unisci
        </Button>
        <Button variant="outline" size="sm" className="h-8 w-full justify-start text-xs" disabled>
          Ignora
        </Button>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          L'unione riscrive contatti e cronologia: resta nella procedura di merge esistente finché non la innestiamo con
          i suoi controlli.
        </p>
      </RailGroup>

      <RailGroup label="Sul campione">
        <p className="text-xs text-muted-foreground">{campione.toLocaleString("it-IT")} aziende esaminate</p>
        <p className="text-xs text-muted-foreground">{gruppi.length} gruppi sospetti</p>
        <p className="text-xs text-muted-foreground">{righeCoinvolte.toLocaleString("it-IT")} righe coinvolte</p>
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
        <Copy className="h-3.5 w-3.5" />
        {isLoading ? "…" : `${gruppi.length} gruppi`}
      </span>
      {isFetching && !isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      <span className="ml-auto text-[11px] text-muted-foreground">
        campione: {campione.toLocaleString("it-IT")} aziende più recenti
      </span>
    </>
  );

  return (
    <PageFrame pageId="duplicati" filters={filters} workflow={workflow} toolbar={toolbar}>
      {isLoading ? (
        <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Ricerca duplicati…
        </div>
      ) : error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Impossibile cercare i duplicati: {error.message}
        </div>
      ) : gruppi.length === 0 ? (
        <div className="rounded-md border border-border p-6 text-center text-sm text-muted-foreground">
          Nessun duplicato con questi criteri sul campione esaminato.
        </div>
      ) : (
        <ul className="space-y-2">
          {gruppi.map((gruppo) => {
            const attivo = gruppo.chiave === aperto;
            return (
              <li key={`${gruppo.tipo}-${gruppo.chiave}`}>
                <button
                  type="button"
                  onClick={() => apri(attivo ? null : gruppo.chiave)}
                  className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                    attivo ? "border-primary bg-muted/60" : "border-border hover:bg-muted/40"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium text-foreground">{gruppo.valore}</span>
                    <Badge variant="secondary" className="text-[11px]">
                      {gruppo.membri.length} righe
                    </Badge>
                    <span className="ml-auto text-[11px] text-muted-foreground">
                      {gruppo.tipo === "email" ? "stessa email" : "stesso nome"}
                    </span>
                  </div>
                  {attivo ? (
                    <ul className="mt-2 space-y-1 border-t border-border pt-2">
                      {gruppo.membri.map((membro) => (
                        <li key={membro.id} className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="truncate text-foreground">{membro.azienda}</span>
                          <span className="text-muted-foreground">
                            {[membro.citta, membro.paese].filter(Boolean).join(", ") || "—"}
                          </span>
                          <span className="ml-auto text-muted-foreground">{membro.interazioni} interazioni</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="truncate text-xs text-muted-foreground">
                      {gruppo.membri
                        .slice(0, 3)
                        .map((m) => m.azienda)
                        .join(" · ")}
                      {gruppo.membri.length > 3 ? " …" : ""}
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

export default DuplicatiPage;
