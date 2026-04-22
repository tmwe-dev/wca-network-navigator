import * as React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertCircle,
  Loader2,
  FileText,
  Copy,
  Eye,
  Code2,
  Database,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LazyMarkdown } from "@/components/ui/lazy-markdown";
import { toast } from "sonner";

interface CapturedPage {
  id: string;
  pipelineKey: string | "manual";
  url: string;
  status: "pending" | "running" | "done" | "error";
  markdown: string;
  error?: string;
  startedAt: number;
  durationMs?: number;
  persisted?: boolean;
}

interface DeepSearchContentProps {
  selected: CapturedPage | null;
}

function enhanceMarkdown(md: string): string {
  if (!md) return md;
  let out = md;

  out = out.replace(
    /(?<![*[\]`(\w@.])([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})(?![*\w@.])/g,
    "**$1**"
  );
  out = out.replace(
    /(?<![*\d])(\+\d{1,3}[\s.-]?\d{2,4}[\s.-]?\d{3,4}[\s.-]?\d{3,4})(?!\d)/g,
    "**$1**"
  );
  out = out.replace(/\b(P\.?\s?IVA[:\s]+\d{8,13})/gi, "**$1**");
  out = out.replace(/\n{3,}/g, "\n\n");
  return out;
}

export function DeepSearchContent({ selected }: DeepSearchContentProps) {
  const copyMd = async (md: string) => {
    try {
      await navigator.clipboard.writeText(md);
      toast.success("Markdown copiato");
    } catch {
      toast.error("Copia fallita");
    }
  };

  if (!selected) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center max-w-sm">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <div className="text-sm font-medium">Nessuna pagina selezionata</div>
          <div className="text-[11px] mt-1">
            Lancia una pipeline a sinistra: vedrai qui ciò che FireScrape sta
            leggendo, in tempo reale.
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="px-4 py-2 border-b border-border/60 shrink-0 flex items-center gap-2">
        <StatusIcon status={selected.status} />
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-mono truncate text-foreground">
            {selected.url}
          </div>
          <div className="text-[11px] text-foreground/70 flex items-center gap-2 mt-0.5">
            <Badge variant="secondary" className="h-4 px-1.5 text-[9px] font-mono">
              {selected.pipelineKey}
            </Badge>
            {selected.markdown && (
              <span>{selected.markdown.length.toLocaleString()} char</span>
            )}
            {selected.durationMs && (
              <span>· {(selected.durationMs / 1000).toFixed(1)}s</span>
            )}
            {selected.persisted && (
              <span className="inline-flex items-center gap-0.5 text-primary font-medium">
                · <Database className="w-2.5 h-2.5" /> Salvato
              </span>
            )}
          </div>
        </div>
        {selected.markdown && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => copyMd(selected.markdown)}
            className="h-7 text-[10px]"
          >
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
            <div className="text-xs font-semibold text-destructive">
              Errore di lettura
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              {selected.error}
            </div>
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
  );
}

function StatusIcon({ status }: { status: CapturedPage["status"] }) {
  const cls = "w-3.5 h-3.5";
  if (status === "running")
    return (
      <Loader2 className={`${cls} animate-spin text-primary shrink-0`} />
    );
  if (status === "done")
    return <div className={`${cls} rounded-full bg-emerald-500 shrink-0`} />;
  if (status === "pending")
    return (
      <div
        className={`${cls} rounded-full border border-muted-foreground/40 shrink-0`}
      />
    );
  return <AlertCircle className={`${cls} text-destructive shrink-0`} />;
}
