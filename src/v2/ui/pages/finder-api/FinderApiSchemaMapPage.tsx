/**
 * FinderApiSchemaMapPage — Pagina nascosta /v2/finder-api/schema
 *
 * Mostra la SCHEMA MAP TMWE: per ogni op (whitelist) e ogni campo conosciuto,
 * il ruolo logico (id_interno, tracking_code, data, stato, note, ...).
 * Permette di "scoprire" nuovi campi chiamando un'op TMWE e fare ingest del
 * primo record nella mappa (ruolo iniziale = 'altro', editabile inline).
 *
 * Questa mappa è iniettata nel system prompt di finder-api-chat e
 * permette all'agente di non "tirare a indovinare" la posizione dei dati.
 *
 * Non è in sidebar: si raggiunge solo da link diretto o dalla pagina Finder API.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, RefreshCw, Trash2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FinderApiCatalogTab from "./FinderApiCatalogTab";
import { CommandPageBackButton } from "../command/components/CommandPageBackButton";
import {
  listFinderApiSchemaMap,
  upsertFinderApiSchemaField,
  deleteFinderApiSchemaField,
  ingestSampleIntoSchemaMap,
  finderApiSchemaKeys,
  type FinderApiSchemaField,
  type SchemaRole,
} from "@/data/finderApiSchemaMap";

const TMWE_OPS = [
  "profile.me",
  "tracking.byAwb",
  "shipment.list",
  "shipment.unified",
  "rubrica.search",
  "system.health",
] as const;

const ROLES: SchemaRole[] = [
  "id_interno", "tracking_code", "data", "stato",
  "note", "servizio", "cliente", "contatto", "altro",
];

const ROLE_COLORS: Record<SchemaRole, string> = {
  id_interno: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  tracking_code: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  data: "bg-success/15 text-success dark:text-success",
  stato: "bg-warning/15 text-warning dark:text-warning",
  note: "bg-slate-500/15 text-foreground dark:text-slate-300",
  servizio: "bg-pink-500/15 text-pink-700 dark:text-pink-300",
  cliente: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  contatto: "bg-info/15 text-info dark:text-info",
  altro: "bg-muted text-muted-foreground",
};

const FinderApiSchemaMapPage = () => {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: finderApiSchemaKeys.list(),
    queryFn: listFinderApiSchemaMap,
  });

  const [discoverOp, setDiscoverOp] = useState<string>("shipment.list");
  const [discovering, setDiscovering] = useState(false);

  const grouped = rows.reduce<Record<string, FinderApiSchemaField[]>>((acc, r) => {
    (acc[r.op] ??= []).push(r);
    return acc;
  }, {});

  async function handleDiscover() {
    setDiscovering(true);
    try {
      const { data, error } = await supabase.functions.invoke("tmwe-proxy", {
        body: { op: discoverOp, params: {} },
      });
      if (error) throw error;
      const payload = (data as { data?: { data?: unknown[] } | unknown[] } | null)?.data;
      const sample = Array.isArray(payload)
        ? payload[0]
        : Array.isArray((payload as { data?: unknown[] })?.data)
          ? ((payload as { data?: unknown[] }).data as unknown[])[0]
          : payload;
      if (!sample || typeof sample !== "object") {
        toast.warning("Nessun campione disponibile per questa op.");
        return;
      }
      const res = await ingestSampleIntoSchemaMap(discoverOp, sample as Record<string, unknown>);
      toast.success(`Discover OK: ${res.added} nuovi, ${res.skipped} già noti.`);
      qc.invalidateQueries({ queryKey: finderApiSchemaKeys.all });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore discover.");
    } finally {
      setDiscovering(false);
    }
  }

  return (
    <div className="container mx-auto p-6 pt-20 space-y-6">
      <CommandPageBackButton currentPath="/v2/finder-api/schema" />
      <div className="fixed top-6 left-[120px] z-50 flex items-center px-3 py-2 rounded-xl text-[11px] font-medium text-foreground/90 bg-white/5 backdrop-blur-md border border-white/[0.06]">
        Finder API · Catalog
      </div>
      <div>
        <h1 className="text-2xl font-bold">Finder API · Schema Map</h1>
        <p className="text-sm text-muted-foreground">
          Catalogo dei 443 endpoint TMWE Findair + mappa campi→ruolo per le op più usate.
          Tutto è iniettato nel prompt dell'agente Finder API per evitare ricerche cieche.
        </p>
      </div>

      <Tabs defaultValue="catalog">
        <TabsList>
          <TabsTrigger value="catalog">Catalogo (443 endpoint)</TabsTrigger>
          <TabsTrigger value="schema">Schema Map (campi → ruoli)</TabsTrigger>
        </TabsList>
        <TabsContent value="catalog" className="mt-4">
          <FinderApiCatalogTab />
        </TabsContent>
        <TabsContent value="schema" className="mt-4 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Discover campi da un'op</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Operazione</label>
            <Select value={discoverOp} onValueChange={setDiscoverOp}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TMWE_OPS.map((op) => (
                  <SelectItem key={op} value={op}>{op}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleDiscover} disabled={discovering}>
            {discovering ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Chiama op e registra campi mancanti
          </Button>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Caricamento mappa…
        </div>
      ) : (
        Object.entries(grouped).map(([op, fields]) => (
          <SchemaOpTable key={op} op={op} fields={fields} />
        ))
      )}
      {!isLoading && Object.keys(grouped).length === 0 && (
        <div className="text-sm text-muted-foreground">
          Nessun campo mappato. Usa "Discover" per iniziare.
        </div>
      )}
        </TabsContent>
      </Tabs>
    </div>
  );

  function SchemaOpTable({ op, fields }: { op: string; fields: FinderApiSchemaField[] }) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-mono">{op}</CardTitle>
          <Badge variant="outline">{fields.length} campi</Badge>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-48">Campo</TableHead>
                <TableHead className="w-44">Ruolo</TableHead>
                <TableHead>Descrizione</TableHead>
                <TableHead className="w-48">Esempio</TableHead>
                <TableHead className="w-28 text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((f) => (
                <SchemaRow key={f.id} row={f} />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  }

  function SchemaRow({ row }: { row: FinderApiSchemaField }) {
    const [role, setRole] = useState<SchemaRole>(row.role);
    const [description, setDescription] = useState(row.description ?? "");
    const [example, setExample] = useState(row.example ?? "");
    const dirty =
      role !== row.role ||
      description !== (row.description ?? "") ||
      example !== (row.example ?? "");

    async function save() {
      try {
        await upsertFinderApiSchemaField({
          op: row.op, field: row.field, role,
          description, example,
        });
        toast.success(`${row.field} salvato.`);
        qc.invalidateQueries({ queryKey: finderApiSchemaKeys.all });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Errore salvataggio.");
      }
    }
    async function remove() {
      if (!confirm(`Eliminare ${row.field}?`)) return;
      try {
        await deleteFinderApiSchemaField(row.id);
        toast.success("Eliminato.");
        qc.invalidateQueries({ queryKey: finderApiSchemaKeys.all });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Errore eliminazione.");
      }
    }

    return (
      <TableRow>
        <TableCell className="font-mono text-xs">{row.field}</TableCell>
        <TableCell>
          <Select value={role} onValueChange={(v) => setRole(v as SchemaRole)}>
            <SelectTrigger className="h-8">
              <SelectValue>
                <Badge className={`${ROLE_COLORS[role]} font-normal`}>{role}</Badge>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Cosa rappresenta questo campo…"
            className="h-8"
          />
        </TableCell>
        <TableCell>
          <Input
            value={example}
            onChange={(e) => setExample(e.target.value)}
            className="h-8 font-mono text-xs"
          />
        </TableCell>
        <TableCell className="text-right">
          <div className="flex justify-end gap-1">
            <Button size="icon" variant="ghost" disabled={!dirty} onClick={save} title="Salva">
              <Save className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={remove} title="Elimina">
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  }
};

export { FinderApiSchemaMapPage };
export default FinderApiSchemaMapPage;