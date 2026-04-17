/**
 * OptimusAgentPanel — vista completa stato Optimus Agent.
 *  - Overview per (channel, pageType): stato, confidence, plan_version, cache hit rate
 *  - Log recenti con filtri
 *  - Azioni manuali: forza refresh piano / reset memoria
 */
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Bot, RefreshCw, Trash2, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useOptimusOverview, useOptimusLogs, type OptimusOverviewRow } from "@/hooks/useOptimusStatus";
import { cn } from "@/lib/utils";

const CHANNEL_LABELS: Record<string, string> = { whatsapp: "WhatsApp", linkedin: "LinkedIn" };
const PAGETYPE_LABELS: Record<string, string> = {
  sidebar: "Sidebar chat", thread: "Conversazione", inbox: "Inbox", messaging: "Messaging",
};

function formatDate(s: string | null): string {
  if (!s) return "—";
  return new Date(s).toLocaleString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function statusBadge(row: OptimusOverviewRow) {
  if (row.consecutive_failures >= 3) {
    return <Badge variant="outline" className="border-red-500 text-red-600 bg-red-500/10 gap-1"><AlertTriangle className="w-3 h-3" />Errore</Badge>;
  }
  if (row.consecutive_failures > 0 || row.confidence <= 0.8) {
    return <Badge variant="outline" className="border-yellow-500 text-yellow-600 bg-yellow-500/10 gap-1"><Clock className="w-3 h-3" />DOM cambiato</Badge>;
  }
  return <Badge variant="outline" className="border-green-500 text-green-600 bg-green-500/10 gap-1"><CheckCircle2 className="w-3 h-3" />OK</Badge>;
}

function resultBadge(result: string | null) {
  if (!result) return <Badge variant="outline">—</Badge>;
  const colors: Record<string, string> = {
    success: "border-green-500 text-green-600 bg-green-500/10",
    retry_success: "border-blue-500 text-blue-600 bg-blue-500/10",
    partial: "border-yellow-500 text-yellow-600 bg-yellow-500/10",
    failure: "border-red-500 text-red-600 bg-red-500/10",
  };
  return <Badge variant="outline" className={cn(colors[result] || "")}>{result}</Badge>;
}

export function OptimusAgentPanel() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: overview = [], isLoading: ovLoading } = useOptimusOverview();

  const [filterChannel, setFilterChannel] = useState<string>("all");
  const [filterResult, setFilterResult] = useState<string>("all");
  const { data: logs = [], isLoading: logsLoading } = useOptimusLogs({ channel: filterChannel, result: filterResult, limit: 50 });

  const [busy, setBusy] = useState<string | null>(null);
  const [resetTarget, setResetTarget] = useState<{ channel: string; pageType: string } | null>(null);

  async function forceRefresh(channel: string, pageType: string) {
    const key = `refresh:${channel}:${pageType}`;
    setBusy(key);
    try {
      // Note: requires an active DOM snapshot from the extension; without it,
      // we can only mark the memory as stale and let the next "Leggi" rebuild.
      const { error } = await supabase
        .from("scraper_agent_memory")
        .update({ consecutive_failures: 99, dom_structure_hash: null })
        .eq("channel", channel)
        .eq("page_type", pageType);
      if (error) throw error;
      toast({ title: "Piano marcato come scaduto", description: `Al prossimo "Leggi" Optimus rigenererà il piano per ${CHANNEL_LABELS[channel]} · ${PAGETYPE_LABELS[pageType]}.` });
      qc.invalidateQueries({ queryKey: ["optimus-overview"] });
      qc.invalidateQueries({ queryKey: ["optimus-status"] });
    } catch (e) {
      toast({ title: "Errore", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }

  async function resetMemory(channel: string, pageType: string) {
    const key = `reset:${channel}:${pageType}`;
    setBusy(key);
    try {
      const { error } = await supabase
        .from("scraper_agent_memory")
        .delete()
        .eq("channel", channel)
        .eq("page_type", pageType);
      if (error) throw error;
      toast({ title: "Memoria azzerata", description: `Optimus ripartirà da zero al prossimo "Leggi" per ${CHANNEL_LABELS[channel]} · ${PAGETYPE_LABELS[pageType]}.` });
      qc.invalidateQueries({ queryKey: ["optimus-overview"] });
      qc.invalidateQueries({ queryKey: ["optimus-status"] });
      qc.invalidateQueries({ queryKey: ["optimus-logs"] });
    } catch (e) {
      toast({ title: "Errore", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setBusy(null);
      setResetTarget(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Bot className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">Optimus Agent</h2>
          <p className="text-xs text-muted-foreground">Agente AI che genera dinamicamente i piani di estrazione DOM per WhatsApp e LinkedIn</p>
        </div>
      </div>

      {/* Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {ovLoading && (
          <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Caricamento…</CardContent></Card>
        )}
        {!ovLoading && overview.length === 0 && (
          <Card className="md:col-span-2 lg:col-span-3">
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              Nessuna invocazione Optimus ancora registrata. Apri la sezione "In arrivo" e clicca "Leggi" su WhatsApp o LinkedIn.
            </CardContent>
          </Card>
        )}
        {overview.map((row) => {
          const cacheHits = row.total_invocations - row.total_ai_calls;
          const hitRate = row.total_invocations > 0 ? (cacheHits / row.total_invocations) * 100 : 0;
          const refreshKey = `refresh:${row.channel}:${row.page_type}`;
          const resetKey = `reset:${row.channel}:${row.page_type}`;
          return (
            <Card key={row.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-sm">{CHANNEL_LABELS[row.channel] ?? row.channel}</CardTitle>
                    <CardDescription className="text-[11px]">{PAGETYPE_LABELS[row.page_type] ?? row.page_type}</CardDescription>
                  </div>
                  {statusBadge(row)}
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-muted-foreground">Piano</div>
                    <div className="font-medium">v{row.plan_version}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Confidence</div>
                    <div className="font-medium">{(row.confidence * 100).toFixed(0)}%</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Invocazioni</div>
                    <div className="font-medium">{row.total_invocations}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Chiamate AI</div>
                    <div className="font-medium">{row.total_ai_calls}</div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-muted-foreground">Cache hit rate</span>
                    <span className="font-medium">{hitRate.toFixed(0)}%</span>
                  </div>
                  <Progress value={hitRate} className="h-1.5" />
                </div>

                <div className="text-[10px] text-muted-foreground space-y-0.5">
                  <div>Ultimo successo: {formatDate(row.last_success_at)}</div>
                  {row.last_failure_at && <div>Ultimo errore: {formatDate(row.last_failure_at)}</div>}
                </div>

                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" className="flex-1 h-7 text-[10px] gap-1" disabled={busy === refreshKey} onClick={() => forceRefresh(row.channel, row.page_type)}>
                    <RefreshCw className={cn("w-3 h-3", busy === refreshKey && "animate-spin")} /> Forza rinnovo
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 h-7 text-[10px] gap-1 text-red-600 hover:bg-red-500/10" disabled={busy === resetKey} onClick={() => setResetTarget({ channel: row.channel, pageType: row.page_type })}>
                    <Trash2 className="w-3 h-3" /> Reset
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Logs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="text-sm">Log invocazioni</CardTitle>
              <CardDescription className="text-[11px]">Ultime 50 chiamate a Optimus, in ordine cronologico</CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={filterChannel} onValueChange={setFilterChannel}>
                <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti i canali</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterResult} onValueChange={setFilterResult}>
                <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti gli esiti</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="retry_success">Retry success</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="failure">Failure</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[420px] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead className="w-[120px] text-[11px]">Quando</TableHead>
                  <TableHead className="text-[11px]">Canale</TableHead>
                  <TableHead className="text-[11px]">Tipo</TableHead>
                  <TableHead className="text-[11px]">Origine</TableHead>
                  <TableHead className="text-[11px]">Esito</TableHead>
                  <TableHead className="text-[11px] text-right">Items</TableHead>
                  <TableHead className="text-[11px] text-right">Latenza AI</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logsLoading && (
                  <TableRow><TableCell colSpan={7} className="text-center text-xs text-muted-foreground py-6">Caricamento…</TableCell></TableRow>
                )}
                {!logsLoading && logs.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-xs text-muted-foreground py-6">Nessun log disponibile</TableCell></TableRow>
                )}
                {logs.map((l) => (
                  <TableRow key={l.id} className="text-xs">
                    <TableCell className="text-[10px] whitespace-nowrap">{formatDate(l.created_at)}</TableCell>
                    <TableCell>{CHANNEL_LABELS[l.channel] ?? l.channel}</TableCell>
                    <TableCell>{PAGETYPE_LABELS[l.page_type] ?? l.page_type}</TableCell>
                    <TableCell>
                      {l.used_cached_plan
                        ? <Badge variant="outline" className="text-[9px] border-green-500 text-green-600 bg-green-500/10">cache</Badge>
                        : <Badge variant="outline" className="text-[9px] border-blue-500 text-blue-600 bg-blue-500/10">AI</Badge>}
                    </TableCell>
                    <TableCell>{resultBadge(l.execution_result)}</TableCell>
                    <TableCell className="text-right">
                      {l.items_extracted ?? 0}
                      {typeof l.items_found === "number" && l.items_found !== l.items_extracted && (
                        <span className="text-muted-foreground"> / {l.items_found}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-[10px]">{l.ai_latency_ms ? `${l.ai_latency_ms}ms` : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Reset confirm */}
      <AlertDialog open={resetTarget !== null} onOpenChange={(o) => !o && setResetTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resettare la memoria di Optimus?</AlertDialogTitle>
            <AlertDialogDescription>
              {resetTarget && (
                <>Stai per cancellare il piano corrente per <strong>{CHANNEL_LABELS[resetTarget.channel]} · {PAGETYPE_LABELS[resetTarget.pageType]}</strong>. Al prossimo "Leggi", Optimus ripartirà da zero generando un nuovo piano AI. Sei sicuro?</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => resetTarget && resetMemory(resetTarget.channel, resetTarget.pageType)}
            >
              Conferma reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
