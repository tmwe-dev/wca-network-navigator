/**
 * DeepSearchCanvas — pop-up operativo a tutta finestra per pilotare FireScrape
 * direttamente dalla webapp e vedere in tempo reale ciò che l'estensione legge.
 *
 * Layout split:
 *   - SINISTRA (340px): controlli + lista pagine lette (live feed)
 *   - DESTRA  (flex)  : markdown formattato della pagina selezionata
 *
 * Streaming: usa fs.runSequenceWithProgress per eseguire gli step uno alla
 * volta e popolare la lista mano a mano che FireScrape risponde.
 */
import * as React from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Flame, Play, Loader2, CheckCircle2, AlertCircle, Globe, MapPin,
  Star, Search, FileText, Copy, Eye, Code2, X, Trash2, Square, Database,
} from "lucide-react";
import { toast } from "sonner";
import { fs } from "@/v2/io/extensions/bridge";
import {
  ALL_PIPELINES, resolvePipelineUrls, type PipelineKey,
} from "@/v2/io/extensions/deep-search-pipelines";
import { LazyMarkdown } from "@/components/ui/lazy-markdown";
import { untypedFrom } from "@/lib/supabaseUntyped";
import type { ForgeRecipient } from "./ForgeRecipientPicker";

/** Salva il markdown nello storage persistente (tabella scrape_cache, dedup per URL). */
async function persistScrape(args: {
  url: string;
  markdown: string;
  pipelineKey: string;
  recipient: ForgeRecipient | null;
}): Promise<boolean> {
  try {
    const { error } = await untypedFrom("scrape_cache").upsert({
      url: args.url,
      mode: "static",
      payload: {
        markdown: args.markdown,
        pipeline: args.pipelineKey,
        recipient: args.recipient
          ? {
              partnerId: args.recipient.partnerId ?? null,
              contactId: args.recipient.contactId ?? null,
              companyName: args.recipient.companyName ?? null,
              countryCode: args.recipient.countryCode ?? null,
            }
          : null,
        captured_at: new Date().toISOString(),
      },
      scraped_at: new Date().toISOString(),
    });
    return !error;
  } catch {
    return false;
  }
}

interface CapturedPage {
  id: string;
  pipelineKey: PipelineKey | "manual";
  url: string;
  status: "pending" | "running" | "done" | "error";
  markdown: string;
  error?: string;
  startedAt: number;
  durationMs?: number;
  persisted?: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  recipient: ForgeRecipient | null;
}

const PIPELINE_ICONS: Record<PipelineKey, React.ComponentType<{ className?: string }>> = {
  googleMaps: MapPin,
  websiteMultiPage: Globe,
  reputation: Star,
  googleGeneral: Search,
};

export function DeepSearchCanvas({ open, onOpenChange, recipient }: Props) {
  const [pages, setPages] = React.useState<CapturedPage[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [running, setRunning] = React.useState<PipelineKey | "manual" | null>(null);
  const [manualUrl, setManualUrl] = React.useState("");
  const abortRef = React.useRef<AbortController | null>(null);

  const selected = pages.find((p) => p.id === selectedId) ?? null;

  // Auto-precompila variabili pipeline dal recipient
  const vars = React.useMemo(() => {
    const r = recipient;
    return {
      companyName: r?.companyName ?? "",
      city: r?.countryName ?? r?.countryCode ?? "",
      websiteUrl: "",
      query: r ? `${r.companyName ?? ""} ${r.countryName ?? ""}`.trim() : "",
    };
  }, [recipient]);

  const stop = React.useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setPages((prev) => prev.map((p) =>
      p.status === "running"
        ? { ...p, status: "error", error: "Interrotto dall'utente", durationMs: Date.now() - p.startedAt }
        : p,
    ));
    setRunning(null);
    toast.info("Operazione interrotta");
  }, []);

  // Reset abort se si chiude il dialog
  React.useEffect(() => {
    if (!open && abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
      setRunning(null);
    }
  }, [open]);

  const runPipeline = async (key: PipelineKey) => {
    if (running) return;
    setRunning(key);
    const controller = new AbortController();
    abortRef.current = controller;

    let plan: { urls: string[]; settleMs: number };
    try {
      plan = resolvePipelineUrls(ALL_PIPELINES[key], vars);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore pipeline");
      setRunning(null);
      abortRef.current = null;
      return;
    }

    // Pre-crea le card delle pagine come "pending" — si accenderanno una alla volta
    const idByIdx = plan.urls.map((_url, i) => `${key}-${i}-${Date.now()}`);
    const initial: CapturedPage[] = plan.urls.map((url, i) => ({
      id: idByIdx[i],
      pipelineKey: key,
      url,
      status: "pending",
      markdown: "",
      startedAt: 0,
    }));
    setPages((prev) => [...prev, ...initial]);
    setSelectedId((s) => s ?? idByIdx[0]);

    // Eseguiamo URL per URL così possiamo marcare "running" → "done/error" puntualmente
    for (let i = 0; i < plan.urls.length; i++) {
      if (controller.signal.aborted) break;
      const id = idByIdx[i];
      const startedAt = Date.now();
      // Mark as running NOW (prima del navigate)
      setPages((prev) => prev.map((p) => p.id === id ? { ...p, status: "running", startedAt } : p));
      setSelectedId(id);

      const res = await fs.readUrl(plan.urls[i], {
        settleMs: plan.settleMs,
        signal: controller.signal,
        skipCache: true,
      });

      const md = res.ok ? extractMarkdown(res.data) : "";
      let persisted = false;
      if (res.ok && md) {
        persisted = await persistScrape({
          url: plan.urls[i], markdown: md, pipelineKey: key, recipient,
        });
      }

      setPages((prev) => prev.map((p) => p.id === id
        ? {
            ...p,
            status: res.ok ? "done" : "error",
            markdown: md,
            error: !res.ok ? res.error : undefined,
            durationMs: Date.now() - startedAt,
            persisted,
          }
        : p,
      ));

      if (!res.ok && !controller.signal.aborted) {
        // Errore non da abort: interrompiamo la pipeline e marchiamo i rimanenti come saltati
        setPages((prev) => prev.map((p, idx) => {
          const myIdx = idByIdx.indexOf(p.id);
          if (myIdx > i && p.status === "pending") {
            return { ...p, status: "error", error: "Saltato (errore precedente)" };
          }
          return p;
        }));
        break;
      }
    }

    // Marca eventuali pagine "pending" o "running" rimaste (caso abort) come errore
    setPages((prev) => prev.map((p) =>
      idByIdx.includes(p.id) && (p.status === "pending" || p.status === "running")
        ? { ...p, status: "error", error: "Interrotto", durationMs: p.startedAt ? Date.now() - p.startedAt : 0 }
        : p,
    ));

    abortRef.current = null;
    setRunning(null);
    if (!controller.signal.aborted) {
      toast.success(`Pipeline "${ALL_PIPELINES[key].label}" completata`);
    }
  };

  const runManual = async () => {
    if (running || !manualUrl.trim()) return;
    setRunning("manual");
    const controller = new AbortController();
    abortRef.current = controller;
    const id = `manual-${Date.now()}`;
    setPages((prev) => [...prev, {
      id, pipelineKey: "manual", url: manualUrl,
      status: "running", markdown: "", startedAt: Date.now(),
    }]);
    setSelectedId(id);

    const res = await fs.readUrl(manualUrl, { settleMs: 2500, signal: controller.signal, skipCache: true });
    const md = res.ok ? extractMarkdown(res.data) : "";
    let persisted = false;
    if (res.ok && md) {
      persisted = await persistScrape({ url: manualUrl, markdown: md, pipelineKey: "manual", recipient });
    }
    setPages((prev) => prev.map((p) => p.id === id
      ? {
          ...p,
          status: res.ok ? "done" : "error",
          markdown: md,
          error: !res.ok ? res.error : undefined,
          durationMs: Date.now() - p.startedAt,
          persisted,
        }
      : p,
    ));
    abortRef.current = null;
    setRunning(null);
    if (res.ok) toast.success(persisted ? "Pagina letta e salvata" : "Pagina letta");
    else if (!controller.signal.aborted) toast.error(res.error);
  };

  const clearAll = () => {
    if (running) return;
    setPages([]);
    setSelectedId(null);
  };

  const copyMd = async (md: string) => {
    try {
      await navigator.clipboard.writeText(md);
      toast.success("Markdown copiato");
    } catch { toast.error("Copia fallita"); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-none w-[95vw] h-[92vh] p-0 gap-0 flex flex-col overflow-hidden"
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* HEADER */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card/50 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
            <Flame className="w-4 h-4 text-orange-500" />
            FireScrape Canvas
            {recipient && (
              <Badge variant="outline" className="ml-2 text-[10px] font-normal">
                {recipient.companyName ?? recipient.contactName}
              </Badge>
            )}
          </DialogTitle>
          <div className="flex items-center gap-1.5">
            {running && (
              <Button
                size="sm"
                variant="destructive"
                onClick={stop}
                className="h-7 text-[11px] gap-1"
              >
                <Square className="w-3 h-3 fill-current" /> Stop
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={clearAll} disabled={pages.length === 0 || !!running}
              className="h-7 text-[11px]">
              <Trash2 className="w-3 h-3 mr-1" /> Pulisci
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)} className="h-7 w-7 p-0">
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* SPLIT BODY */}
        <div className="flex-1 flex min-h-0">
          {/* LEFT — controlli + feed live */}
          <aside className="w-[340px] border-r border-border bg-muted/20 flex flex-col min-h-0">
            {/* Pipeline buttons */}
            <div className="p-3 space-y-2 border-b border-border/40 shrink-0">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Pipeline rapide
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {(Object.keys(ALL_PIPELINES) as PipelineKey[]).map((k) => {
                  const p = ALL_PIPELINES[k];
                  const Icon = PIPELINE_ICONS[k];
                  const isRunning = running === k;
                  const disabled = !!running || (p.requiredVars.some((v) => !vars[v as keyof typeof vars]));
                  return (
                    <Button
                      key={k}
                      size="sm"
                      variant="outline"
                      disabled={disabled}
                      onClick={() => runPipeline(k)}
                      className="h-auto py-1.5 px-2 justify-start text-left gap-2"
                    >
                      {isRunning
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
                        : <Icon className="w-3.5 h-3.5 text-primary shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-medium truncate">{p.label}</div>
                        <div className="text-[9px] text-muted-foreground truncate">{p.description}</div>
                      </div>
                    </Button>
                  );
                })}
              </div>

              {/* Manual URL */}
              <div className="pt-2 border-t border-border/40 space-y-1">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  URL manuale
                </div>
                <div className="flex gap-1">
                  <Input
                    value={manualUrl}
                    onChange={(e) => setManualUrl(e.target.value)}
                    placeholder="https://…"
                    className="h-7 text-[11px] font-mono"
                    onKeyDown={(e) => { if (e.key === "Enter") runManual(); }}
                  />
                  <Button size="sm" disabled={!!running || !manualUrl.trim()}
                    onClick={runManual} className="h-7 px-2">
                    {running === "manual"
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <Play className="w-3 h-3" />}
                  </Button>
                </div>
              </div>
            </div>

            {/* Live feed pagine */}
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/40 shrink-0 flex items-center justify-between">
                <span>Pagine lette · {pages.length}</span>
                {running && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
              </div>
              <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                  {pages.length === 0 && (
                    <div className="text-[10px] text-muted-foreground italic px-2 py-4 text-center">
                      Nessuna pagina ancora letta. Lancia una pipeline o un URL.
                    </div>
                  )}
                  {pages.map((p) => (
                    <PageRow
                      key={p.id}
                      page={p}
                      active={p.id === selectedId}
                      onClick={() => setSelectedId(p.id)}
                    />
                  ))}
                </div>
              </ScrollArea>
            </div>
          </aside>

          {/* RIGHT — canvas markdown */}
          <main className="flex-1 flex flex-col min-h-0 bg-background">
            {selected ? (
              <>
                <div className="px-4 py-2 border-b border-border/40 shrink-0 flex items-center gap-2">
                  <StatusIcon status={selected.status} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-mono truncate text-foreground">{selected.url}</div>
                    <div className="text-[9px] text-muted-foreground flex items-center gap-2 mt-0.5">
                      <Badge variant="secondary" className="h-4 px-1.5 text-[9px] font-mono">
                        {selected.pipelineKey}
                      </Badge>
                      {selected.markdown && <span>{selected.markdown.length.toLocaleString()} char</span>}
                      {selected.durationMs && <span>· {(selected.durationMs / 1000).toFixed(1)}s</span>}
                      {selected.persisted && (
                        <span className="inline-flex items-center gap-0.5 text-primary font-medium">
                          · <Database className="w-2.5 h-2.5" /> Salvato
                        </span>
                      )}
                    </div>
                  </div>
                  {selected.markdown && (
                    <Button size="sm" variant="ghost" onClick={() => copyMd(selected.markdown)}
                      className="h-7 text-[10px]">
                      <Copy className="w-3 h-3 mr-1" /> Copia
                    </Button>
                  )}
                </div>

                {selected.status === "running" && (
                  <div className="flex-1 flex items-center justify-center text-muted-foreground">
                    <div className="flex items-center gap-2 text-xs">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      FireScrape sta leggendo questa pagina…
                    </div>
                  </div>
                )}

                {selected.status === "error" && (
                  <div className="flex-1 flex items-center justify-center p-8">
                    <div className="max-w-md rounded-md border border-destructive/40 bg-destructive/10 p-4 text-center">
                      <AlertCircle className="w-6 h-6 text-destructive mx-auto mb-2" />
                      <div className="text-xs font-semibold text-destructive">Errore di lettura</div>
                      <div className="text-[11px] text-muted-foreground mt-1">{selected.error}</div>
                    </div>
                  </div>
                )}

                {selected.status === "done" && selected.markdown && (
                  <Tabs defaultValue="formatted" className="flex-1 flex flex-col min-h-0">
                    <TabsList className="mx-4 mt-2 h-7 w-fit">
                      <TabsTrigger value="formatted" className="text-[10px] h-6 px-2">
                        <Eye className="w-3 h-3 mr-1" /> Formattato
                      </TabsTrigger>
                      <TabsTrigger value="raw" className="text-[10px] h-6 px-2">
                        <Code2 className="w-3 h-3 mr-1" /> Markdown grezzo
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="formatted" className="flex-1 min-h-0 mt-0">
                      <ScrollArea className="h-full">
                        <article className="prose prose-sm dark:prose-invert max-w-3xl mx-auto px-6 py-5
                          prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-foreground
                          prose-h1:text-base prose-h1:text-primary prose-h1:border-b prose-h1:border-primary/30 prose-h1:pb-1.5 prose-h1:mb-3
                          prose-h2:text-sm prose-h2:text-primary prose-h2:mt-5 prose-h2:mb-2
                          prose-h3:text-[13px] prose-h3:text-primary/90 prose-h3:mt-4 prose-h3:mb-1.5
                          prose-h4:text-[12px] prose-h4:text-foreground/90
                          prose-p:text-[12.5px] prose-p:leading-relaxed prose-p:my-2 prose-p:text-foreground/85
                          prose-li:text-[12.5px] prose-li:my-0.5 prose-li:text-foreground/85
                          prose-ul:my-2 prose-ol:my-2
                          prose-strong:text-primary prose-strong:font-semibold
                          prose-em:text-foreground/90 prose-em:not-italic prose-em:font-medium
                          prose-a:text-primary prose-a:font-medium prose-a:no-underline hover:prose-a:underline
                          prose-code:text-[11px] prose-code:bg-primary/10 prose-code:text-primary prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none
                          prose-pre:text-[11px] prose-pre:bg-muted prose-pre:border prose-pre:border-border
                          prose-blockquote:border-l-2 prose-blockquote:border-primary prose-blockquote:bg-primary/5 prose-blockquote:py-1 prose-blockquote:px-3 prose-blockquote:not-italic prose-blockquote:text-foreground/85
                          prose-hr:border-border/60">
                          <LazyMarkdown>{enhanceMarkdown(selected.markdown)}</LazyMarkdown>
                        </article>
                      </ScrollArea>
                    </TabsContent>
                    <TabsContent value="raw" className="flex-1 min-h-0 mt-0">
                      <ScrollArea className="h-full">
                        <pre className="text-[11px] font-mono whitespace-pre-wrap break-words px-6 py-4 text-foreground/90">
                          {selected.markdown}
                        </pre>
                      </ScrollArea>
                    </TabsContent>
                  </Tabs>
                )}
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center max-w-sm">
                  <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <div className="text-sm font-medium">Nessuna pagina selezionata</div>
                  <div className="text-[11px] mt-1">
                    Lancia una pipeline a sinistra: vedrai qui ciò che FireScrape sta leggendo, in tempo reale.
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

// ─────────────────────────────────────────────────────────────────────

function PageRow({ page, active, onClick }: { page: CapturedPage; active: boolean; onClick: () => void }) {
  let host = page.url;
  try { host = new URL(page.url).hostname.replace(/^www\./, ""); } catch { /* noop */ }
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-2 py-1.5 rounded text-[11px] flex items-start gap-1.5 transition-colors ${
        active ? "bg-primary/15 border border-primary/30" : "hover:bg-muted/60 border border-transparent"
      }`}
    >
      <StatusIcon status={page.status} small />
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{host}</div>
        <div className="text-[9px] text-muted-foreground font-mono truncate">{page.url}</div>
        {page.status === "done" && (
          <div className="text-[9px] text-muted-foreground mt-0.5">
            {page.markdown.length.toLocaleString()} char
            {page.durationMs && ` · ${(page.durationMs / 1000).toFixed(1)}s`}
          </div>
        )}
        {page.status === "error" && (
          <div className="text-[9px] text-destructive mt-0.5 truncate">{page.error}</div>
        )}
      </div>
    </button>
  );
}

function StatusIcon({ status, small }: { status: CapturedPage["status"]; small?: boolean }) {
  const cls = small ? "w-3 h-3 mt-0.5" : "w-3.5 h-3.5";
  if (status === "running") return <Loader2 className={`${cls} animate-spin text-primary shrink-0`} />;
  if (status === "done") return <CheckCircle2 className={`${cls} text-emerald-500 shrink-0`} />;
  if (status === "pending") return <div className={`${cls} rounded-full border border-muted-foreground/40 shrink-0`} />;
  return <AlertCircle className={`${cls} text-destructive shrink-0`} />;
}

function extractMarkdown(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const d = data as Record<string, unknown>;
  if (typeof d.markdown === "string") return d.markdown;
  if (typeof d.content === "string") return d.content;
  // result.data sometimes wrapped in {result: {...}}
  if (d.result && typeof d.result === "object") {
    const r = d.result as Record<string, unknown>;
    if (typeof r.markdown === "string") return r.markdown;
  }
  return "";
}
