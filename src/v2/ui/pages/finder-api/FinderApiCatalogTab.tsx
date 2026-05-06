/**
 * FinderApiCatalogTab — visualizza i 443 endpoint TMWE sincronizzati
 * dalla doc ufficiale `/client_api_docs`. Permette toggle enabled e re-sync.
 */
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  listTmweCatalog,
  setTmweCatalogEnabled,
  syncTmweCatalog,
  tmweCatalogKeys,
  type TmweCatalogRow,
  type TmweRiskLevel,
} from "@/data/tmweApiCatalog";

const RISK_BADGE: Record<TmweRiskLevel, string> = {
  read: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  write: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  destructive: "bg-red-500/15 text-red-700 dark:text-red-300",
  admin: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
};

export const FinderApiCatalogTab = () => {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: tmweCatalogKeys.list(),
    queryFn: listTmweCatalog,
  });
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<TmweRiskLevel | "all">("all");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [syncing, setSyncing] = useState(false);

  const groups = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.api_group && set.add(r.api_group));
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (riskFilter !== "all" && r.risk_level !== riskFilter) return false;
      if (groupFilter !== "all" && r.api_group !== groupFilter) return false;
      if (!q) return true;
      return r.op.toLowerCase().includes(q)
        || r.path.toLowerCase().includes(q)
        || (r.description ?? "").toLowerCase().includes(q);
    });
  }, [rows, search, riskFilter, groupFilter]);

  const stats = useMemo(() => {
    const enabled = rows.filter((r) => r.enabled).length;
    const byRisk = rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.risk_level] = (acc[r.risk_level] ?? 0) + 1;
      return acc;
    }, {});
    return { total: rows.length, enabled, byRisk };
  }, [rows]);

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await syncTmweCatalog();
      if (!res.ok) throw new Error(res.error ?? "Sync fallito");
      toast.success(`Sync OK: ${res.upserted} endpoint, ${res.groups} gruppi, +${res.aliases} alias`);
      qc.invalidateQueries({ queryKey: tmweCatalogKeys.all });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore sync");
    } finally {
      setSyncing(false);
    }
  }

  async function toggle(row: TmweCatalogRow, value: boolean) {
    try {
      await setTmweCatalogEnabled(row.op, value);
      qc.invalidateQueries({ queryKey: tmweCatalogKeys.all });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore toggle");
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Catalogo TMWE Findair</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleSync} disabled={syncing}>
              {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Sync da /client_api_docs
            </Button>
            <div className="text-sm text-muted-foreground flex flex-wrap gap-3">
              <span>{stats.total} endpoint</span>
              <span>· {stats.enabled} abilitati</span>
              {Object.entries(stats.byRisk).map(([r, n]) => (
                <span key={r}>· {r}: {n}</span>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 absolute left-2 top-2.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cerca op, path, descrizione…"
                className="pl-8 h-9"
              />
            </div>
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value as TmweRiskLevel | "all")}
              className="h-9 px-2 rounded-md border bg-background text-sm"
            >
              <option value="all">Tutti i rischi</option>
              <option value="read">read</option>
              <option value="write">write</option>
              <option value="destructive">destructive</option>
              <option value="admin">admin</option>
            </select>
            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              className="h-9 px-2 rounded-md border bg-background text-sm max-w-[200px]"
            >
              <option value="all">Tutti i gruppi</option>
              {groups.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Caricamento catalogo…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-muted-foreground p-4 border rounded-md">
          {rows.length === 0
            ? "Catalogo vuoto. Premi 'Sync da /client_api_docs' per popolare i 443 endpoint TMWE."
            : "Nessun endpoint corrisponde ai filtri attuali."}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">On</TableHead>
                  <TableHead className="w-16">Risk</TableHead>
                  <TableHead className="w-16">Method</TableHead>
                  <TableHead className="w-64">Op</TableHead>
                  <TableHead>Path</TableHead>
                  <TableHead className="w-40">Group</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(0, 500).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Switch checked={r.enabled} onCheckedChange={(v) => toggle(r, v)} />
                    </TableCell>
                    <TableCell>
                      <Badge className={`${RISK_BADGE[r.risk_level]} font-normal`}>{r.risk_level}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.method}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {r.op}
                      {r.is_alias && <Badge variant="outline" className="ml-2 text-[10px]">alias</Badge>}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{r.path}</TableCell>
                    <TableCell className="text-xs">{r.api_group}</TableCell>
                    <TableCell className="text-xs text-muted-foreground line-clamp-2">{r.description}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {filtered.length > 500 && (
              <div className="p-2 text-xs text-muted-foreground border-t">
                Mostrati 500/{filtered.length}. Affina i filtri per vedere il resto.
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default FinderApiCatalogTab;