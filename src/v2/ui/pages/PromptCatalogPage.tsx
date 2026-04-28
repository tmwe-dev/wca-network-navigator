/**
 * PromptCatalogPage — vista catalogo di tutti i prompt operativi con:
 *  - nome, contesto/canale, tag, priorità, stato
 *  - autore (operator) e owner
 *  - ultima versione + n. snapshot + ultimo cambio
 *  - orchestratori (edge functions consumer)
 *  - input sorgenti valorizzati (objective/procedure/criteria/examples)
 *
 * UI logic-less: tutta la logica vive in `usePromptCatalog`.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/providers/AuthProvider";
import {
  usePromptCatalog,
  applyCatalogFilters,
  useCatalogFacets,
  DEFAULT_CATALOG_FILTERS,
  type PromptCatalogFilters,
} from "./prompt-lab/hooks/usePromptCatalog";
import {
  ArrowLeft,
  Library,
  RefreshCw,
  History as HistoryIcon,
  Cpu,
  User as UserIcon,
  Tag,
} from "lucide-react";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export default function PromptCatalogPage() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { data, isLoading, isFetching, refetch, error } = usePromptCatalog(userId);
  const [filters, setFilters] = useState<PromptCatalogFilters>(DEFAULT_CATALOG_FILTERS);
  const facets = useCatalogFacets(data);

  const filtered = useMemo(() => applyCatalogFilters(data, filters), [data, filters]);

  const setFilter = <K extends keyof PromptCatalogFilters>(k: K, v: PromptCatalogFilters[K]) =>
    setFilters((prev) => ({ ...prev, [k]: v }));

  return (
    <div className="h-full w-full flex flex-col">
      <header className="border-b px-4 py-2 flex items-center justify-between bg-background flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Button asChild size="sm" variant="ghost" className="h-7 gap-1.5 -ml-2">
            <Link to="/v2/intelligence/prompt-lab">
              <ArrowLeft className="h-3.5 w-3.5" />
              Prompt Lab
            </Link>
          </Button>
          <Library className="h-4 w-4 text-primary flex-shrink-0 ml-2" />
          <h1 className="text-sm font-semibold leading-none">Prompt Catalog</h1>
          <span className="text-[11px] text-muted-foreground truncate hidden md:inline">
            — vista unificata di tutti i prompt operativi: versione, autore, orchestratori, input sorgenti.
          </span>
        </div>
        <Button size="sm" variant="outline" className="h-7 gap-1.5" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Aggiorna
        </Button>
      </header>

      <div className="flex-shrink-0 border-b px-4 py-2 bg-muted/30 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px] max-w-sm">
          <Input
            placeholder="Cerca per nome, contesto, tag…"
            value={filters.search}
            onChange={(e) => setFilter("search", e.target.value)}
            className="h-8 text-xs"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Label className="text-[11px] text-muted-foreground">Contesto</Label>
          <Select value={filters.context} onValueChange={(v) => setFilter("context", v)}>
            <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti</SelectItem>
              {facets.contexts.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1.5">
          <Label className="text-[11px] text-muted-foreground">Orchestratore</Label>
          <Select value={filters.orchestrator} onValueChange={(v) => setFilter("orchestrator", v)}>
            <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti</SelectItem>
              {facets.orchestrators.map((o) => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="only-active"
            checked={filters.onlyActive}
            onCheckedChange={(v) => setFilter("onlyActive", v)}
          />
          <Label htmlFor="only-active" className="text-[11px] text-muted-foreground cursor-pointer">
            Solo attivi
          </Label>
        </div>
        <div className="ml-auto text-[11px] text-muted-foreground">
          {isLoading ? "Caricamento…" : `${filtered.length} / ${data?.length ?? 0} prompt`}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-3">
        {error && (
          <Card className="p-3 border-destructive/40 bg-destructive/5 text-xs text-destructive mb-3">
            Errore caricamento catalogo: {error instanceof Error ? error.message : "sconosciuto"}
          </Card>
        )}
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Nome</TableHead>
                <TableHead className="text-xs">Contesto / Tag</TableHead>
                <TableHead className="text-xs">Versione</TableHead>
                <TableHead className="text-xs">Autore</TableHead>
                <TableHead className="text-xs">Orchestratori</TableHead>
                <TableHead className="text-xs">Input sorgenti</TableHead>
                <TableHead className="text-xs w-[80px]">Stato</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-xs text-muted-foreground py-8">
                    Nessun prompt corrisponde ai filtri.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((it) => {
                const filledFields: string[] = [];
                if (it.fields_filled.objective > 0) filledFields.push("objective");
                if (it.fields_filled.procedure > 0) filledFields.push("procedure");
                if (it.fields_filled.criteria > 0) filledFields.push("criteria");
                if (it.fields_filled.examples > 0) filledFields.push("examples");
                return (
                  <TableRow key={it.id} className="align-top">
                    <TableCell className="text-xs font-medium">
                      <div className="flex flex-col gap-0.5">
                        <span>{it.name}</span>
                        <span className="text-[10px] text-muted-foreground">prio {it.priority}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="flex flex-col gap-1">
                        {it.context && (
                          <Badge variant="secondary" className="text-[10px] h-5 w-fit">{it.context}</Badge>
                        )}
                        {it.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {it.tags.slice(0, 4).map((t) => (
                              <span key={t} className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                <Tag className="h-2.5 w-2.5" />{t}
                              </span>
                            ))}
                            {it.tags.length > 4 && (
                              <span className="text-[10px] text-muted-foreground">+{it.tags.length - 4}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="flex flex-col gap-0.5">
                        <span className="inline-flex items-center gap-1 font-mono">
                          <HistoryIcon className="h-3 w-3 text-muted-foreground" />
                          v{it.latest_version ?? "—"}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {it.versions_count} snapshot · {formatDate(it.last_change_at)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="inline-flex items-center gap-1">
                        <UserIcon className="h-3 w-3 text-muted-foreground" />
                        <span>{it.operator_name || (it.operator_id ? it.operator_id.slice(0, 8) : "—")}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {it.orchestrators.length === 0 ? (
                        <span className="text-[10px] text-muted-foreground">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {it.orchestrators.map((o) => (
                            <Badge key={o} variant="outline" className="text-[10px] h-5 gap-1">
                              <Cpu className="h-2.5 w-2.5" />{o}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {filledFields.length === 0 ? (
                        <span className="text-[10px] text-muted-foreground">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {filledFields.map((f) => (
                            <Badge key={f} variant="secondary" className="text-[10px] h-5">{f}</Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {it.is_active ? (
                        <Badge className="text-[10px] h-5 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">attivo</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] h-5 text-muted-foreground">disattivo</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}