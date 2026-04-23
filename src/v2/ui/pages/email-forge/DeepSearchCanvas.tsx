/**
 * DeepSearchCanvas — orchestrator for FireScrape web UI
 * Delegates to focused sub-components for header, pipelines, page list, and content
 */
import * as React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import { fs } from "@/v2/io/extensions/bridge";
import {
  resolvePipelineUrls,
  type PipelineKey,
  ALL_PIPELINES,
} from "@/v2/io/extensions/deep-search-pipelines";
import { untypedFrom } from "@/lib/supabaseUntyped";
import type { ForgeRecipient } from "./ForgeRecipientPicker";
import { DeepSearchHeader } from "./components/DeepSearchHeader";
import { DeepSearchPipelines } from "./components/DeepSearchPipelines";
import { DeepSearchPageList } from "./components/DeepSearchPageList";
import { DeepSearchContent } from "./components/DeepSearchContent";

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

export function DeepSearchCanvas({ open, onOpenChange, recipient }: Props) {
  const [pages, setPages] = React.useState<CapturedPage[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [running, setRunning] = React.useState<PipelineKey | "manual" | null>(null);
  const [manualUrl, setManualUrl] = React.useState("");
  const abortRef = React.useRef<AbortController | null>(null);

  const selected = pages.find((p) => p.id === selectedId) ?? null;

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-none w-[95vw] h-[92vh] p-0 gap-0 flex flex-col overflow-hidden"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DeepSearchHeader
          recipient={recipient}
          running={!!running}
          pagesCount={pages.length}
          onStop={stop}
          onClearAll={clearAll}
          onClose={() => onOpenChange(false)}
        />

        <div className="flex-1 flex min-h-0">
          <aside className="w-[340px] border-r border-border bg-muted/20 flex flex-col min-h-0">
            <DeepSearchPipelines
              vars={vars}
              running={running}
              manualUrl={manualUrl}
              onManualUrlChange={setManualUrl}
              onPipelineRun={runPipeline}
              onManualRun={runManual}
            />
            <DeepSearchPageList
              pages={pages}
              selectedId={selectedId}
              running={!!running}
              onSelectPage={setSelectedId}
            />
          </aside>

          <main className="flex-1 flex flex-col min-h-0 bg-background">
            <DeepSearchContent selected={selected} />
          </main>
        </div>
      </DialogContent>
    </Dialog>
  );
}


function extractMarkdown(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const d = data as Record<string, unknown>;
  if (typeof d.markdown === "string") return d.markdown;
  if (typeof d.content === "string") return d.content;
  if (d.result && typeof d.result === "object") {
    const r = d.result as Record<string, unknown>;
    if (typeof r.markdown === "string") return r.markdown;
  }
  return "";
}
