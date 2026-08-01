/**
 * TmweClientsPage — dashboard clienti TMWE sincronizzati.
 * Mostra lista snapshot con stato, listino, link partner Lovable e azione resync.
 * Logic-less: hook in `useTmwe.ts`, DAL in `src/data/tmwe.ts`.
 */
import * as React from "react";
import { Link } from "react-router-dom";
import { useTmweCustomers, useResyncTmweCustomer } from "@/v2/hooks/useTmwe";
import { Button } from "../atoms/Button";
import { Badge } from "../atoms/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, RefreshCw, Truck, Link as LinkIcon } from "lucide-react";

export function TmweClientsPage(): React.ReactElement {
  const { data, isLoading, isError, error } = useTmweCustomers();
  const resync = useResyncTmweCustomer();
  const [filter, setFilter] = React.useState("");

  const rows = React.useMemo(() => {
    const list = data ?? [];
    if (!filter.trim()) return list;
    const q = filter.toLowerCase();
    return list.filter(
      (r) =>
        (r.denomination ?? "").toLowerCase().includes(q) ||
        (r.vat ?? "").toLowerCase().includes(q) ||
        r.tmwe_client_id.toLowerCase().includes(q),
    );
  }, [data, filter]);

  return (
    <div className="container mx-auto p-6 space-y-4 max-w-6xl">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Truck className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Clienti TMWE</h1>
            <p className="text-sm text-muted-foreground">
              Snapshot anagrafica e fatturato sincronizzati da Findair.
            </p>
          </div>
        </div>
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Cerca per nome, P.IVA o ID…"
          className="h-9 w-64 rounded-md border bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        />
      </header>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {isLoading ? "Caricamento…" : `${rows.length} clienti sincronizzati`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : isError ? (
            <div className="p-6 text-sm text-destructive">
              Errore: {(error as Error)?.message ?? "impossibile caricare i clienti"}
            </div>
          ) : rows.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">
              Nessun cliente TMWE trovato. Collega un partner dal pannello dettaglio per popolare lo snapshot.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Cliente</th>
                    <th className="px-3 py-2 text-left font-medium">P.IVA</th>
                    <th className="px-3 py-2 text-left font-medium">Listino</th>
                    <th className="px-3 py-2 text-left font-medium">Stato</th>
                    <th className="px-3 py-2 text-left font-medium">Partner</th>
                    <th className="px-3 py-2 text-left font-medium">Ultimo sync</th>
                    <th className="px-3 py-2 text-right font-medium">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((r) => (
                    <tr key={r.tmwe_client_id} className="hover:bg-muted/30">
                      <td className="px-3 py-2">
                        <div className="font-medium text-foreground">{r.denomination ?? "—"}</div>
                        <div className="text-[11px] text-muted-foreground">ID {r.tmwe_client_id}</div>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{r.vat ?? "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.assigned_price_list_name ?? "—"}</td>
                      <td className="px-3 py-2">
                        <Badge variant={r.is_active ? "default" : "secondary"}>
                          {r.is_active ? "Attivo" : "Inattivo"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        {r.partner_id ? (
                          <Link
                            to={`/v2/explore/network?partner=${r.partner_id}`}
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            <LinkIcon className="h-3 w-3" /> apri
                          </Link>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">non collegato</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {new Date(r.last_synced_at).toLocaleString("it-IT")}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={resync.isPending}
                          onClick={() => resync.mutate(r.tmwe_client_id)}
                        >
                          <RefreshCw className={`h-3.5 w-3.5 ${resync.isPending ? "animate-spin" : ""}`} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}