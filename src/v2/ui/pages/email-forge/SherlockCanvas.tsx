/**
 * SherlockCanvas — Canvas investigativo a 3 livelli (Scout / Detective / Sherlock).
 * Riusa il pattern di rendering markdown di DeepSearchCanvas + aggiunge:
 *  - Selettore livello in header
 *  - Timeline step a sinistra (con stato per ogni step)
 *  - Tab Markdown / Findings AI / Sintesi finale a destra
 */
import * as React from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Search, Loader2, CheckCircle2, AlertCircle, X, Square, Database,
  FileText, Eye, Code2, Sparkles, SkipForward, ListChecks, Globe,
} from "lucide-react";
import { LazyMarkdown } from "@/components/ui/lazy-markdown";
import { useSherlock } from "@/v2/hooks/useSherlock";
import type { SherlockLevel, SherlockStepResult } from "@/v2/services/sherlock/sherlockTypes";
import type { ForgeRecipient } from "./ForgeRecipientPicker";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  recipient: ForgeRecipient | null;
}

const LEVEL_META: Record<SherlockLevel, { label: string; icon: string; eta: string }> = {
  1: { label: "Scout", icon: "🔍", eta: "~30s" },
  2: { label: "Detective", icon: "🕵️", eta: "~2min" },
  3: { label: "Sherlock", icon: "🎩", eta: "~5min" },
};

export function SherlockCanvas({ open, onOpenChange, recipient }: Props) {
  // Sito web modificabile manualmente: pre-popolato dal recipient se presente,
  // altrimenti scoperto automaticamente dall'engine al primo step.
  const [manualWebsite, setManualWebsite] = React.useState<string>("");
  React.useEffect(() => {
    setManualWebsite(recipient?.website?.trim() ?? "");
  }, [recipient?.recordId, recipient?.website]);

  const vars = React.useMemo<Record<string, string>>(() => {
    const r = recipient;
    const website = manualWebsite.trim();
    return {
      companyName: r?.companyName ?? "",
      city: r?.city ?? r?.countryName ?? r?.countryCode ?? "",
      websiteUrl: website,
      query: r ? `${r.companyName ?? ""} ${r.countryName ?? ""}`.trim() : "",
      linkedinCompanySlug: "",
    };
  }, [recipient, manualWebsite]);

  const sherlock = useSherlock({
    partnerId: recipient?.partnerId ?? null,
    contactId: recipient?.contactId ?? null,
    targetLabel: recipient?.companyName ?? recipient?.contactName ?? null,
    vars,
  });

  const skippedCount = sherlock.stepResults.filter((r) => r.status === "skipped").length;
  const discoveredWebsite = (sherlock.consolidated as { website_discovered?: string }).website_discovered;

  const [selectedOrder, setSelectedOrder] = React.useState<number | null>(null);
  React.useEffect(() => {
    if (sherlock.stepResults.length > 0 && selectedOrder === null) {
      setSelectedOrder(sherlock.stepResults[sherlock.stepResults.length - 1].order);
    }
  }, [sherlock.stepResults, selectedOrder]);

  React.useEffect(() => {
    if (!open) {
      sherlock.stop();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = sherlock.stepResults.find((r) => r.order === selectedOrder) ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-none w-[95vw] h-[92vh] p-0 gap-0 flex flex-col overflow-hidden"
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* HEADER */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card/50 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
            <Search className="w-4 h-4 text-primary" />
            Sherlock — Indagine investigativa
            {recipient && (
              <Badge variant="outline" className="ml-2 text-[10px] font-normal">
                {recipient.companyName ?? recipient.contactName}
              </Badge>
            )}
          </DialogTitle>

          <div className="flex items-center gap-1.5">
            {/* Selettore livello */}
            {([1, 2, 3] as SherlockLevel[]).map((lvl) => {
              const meta = LEVEL_META[lvl];
              const isRunning = sherlock.running === lvl;
              return (
                <Button
                  key={lvl}
                  size="sm"
                  variant={isRunning ? "default" : "outline"}
                  disabled={!!sherlock.running}
                  onClick={() => sherlock.start(lvl)}
                  className="h-7 px-2 text-[11px] gap-1"
                >
                  {isRunning
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <span className="text-[12px]">{meta.icon}</span>}
                  {meta.label}
                  <span className="text-[9px] text-muted-foreground ml-0.5">{meta.eta}</span>
                </Button>
              );
            })}
            {sherlock.running && (
              <Button size="sm" variant="destructive" onClick={sherlock.stop} className="h-7 text-[11px] gap-1">
                <Square className="w-3 h-3 fill-current" /> Stop
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)} className="h-7 w-7 p-0">
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* SUB-HEADER — input sito web manuale (cruciale per Detective/Sherlock) */}
        <div className="flex items-center gap-2 px-4 py-1.5 border-b border-border/60 bg-muted/30 shrink-0">
          <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <label className="text-[10px] font-medium text-muted-foreground shrink-0">Sito web partner:</label>
          <Input
            value={manualWebsite}
            onChange={(e) => setManualWebsite(e.target.value)}
            placeholder={discoveredWebsite ? `Auto-scoperto: ${discoveredWebsite}` : "https://… (lascia vuoto per scoperta automatica via Google)"}
            disabled={!!sherlock.running}
            className="h-7 text-[11px] flex-1 max-w-md"
          />
          {discoveredWebsite && !manualWebsite && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setManualWebsite(discoveredWebsite)}
              className="h-7 text-[10px]"
            >
              Usa scoperto
            </Button>
          )}
          {skippedCount > 0 && (
            <Badge variant="outline" className="text-[10px] gap-1 border-amber-500/40 text-amber-600 dark:text-amber-400">
              <SkipForward className="w-3 h-3" />
              {skippedCount} step saltati
            </Badge>
          )}
        </div>

        {/* SPLIT BODY */}
        <div className="flex-1 flex min-h-0">
          {/* LEFT — Timeline step */}
          <aside className="w-[340px] border-r border-border bg-muted/20 flex flex-col min-h-0">
            <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/40 shrink-0 flex items-center justify-between">
              <span>Timeline · {sherlock.stepResults.length} step</span>
              {sherlock.running && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {sherlock.stepResults.length === 0 && (
                  <div className="text-[10px] text-muted-foreground italic px-2 py-4 text-center">
                    Scegli un livello in alto per avviare l'indagine.
                  </div>
                )}
                {sherlock.stepResults.map((r) => (
                  <StepRow
                    key={r.order}
                    result={r}
                    active={r.order === selectedOrder}
                    onClick={() => setSelectedOrder(r.order)}
                  />
                ))}
              </div>
            </ScrollArea>
          </aside>

          {/* RIGHT — dettagli */}
          <main className="flex-1 flex flex-col min-h-0 bg-background">
            {selected ? (
              <Tabs defaultValue="markdown" className="flex-1 flex flex-col min-h-0">
                <div className="px-4 py-2 border-b border-border/40 shrink-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <StatusIcon status={selected.status} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold truncate text-foreground">{selected.label}</div>
                      <div className="text-[10px] text-muted-foreground font-mono truncate">{selected.url ?? "—"}</div>
                    </div>
                    {selected.confidence !== null && (
                      <Badge variant="outline" className="text-[9px]">
                        AI {Math.round(selected.confidence * 100)}%
                      </Badge>
                    )}
                    {selected.cache_hit && (
                      <Badge variant="secondary" className="text-[9px] gap-0.5">
                        <Database className="w-2.5 h-2.5" /> Cache
                      </Badge>
                    )}
                  </div>
                  <TabsList className="h-7">
                    <TabsTrigger value="markdown" className="text-[10px] h-6 px-2">
                      <Eye className="w-3 h-3 mr-1" /> Markdown
                    </TabsTrigger>
                    <TabsTrigger value="findings" className="text-[10px] h-6 px-2">
                      <Sparkles className="w-3 h-3 mr-1" /> Findings AI
                    </TabsTrigger>
                    <TabsTrigger value="summary" className="text-[10px] h-6 px-2">
                      <ListChecks className="w-3 h-3 mr-1" /> Sintesi finale
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="markdown" className="flex-1 min-h-0 mt-0">
                  {selected.status === "running" ? (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground py-12">
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Sherlock sta leggendo…
                    </div>
                  ) : selected.status === "error" ? (
                    <div className="p-6 text-center">
                      <AlertCircle className="w-6 h-6 text-destructive mx-auto mb-2" />
                      <div className="text-xs text-destructive">{selected.error}</div>
                    </div>
                  ) : selected.markdown ? (
                    <ScrollArea className="h-full">
                      <article className="prose prose-sm dark:prose-invert max-w-3xl mx-auto px-6 py-5
                        prose-headings:text-primary prose-strong:text-primary prose-a:text-primary">
                        <LazyMarkdown>{selected.markdown}</LazyMarkdown>
                      </article>
                    </ScrollArea>
                  ) : (
                    <div className="text-xs text-muted-foreground p-6 text-center">Nessun contenuto.</div>
                  )}
                </TabsContent>

                <TabsContent value="findings" className="flex-1 min-h-0 mt-0">
                  <ScrollArea className="h-full">
                    <div className="px-6 py-4 space-y-3">
                      {selected.suggested_next_url && (
                        <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
                          <div className="text-[10px] font-semibold uppercase text-primary mb-1">
                            💡 AI suggerisce prossima ricerca
                          </div>
                          <code className="text-[11px] font-mono text-foreground break-all">
                            {selected.suggested_next_url}
                          </code>
                        </div>
                      )}
                      <pre className="text-[11px] font-mono whitespace-pre-wrap break-words bg-muted/30 rounded-md p-3 text-foreground/90">
                        {JSON.stringify(selected.findings, null, 2)}
                      </pre>
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="summary" className="flex-1 min-h-0 mt-0">
                  <ScrollArea className="h-full">
                    <div className="px-6 py-4 space-y-3 max-w-3xl mx-auto">
                      {sherlock.summary && (
                        <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs text-foreground">
                          {sherlock.summary}
                        </div>
                      )}
                      <div className="text-[10px] font-semibold uppercase text-muted-foreground">
                        Findings consolidati ({Object.keys(sherlock.consolidated).length})
                      </div>
                      <pre className="text-[11px] font-mono whitespace-pre-wrap break-words bg-muted/30 rounded-md p-3 text-foreground/90">
                        {JSON.stringify(sherlock.consolidated, null, 2)}
                      </pre>
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center max-w-sm">
                  <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <div className="text-sm font-medium">Nessuna indagine in corso</div>
                  <div className="text-[11px] mt-1">
                    Scegli Scout (rapido), Detective (standard) o Sherlock (profondo) in alto a destra.
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StepRow({ result, active, onClick }: { result: SherlockStepResult; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-2 py-1.5 rounded text-[11px] flex items-start gap-1.5 transition-colors ${
        active ? "bg-primary/15 border border-primary/30" : "hover:bg-muted/60 border border-transparent"
      }`}
    >
      <StatusIcon status={result.status} small />
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{result.order}. {result.label}</div>
        <div className="text-[9px] text-muted-foreground truncate">
          {result.channel} · {result.duration_ms ? `${(result.duration_ms / 1000).toFixed(1)}s` : "—"}
          {result.cache_hit && " · cache"}
          {result.confidence !== null && ` · AI ${Math.round(result.confidence * 100)}%`}
        </div>
        {result.status === "error" && result.error && (
          <div className="text-[9px] text-destructive truncate mt-0.5">{result.error}</div>
        )}
      </div>
    </button>
  );
}

function StatusIcon({ status, small }: { status: SherlockStepResult["status"]; small?: boolean }) {
  const cls = small ? "w-3 h-3 mt-0.5" : "w-3.5 h-3.5";
  if (status === "running") return <Loader2 className={`${cls} animate-spin text-primary shrink-0`} />;
  if (status === "done") return <CheckCircle2 className={`${cls} text-emerald-500 shrink-0`} />;
  if (status === "cached") return <Database className={`${cls} text-blue-500 shrink-0`} />;
  if (status === "skipped") return <SkipForward className={`${cls} text-muted-foreground shrink-0`} />;
  if (status === "pending") return <div className={`${cls} rounded-full border border-muted-foreground/40 shrink-0`} />;
  return <AlertCircle className={`${cls} text-destructive shrink-0`} />;
}
