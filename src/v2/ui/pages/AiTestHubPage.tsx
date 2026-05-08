/**
 * AiTestHubPage — Hub unificato di test per le funzioni AI del sistema.
 *
 * Sostituisce AILabPage (gli scenari sono in DB, non hardcoded).
 * Permette di selezionare scenari, eseguirli, vedere pass/fail e dettaglio
 * della risposta. Editor inline per creare/modificare scenari personalizzati.
 */
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Play, CheckCircle2, XCircle, AlertTriangle, Plus, Trash2, FlaskConical } from "lucide-react";
import { useAiTestHub } from "@/v2/hooks/useAiTestHub";
import { PageTitleHeader } from "@/v2/ui/templates/PageTitleHeader";
import type { AiTestScenario } from "@/data/aiTestScenarios";

const CATEGORY_LABELS: Record<string, string> = {
  "finder-api": "Finder API",
  email: "Email",
  outreach: "Outreach",
  classification: "Classificazione",
  assistant: "Assistente AI",
  agent: "Agenti",
  general: "Altro",
};

export function AiTestHubPage() {
  const h = useAiTestHub();
  const [filterCat, setFilterCat] = useState<string>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, AiTestScenario[]>();
    for (const s of h.scenarios) {
      if (filterCat !== "all" && s.category !== filterCat) continue;
      if (!map.has(s.category)) map.set(s.category, []);
      map.get(s.category)!.push(s);
    }
    return Array.from(map.entries());
  }, [h.scenarios, filterCat]);

  const categories = useMemo(() => {
    const set = new Set(h.scenarios.map((s) => s.category));
    return Array.from(set).sort();
  }, [h.scenarios]);

  const summary = useMemo(() => {
    const r = Object.values(h.results);
    return {
      total: r.length,
      pass: r.filter((x) => x.status === "pass").length,
      fail: r.filter((x) => x.status === "fail").length,
      err: r.filter((x) => x.status === "error").length,
    };
  }, [h.results]);

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-6 max-w-[1400px] mx-auto space-y-4">
      <PageTitleHeader icon={FlaskConical} title="AI Test Hub" subtitle="Verifica routing, interpretazione e tool delle AI" />

      {/* Toolbar */}
      <Card>
        <CardContent className="p-3 flex flex-wrap items-center gap-2">
          <Button variant={filterCat === "all" ? "default" : "outline"} size="sm" onClick={() => setFilterCat("all")}>
            Tutte ({h.scenarios.length})
          </Button>
          {categories.map((c) => (
            <Button key={c} variant={filterCat === c ? "default" : "outline"} size="sm" onClick={() => setFilterCat(c)}>
              {CATEGORY_LABELS[c] ?? c}
            </Button>
          ))}
          <div className="flex-1" />
          <Button size="sm" variant="outline" onClick={() => h.setEditing({ category: "general", target_function: "ai-assistant", ai_scope: "lab", payload: {}, assertions: [{ type: "status_ok" }], tags: [], is_shared: true, is_active: true, priority: 100 })}>
            <Plus className="h-4 w-4 mr-1" /> Nuovo scenario
          </Button>
          <Button size="sm" variant="secondary" onClick={() => h.runSelected()} disabled={h.running || h.selectedIds.size === 0}>
            {h.running ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
            Esegui selezionati ({h.selectedIds.size})
          </Button>
          <Button size="sm" onClick={() => h.runAll()} disabled={h.running}>
            {h.running ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
            Esegui tutti
          </Button>
        </CardContent>
      </Card>

      {summary.total > 0 && (
        <Card>
          <CardContent className="p-3 flex items-center gap-3 text-sm">
            <Badge variant="outline">Eseguiti: {summary.total}</Badge>
            <Badge className="bg-success">✅ {summary.pass}</Badge>
            <Badge variant="destructive">❌ {summary.fail}</Badge>
            {summary.err > 0 && <Badge variant="default" className="bg-warning">⚠️ {summary.err}</Badge>}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-4">
        {/* Lista scenari */}
        <div className="space-y-4">
          {h.isLoading && <Loader2 className="h-5 w-5 animate-spin mx-auto" />}
          {!h.isLoading && grouped.length === 0 && (
            <Card><CardContent className="p-6 text-center text-muted-foreground">Nessuno scenario.</CardContent></Card>
          )}
          {grouped.map(([cat, items]) => (
            <Card key={cat}>
              <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium">{CATEGORY_LABELS[cat] ?? cat} <span className="text-muted-foreground font-normal">· {items.length}</span></CardTitle>
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => h.selectAll(items.map((i) => i.id))}>
                  Seleziona tutti
                </Button>
              </CardHeader>
              <CardContent className="pt-0 px-2 pb-2 space-y-1">
                {items.map((s) => {
                  const r = h.results[s.id];
                  const checked = h.selectedIds.has(s.id);
                  return (
                    <div key={s.id} className={`flex items-start gap-2 p-2 rounded border hover:bg-accent/30 cursor-pointer ${openId === s.id ? "bg-accent/40" : ""}`} onClick={() => setOpenId(openId === s.id ? null : s.id)}>
                      <input type="checkbox" checked={checked} onChange={(e) => { e.stopPropagation(); h.toggle(s.id); }} onClick={(e) => e.stopPropagation()} className="mt-1" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium truncate">{s.name}</span>
                          <Badge variant="outline" className="text-[10px]">{s.target_function}</Badge>
                          {r?.status === "pass" && <CheckCircle2 className="h-4 w-4 text-success" />}
                          {r?.status === "fail" && <XCircle className="h-4 w-4 text-destructive" />}
                          {r?.status === "error" && <AlertTriangle className="h-4 w-4 text-warning" />}
                          {r && <span className="text-[10px] text-muted-foreground">{r.duration_ms}ms · HTTP {r.http_status}</span>}
                        </div>
                        {s.description && <p className="text-xs text-muted-foreground truncate">{s.description}</p>}
                        {openId === s.id && (
                          <div className="mt-2 space-y-2">
                            <div className="text-xs">
                              <span className="text-muted-foreground">Payload:</span>
                              <pre className="text-[10px] bg-muted/50 p-2 rounded mt-1 overflow-x-auto max-h-40">{JSON.stringify(s.payload, null, 2)}</pre>
                            </div>
                            {r && (
                              <>
                                {r.failed_assertions.length > 0 && (
                                  <div className="text-xs">
                                    <span className="text-destructive font-medium">Assertion fallite:</span>
                                    <ul className="list-disc pl-4 text-[11px]">{r.failed_assertions.map((a, i) => <li key={i}>{a}</li>)}</ul>
                                  </div>
                                )}
                                <div className="text-xs">
                                  <span className="text-muted-foreground">Risposta:</span>
                                  <ScrollArea className="h-32 mt-1">
                                    <pre className="text-[10px] bg-muted/50 p-2 rounded">{r.response_preview}</pre>
                                  </ScrollArea>
                                </div>
                              </>
                            )}
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); h.setEditing(s); }}>Modifica</Button>
                              <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={(e) => { e.stopPropagation(); if (confirm(`Eliminare "${s.name}"?`)) h.remove(s.id); }}>
                                <Trash2 className="h-3 w-3 mr-1" /> Elimina
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Editor laterale */}
        {h.editing && (
          <Card className="lg:sticky lg:top-4 h-fit">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm">{h.editing.id ? "Modifica scenario" : "Nuovo scenario"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Nome</Label>
                <Input value={h.editing.name ?? ""} onChange={(e) => h.setEditing({ ...h.editing!, name: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Descrizione</Label>
                <Input value={h.editing.description ?? ""} onChange={(e) => h.setEditing({ ...h.editing!, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Categoria</Label>
                  <Input value={h.editing.category ?? ""} onChange={(e) => h.setEditing({ ...h.editing!, category: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">AI scope</Label>
                  <Input value={h.editing.ai_scope ?? ""} onChange={(e) => h.setEditing({ ...h.editing!, ai_scope: e.target.value })} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Edge function target</Label>
                <Input value={h.editing.target_function ?? ""} onChange={(e) => h.setEditing({ ...h.editing!, target_function: e.target.value })} placeholder="es. finder-api-chat" />
              </div>
              <div>
                <Label className="text-xs">Payload (JSON)</Label>
                <Textarea rows={6} className="font-mono text-xs" value={JSON.stringify(h.editing.payload ?? {}, null, 2)} onChange={(e) => {
                  try { h.setEditing({ ...h.editing!, payload: JSON.parse(e.target.value) }); } catch { /* ignore */ }
                }} />
              </div>
              <div>
                <Label className="text-xs">Assertion (JSON array)</Label>
                <Textarea rows={5} className="font-mono text-xs" value={JSON.stringify(h.editing.assertions ?? [], null, 2)} onChange={(e) => {
                  try { h.setEditing({ ...h.editing!, assertions: JSON.parse(e.target.value) }); } catch { /* ignore */ }
                }} />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => h.setEditing(null)}>Annulla</Button>
                <Button size="sm" onClick={() => h.save(h.editing!)} disabled={h.isSaving || !h.editing.name || !h.editing.target_function}>
                  {h.isSaving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                  Salva
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="bg-muted/30">
        <CardContent className="p-3 text-xs text-muted-foreground space-y-1">
          <p><strong>Standard di esecuzione</strong>: ogni scenario verifica routing (funzione corretta), interpretazione (risposta valida), tool (HTTP 2xx con payload conforme).</p>
          <p>Aggiungi assertion per controlli mirati. Tipi supportati: <code>status_ok</code>, <code>response_min_length</code>, <code>response_contains</code>, <code>response_not_contains</code>, <code>response_contains_key</code>, <code>json_path_equals</code>.</p>
        </CardContent>
      </Card>
    </div>
  );
}

export default AiTestHubPage;