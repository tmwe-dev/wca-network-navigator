/**
 * Operatori — chi può fare cosa. Maschera di tipo Lista.
 * UI senza logica: tutto lo stato vive in `useOperatori`.
 */
import * as React from "react";
import { Loader2, RefreshCw, ShieldCheck, UserPlus } from "lucide-react";
import { PageFrame } from "@/v3/app/PageFrame";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useOperatori, type FiltroRuolo, type FiltroStato } from "../useOperatori";

const STATI: readonly { readonly value: FiltroStato; readonly label: string }[] = [
  { value: "tutti", label: "Tutti" },
  { value: "attivi", label: "Attivi" },
  { value: "sospesi", label: "Sospesi" },
];

const RUOLI: readonly { readonly value: FiltroRuolo; readonly label: string }[] = [
  { value: "tutti", label: "Tutti" },
  { value: "admin", label: "Amministratori" },
  { value: "operatore", label: "Operatori" },
];

function RailGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function formatData(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
}

export function OperatoriPage(): React.ReactElement {
  const { operatori, totale, isLoading, error, ricerca, setRicerca, stato, setStato, ruolo, setRuolo, refetch } =
    useOperatori();

  const filters = (
    <>
      <RailGroup label="Ricerca">
        <Input
          value={ricerca}
          onChange={(event) => setRicerca(event.target.value)}
          placeholder="Email o nome"
          className="h-8 text-xs"
        />
      </RailGroup>

      <RailGroup label="Stato">
        <div className="flex flex-wrap gap-1">
          {STATI.map((option) => (
            <Button
              key={option.value}
              variant={stato === option.value ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setStato(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </RailGroup>

      <RailGroup label="Ruolo">
        <div className="flex flex-wrap gap-1">
          {RUOLI.map((option) => (
            <Button
              key={option.value}
              variant={ruolo === option.value ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setRuolo(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </RailGroup>
    </>
  );

  const workflow = (
    <>
      <RailGroup label="Gestione accessi">
        <Button variant="outline" size="sm" className="h-8 w-full justify-start gap-2 text-xs" disabled>
          <UserPlus className="h-3.5 w-3.5" />
          Invita operatore
        </Button>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Le modifiche alla whitelist restano in V2 finché il Modulo 1 non è completo.
        </p>
      </RailGroup>

      <RailGroup label="Stato dati">
        <p className="text-xs text-muted-foreground">
          {operatori.length} di {totale} visualizzati
        </p>
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs" onClick={refetch}>
          <RefreshCw className="h-3.5 w-3.5" />
          Aggiorna
        </Button>
      </RailGroup>
    </>
  );

  return (
    <PageFrame pageId="operatori" filters={filters} workflow={workflow}>
      {isLoading ? (
        <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Caricamento operatori…
        </div>
      ) : error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Impossibile caricare gli operatori: {error.message}
        </div>
      ) : operatori.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nessun operatore corrisponde ai filtri.
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Operatore</TableHead>
                <TableHead className="text-xs">Ruolo</TableHead>
                <TableHead className="text-xs">Stato</TableHead>
                <TableHead className="text-xs">Ultimo accesso</TableHead>
                <TableHead className="text-right text-xs">Accessi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {operatori.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{row.nome ?? row.email}</p>
                      {row.nome && <p className="truncate text-xs text-muted-foreground">{row.email}</p>}
                    </div>
                  </TableCell>
                  <TableCell className="py-2">
                    {row.admin ? (
                      <Badge variant="outline" className="gap-1 text-[11px]">
                        <ShieldCheck className="h-3 w-3" />
                        Admin
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Operatore</span>
                    )}
                  </TableCell>
                  <TableCell className="py-2">
                    <Badge variant={row.attivo ? "secondary" : "outline"} className="text-[11px]">
                      {row.attivo ? "Attivo" : "Sospeso"}
                    </Badge>
                    {row.soloWhitelist && (
                      <span className="ml-2 text-[11px] text-muted-foreground">solo whitelist</span>
                    )}
                  </TableCell>
                  <TableCell className="py-2 text-xs text-muted-foreground">{formatData(row.ultimoAccesso)}</TableCell>
                  <TableCell className="py-2 text-right text-xs tabular-nums text-muted-foreground">
                    {row.accessi}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </PageFrame>
  );
}

export default OperatoriPage;
