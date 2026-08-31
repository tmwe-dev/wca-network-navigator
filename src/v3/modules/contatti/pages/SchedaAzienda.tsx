/**
 * Scheda azienda — popup standard V3.
 *
 * Regola: quando una riga appartiene a un'azienda con più persone, il pulsante
 * "N persone" apre QUESTA finestra, non naviga. Dentro c'è l'elenco delle
 * persone di quell'azienda (tutte le fonti) e l'azione per filtrare l'elenco
 * principale su quell'azienda.
 */
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Filter } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { queryKeys } from "@/lib/queryKeys";
import { listAnagraficaV3, ETICHETTE_FONTE } from "@/data/v3/anagrafiche";
import { CompanyLogo } from "@/v3/ui/CompanyLogo";
import { InterazioniBadge, StatoCircuitoBadge } from "@/v3/ui/StatoBadge";

export function SchedaAzienda({
  azienda,
  dominio,
  onChiudi,
  onFiltraAzienda,
  onApriContatto,
}: {
  readonly azienda: string | null;
  readonly dominio: string | null;
  readonly onChiudi: () => void;
  readonly onFiltraAzienda: (azienda: string) => void;
  readonly onApriContatto: (id: string) => void;
}): React.ReactElement {
  const chiave = (azienda ?? "").trim().toLowerCase();

  const parametri = React.useMemo(
    () => ({ aziende: chiave ? [chiave] : [], ordine: "nome" as const, discendente: false, pagina: 0, perPagina: 100 }),
    [chiave],
  );

  const query = useQuery({
    queryKey: queryKeys.v3.anagrafica(parametri),
    queryFn: () => listAnagraficaV3(parametri),
    enabled: Boolean(chiave),
    staleTime: 30_000,
  });

  const righe = query.data?.righe ?? [];

  return (
    <Dialog open={Boolean(azienda)} onOpenChange={(aperto) => !aperto && onChiudi()}>
      <DialogContent className="v3-root max-w-2xl text-left">
        <DialogHeader className="text-left">
          <DialogTitle className="flex items-center gap-2 text-left text-base">
            <CompanyLogo dominio={dominio} nome={azienda} />
            <span className="truncate">{azienda ?? "Azienda"}</span>
          </DialogTitle>
        </DialogHeader>

        {query.isLoading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Caricamento persone…
          </div>
        ) : (
          <>
            <p className="text-left text-xs text-muted-foreground">
              {righe.length} {righe.length === 1 ? "persona collegata" : "persone collegate"}
            </p>
            <ul className="max-h-[50vh] divide-y divide-border overflow-y-auto rounded-lg border border-border">
              {righe.map((riga) => (
                <li key={`${riga.fonte}-${riga.id}`}>
                  <button
                    type="button"
                    onClick={() => {
                      if (riga.fonte === "crm") onApriContatto(riga.id);
                    }}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-accent/15"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-foreground">{riga.nome ?? "Senza nome"}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {riga.ruolo ? `${riga.ruolo} · ` : ""}
                        {riga.email ?? "nessuna email"}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{ETICHETTE_FONTE[riga.fonte]}</span>
                    <StatoCircuitoBadge stato={riga.stato} />
                    <InterazioniBadge numero={riga.interazioni} />
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex justify-start">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (chiave) onFiltraAzienda(chiave);
                  onChiudi();
                }}
              >
                <Filter className="mr-1.5 h-3.5 w-3.5" />
                Filtra l'elenco su questa azienda
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default SchedaAzienda;
