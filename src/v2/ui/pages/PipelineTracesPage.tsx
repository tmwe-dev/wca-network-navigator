/**
 * PipelineTracesPage — Visualizza passo-passo le procedure in atto nel sistema.
 *
 * 3 viste:
 *  - Live: stream realtime ultimi step (tutti)
 *  - Per Trace: timeline cronologica di un singolo trace_id
 *  - Per Step: aggregato per step_name (success rate, durata media)
 *
 * Read-only. I dati vengono scritti dalle edge function via _shared/pipelineTrace.ts
 */
import { useEffect, useMemo, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Search, ChevronRight, Activity, GitBranch, BarChart3, AlertCircle, CheckCircle2, SkipForward, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { PageShell } from "@/v2/ui/templates/PageShell";
import { supabase } from "@/integrations/supabase/client";
import {
  listPipelineTraces,
  getTraceTimeline,
  listDistinctEntityTypes,
  listDistinctStepNames,
  type PipelineTraceRow,
  type PipelineTraceStatus,
} from "@/data/pipelineTraces";

const STATUS_ICON: Record<PipelineTraceStatus, JSX.Element> = {
  started: <Loader2 className="h-3 w-3 animate-spin" />,
  success: <CheckCircle2 className="h-3 w-3" />,
  skipped: <SkipForward className="h-3 w-3" />,
  error: <AlertCircle className="h-3 w-3" />,
};

function statusVariant(s: PipelineTraceStatus): "default" | "secondary" | "destructive" | "outline" {
  switch (s) {
    case "success": return "default";
    case "error": return "destructive";
    case "skipped": return "secondary";
    default: return "outline";
  }
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function fmtJson(v: unknown): string {
  if (v == null) return "—";
  try { return JSON.stringify(v, null, 2); } catch { return String(v); }
}

export default function PipelineTracesPage() {
  const [tab, setTab] = useState<"live" | "trace" | "step">("live");
  const [rows, setRows] = useState<PipelineTraceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [entityType, setEntityType] = useState<string>("all");
  const [stepName, setStepName] = useState<string>("all");
  const [status, setStatus] = useState<PipelineTraceStatus | "all">("all");
  const [entityTypes, setEntityTypes] = useState<string[]>([]);
  const [stepNames, setStepNames] = useState<string[]>([]);
  const [traceIdInput, setTraceIdInput] = useState("");
  const [timeline, setTimeline] = useState<PipelineTraceRow[]>([]);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listPipelineTraces({ search, entityType, stepName, status, limit: 200 });
      setRows(data);
    } catch (e) {
      toast({ variant: "destructive", title: "Errore caricamento", description: String(e) });
    } finally {
      setLoading(false);
    }
  }, [search, entityType, stepName, status]);

  useEffect(() => { void load(); }, [load]);

  // Caricamento liste filtri
  useEffect(() => {
    void listDistinctEntityTypes().then(setEntityTypes).catch(() => undefined);
    void listDistinctStepNames().then(setStepNames).catch(() => undefined);
  }, []);

  // Realtime per la vista Live
  useEffect(() => {
    if (tab !== "live") return;
    const channel = supabase
      .channel("pipeline_traces_live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "pipeline_traces" }, (payload) => {
        const row = payload.new as PipelineTraceRow;
        setRows((prev) => [row, ...prev].slice(0, 200));
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [tab]);

  const loadTimeline = async () => {
    if (!traceIdInput.trim()) return;
    setLoading(true);
    try {
      const data = await getTraceTimeline(traceIdInput.trim());
      setTimeline(data);
      if (data.length === 0) toast({ title: "Nessun trace trovato per questo ID" });
    } catch (e) {
      toast({ variant: "destructive", title: "Errore", description: String(e) });
    } finally {
      setLoading(false);
    }
  };

  const stepStats = useMemo(() => {
    const map = new Map<string, { total: number; success: number; error: number; skipped: number; durations: number[] }>();
    for (const r of rows) {
      const cur = map.get(r.step_name) ?? { total: 0, success: 0, error: 0, skipped: 0, durations: [] };
      cur.total++;
      if (r.status === "success") cur.success++;
      else if (r.status === "error") cur.error++;
      else if (r.status === "skipped") cur.skipped++;
      if (r.duration_ms != null) cur.durations.push(r.duration_ms);
      map.set(r.step_name, cur);
    }
    return Array.from(map.entries())
      .map(([name, s]) => {
        const sorted = [...s.durations].sort((a, b) => a - b);
        const p50 = sorted.length ? sorted[Math.floor(sorted.length * 0.5)] : 0;
        const p95 = sorted.length ? sorted[Math.floor(sorted.length * 0.95)] : 0;
        return { name, ...s, p50, p95, successRate: s.total ? Math.round((s.success / s.total) * 100) : 0 };
      })
      .sort((a, b) => b.total - a.total);
  }, [rows]);

  const summaryStats = useMemo(() => {
    const success = rows.filter((r) => r.status === "success").length;
    const error = rows.filter((r) => r.status === "error").length;
    const skipped = rows.filter((r) => r.status === "skipped").length;
    const traces = new Set(rows.map((r) => r.trace_id)).size;
    return { total: rows.length, traces, success, error, skipped };
  }, [rows]);

  return (
    <PageShell
      width="wide"
      title="Pipeline Traces"
      description="Vedi passo-passo le procedure in atto: classificazione email, routing, escalation, agenda, invio."
      actions={
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Aggiorna
        </Button>
      }
    >
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Step recenti</div><div className="text-2xl font-bold">{summaryStats.total}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Trace univoci</div><div className="text-2xl font-bold">{summaryStats.traces}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Success</div><div className="text-2xl font-bold text-green-600">{summaryStats.success}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Errori</div><div className="text-2xl font-bold text-destructive">{summaryStats.error}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Skip</div><div className="text-2xl font-bold text-muted-foreground">{summaryStats.skipped}</div></CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "live" | "trace" | "step")} className="w-full">
        <TabsList>
          <TabsTrigger value="live"><Activity className="h-4 w-4 mr-1" /> Live</TabsTrigger>
          <TabsTrigger value="trace"><GitBranch className="h-4 w-4 mr-1" /> Per Trace</TabsTrigger>
          <TabsTrigger value="step"><BarChart3 className="h-4 w-4 mr-1" /> Per Step</TabsTrigger>
        </TabsList>

        <TabsContent value="live" className="space-y-3 mt-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Filtri</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <Input placeholder="Cerca…" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void load()} />
              <Select value={entityType} onValueChange={setEntityType}>
                <SelectTrigger><SelectValue placeholder="Tipo entità" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti i tipi</SelectItem>
                  {entityTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={stepName} onValueChange={setStepName}>
                <SelectTrigger><SelectValue placeholder="Step" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti gli step</SelectItem>
                  {stepNames.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={(v) => setStatus(v as PipelineTraceStatus | "all")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti gli stati</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="skipped">Skipped</SelectItem>
                  <SelectItem value="started">Started</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => void load()} disabled={loading}>Applica</Button>
            </CardContent>
          </Card>

          {rows.length === 0 && !loading && (
            <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
              Nessun trace ancora. Le edge function inizieranno a popolare questa lista appena emettono step (vedi <code>_shared/pipelineTrace.ts</code>).
            </CardContent></Card>
          )}
          <div className="space-y-1">
            {rows.map((r) => (
              <Card key={r.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => setExpandedRow(expandedRow === r.id ? null : r.id)}>
                <CardContent className="py-2 px-3">
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant={statusVariant(r.status)} className="gap-1">{STATUS_ICON[r.status]} {r.status}</Badge>
                    <Badge variant="outline">{r.entity_type}</Badge>
                    <span className="font-medium">{r.step_name}</span>
                    {r.entity_label && <span className="text-muted-foreground truncate max-w-[300px]">→ {r.entity_label}</span>}
                    {r.duration_ms != null && <span className="text-muted-foreground ml-auto">{r.duration_ms}ms</span>}
                    <span className="text-muted-foreground">{fmtTime(r.created_at)}</span>
                    <ChevronRight className={`h-3 w-3 transition-transform ${expandedRow === r.id ? "rotate-90" : ""}`} />
                  </div>
                  {expandedRow === r.id && (
                    <div className="mt-3 pt-3 border-t grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div>
                        <div className="font-semibold mb-1">Input</div>
                        <pre className="bg-muted/50 p-2 rounded text-[11px] overflow-auto max-h-60">{fmtJson(r.input_summary)}</pre>
                      </div>
                      <div>
                        <div className="font-semibold mb-1">Output</div>
                        <pre className="bg-muted/50 p-2 rounded text-[11px] overflow-auto max-h-60">{fmtJson(r.output_summary)}</pre>
                      </div>
                      {r.error_message && (
                        <div className="md:col-span-2">
                          <div className="font-semibold mb-1 text-destructive">Errore</div>
                          <pre className="bg-destructive/10 p-2 rounded text-[11px]">{r.error_message}</pre>
                        </div>
                      )}
                      <div className="md:col-span-2 flex flex-wrap gap-2 text-muted-foreground">
                        <span>trace: <button className="underline" onClick={(e) => { e.stopPropagation(); setTraceIdInput(r.trace_id); setTab("trace"); }}>{r.trace_id.slice(0, 8)}…</button></span>
                        {r.ai_model && <span>· model: {r.ai_model}</span>}
                        {r.ai_scope && <span>· scope: {r.ai_scope}</span>}
                        {r.entity_id && <span>· entity_id: {r.entity_id}</span>}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="trace" className="space-y-3 mt-4">
          <Card>
            <CardContent className="pt-4 flex gap-2">
              <Input placeholder="Inserisci trace_id (UUID)…" value={traceIdInput} onChange={(e) => setTraceIdInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void loadTimeline()} />
              <Button onClick={() => void loadTimeline()} disabled={loading || !traceIdInput.trim()}>
                <Search className="h-4 w-4 mr-1" /> Cerca
              </Button>
            </CardContent>
          </Card>
          {timeline.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
              Inserisci un trace_id per vedere la timeline cronologica completa di una procedura.
            </CardContent></Card>
          ) : (
            <div className="relative pl-8 space-y-3">
              <div className="absolute left-3 top-0 bottom-0 w-px bg-border" />
              {timeline.map((r) => (
                <div key={r.id} className="relative">
                  <div className={`absolute -left-[22px] top-3 h-3 w-3 rounded-full ${r.status === "success" ? "bg-green-500" : r.status === "error" ? "bg-destructive" : r.status === "skipped" ? "bg-muted-foreground" : "bg-primary animate-pulse"}`} />
                  <Card>
                    <CardContent className="py-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Badge variant="outline">#{r.step_order}</Badge>
                        <span className="font-semibold">{r.step_name}</span>
                        <Badge variant={statusVariant(r.status)} className="gap-1">{STATUS_ICON[r.status]} {r.status}</Badge>
                        {r.duration_ms != null && <span className="text-xs text-muted-foreground">{r.duration_ms}ms</span>}
                        <span className="text-xs text-muted-foreground ml-auto">{fmtTime(r.created_at)}</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 text-xs">
                        <div>
                          <div className="font-semibold mb-1">Input</div>
                          <pre className="bg-muted/50 p-2 rounded text-[11px] overflow-auto max-h-40">{fmtJson(r.input_summary)}</pre>
                        </div>
                        <div>
                          <div className="font-semibold mb-1">Output</div>
                          <pre className="bg-muted/50 p-2 rounded text-[11px] overflow-auto max-h-40">{fmtJson(r.output_summary)}</pre>
                        </div>
                      </div>
                      {r.error_message && <pre className="bg-destructive/10 p-2 rounded text-[11px] mt-2">{r.error_message}</pre>}
                      {(r.ai_model || r.ai_scope) && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          {r.ai_model && <span>model: {r.ai_model} </span>}
                          {r.ai_scope && <span>· scope: {r.ai_scope}</span>}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="step" className="space-y-3 mt-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground mb-2">Aggregato sugli ultimi {rows.length} step caricati. Ordinato per frequenza.</div>
              <div className="space-y-1">
                {stepStats.length === 0 && <div className="text-sm text-muted-foreground py-8 text-center">Nessun dato.</div>}
                {stepStats.map((s) => (
                  <div key={s.name} className="flex items-center gap-3 py-2 border-b last:border-0">
                    <span className="font-medium text-sm flex-1">{s.name}</span>
                    <Badge variant="outline">{s.total} run</Badge>
                    <Badge variant={s.successRate >= 90 ? "default" : s.successRate >= 50 ? "secondary" : "destructive"}>{s.successRate}% ok</Badge>
                    {s.error > 0 && <Badge variant="destructive">{s.error} err</Badge>}
                    {s.skipped > 0 && <Badge variant="secondary">{s.skipped} skip</Badge>}
                    {s.durations.length > 0 && <span className="text-xs text-muted-foreground tabular-nums">p50 {s.p50}ms · p95 {s.p95}ms</span>}
                    <Button size="sm" variant="ghost" onClick={() => { setStepName(s.name); setTab("live"); void load(); }}>Filtra</Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}