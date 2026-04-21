/**
 * ResultPanel — right panel of Email Forge.
 * SEMPLIFICATO: subject + body (Preview/Codice) + OracleContextPanel.
 * Le metriche (model/quality/latency/tokens) sono nel footer di pagina, non più qui.
 */
import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, AlertCircle, AlertTriangle, XCircle, CheckCircle2 } from "lucide-react";
import OracleContextPanel from "@/components/email/OracleContextPanel";
import type { ForgeResult } from "@/v2/hooks/useEmailForge";
import { cn } from "@/lib/utils";

interface Props {
  result: ForgeResult | null;
  isLoading: boolean;
  error: string | null;
  elapsedMs: number | null;
  hasRecipient: boolean;
}

export function ResultPanel({ result, isLoading, error, hasRecipient }: Props) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-foreground/80 gap-2">
        <Mail className="w-4 h-4 animate-pulse" />
        Generazione email…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="flex items-start gap-2 p-3 rounded-md border border-destructive/40 bg-destructive/5 text-destructive text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <div className="font-medium">Errore</div>
            <div className="text-xs mt-1">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center text-sm text-foreground/80 p-6">
        <Mail className="w-10 h-10 mb-3 opacity-40" />
        <p className="font-medium">Nessun risultato ancora</p>
        <p className="text-xs mt-1 max-w-xs">
          Configura il destinatario e clicca <strong>Genera Email</strong> a sinistra.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-auto p-3 space-y-3">
        {result.journalist_review && (
          <JournalistBadge review={result.journalist_review} />
        )}
        <div>
          <div className="text-xs uppercase tracking-wide text-foreground/80 mb-1">Subject</div>
          <div className="text-sm font-medium border border-border/60 rounded px-2 py-1.5 bg-card">
            {result.subject || "(vuoto)"}
          </div>
        </div>

        <div>
          <div className="text-xs uppercase tracking-wide text-foreground/80 mb-1">Body</div>
          <Tabs defaultValue="preview" className="w-full">
            <TabsList className="h-7">
              <TabsTrigger value="preview" className="text-xs h-6 px-2">Preview</TabsTrigger>
              <TabsTrigger value="html" className="text-xs h-6 px-2">Codice</TabsTrigger>
            </TabsList>
            <TabsContent value="preview" className="mt-2">
              <div
                className="prose prose-sm max-w-none border border-border/60 rounded p-3 bg-card text-foreground text-sm"
                /* eslint-disable-next-line react/no-danger */
                dangerouslySetInnerHTML={{ __html: result.body || "<em>(vuoto)</em>" }}
              />
            </TabsContent>
            <TabsContent value="html" className="mt-2">
              <pre className="whitespace-pre-wrap break-words text-[11px] leading-relaxed bg-muted/40 p-2 rounded font-mono text-foreground/90 max-h-96 overflow-auto">
                {result.body || "(vuoto)"}
              </pre>
            </TabsContent>
          </Tabs>
        </div>

        <div>
          <div className="text-xs uppercase tracking-wide text-foreground/80 mb-1">
            Cosa sa Oracolo
          </div>
          <OracleContextPanel
            summary={result._context_summary ?? null}
            hasRecipient={hasRecipient}
          />
        </div>
      </div>
    </div>
  );
}

function JournalistBadge({ review }: { review: NonNullable<ForgeResult["journalist_review"]> }) {
  const verdictLabel: Record<string, string> = {
    pass: "OK",
    pass_with_edits: "CORRETTO",
    warn: "ATTENZIONE",
    block: "BLOCCATO",
  };
  const verdictClass: Record<string, string> = {
    pass: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
    pass_with_edits: "bg-blue-500/10 text-blue-500 border-blue-500/30",
    warn: "bg-amber-500/10 text-amber-500 border-amber-500/30",
    block: "bg-destructive/10 text-destructive border-destructive/30",
  };
  const VerdictIcon = review.verdict === "block" ? XCircle : review.verdict === "warn" ? AlertTriangle : CheckCircle2;
  return (
    <div className="space-y-2">
      <div className={cn("flex items-center gap-2 px-2 py-1.5 rounded border text-xs", verdictClass[review.verdict])}>
        <VerdictIcon className="h-3.5 w-3.5 shrink-0" />
        <span className="font-bold uppercase tracking-wide text-[10px]">{verdictLabel[review.verdict]}</span>
        <span className="font-medium">{review.journalist.label}</span>
        {!review.journalist.auto && <span className="opacity-60 text-[10px]">(override)</span>}
        {review.quality_score >= 0 && (
          <span className="ml-auto font-mono text-[10px] opacity-70">{review.quality_score}/100</span>
        )}
      </div>
      {review.reasoning && (
        <p className="text-[11px] italic text-foreground/60 px-1">{review.reasoning}</p>
      )}
      {(review.verdict === "warn" || review.verdict === "block") && review.warnings.length > 0 && (
        <div className={cn(
          "p-2 rounded border text-[11px] space-y-1",
          review.verdict === "block" ? "border-destructive/30 bg-destructive/5" : "border-amber-500/30 bg-amber-500/5"
        )}>
          {review.warnings.map((w, i) => (
            <div key={i} className="text-foreground/80">
              <span className="font-mono opacity-50">[{w.type}]</span> {w.description}
              {w.upstream_fix && <div className="ml-2 mt-0.5 italic text-primary/70">→ {w.upstream_fix}</div>}
            </div>
          ))}
        </div>
      )}
      {review.edits.length > 0 && (
        <details className="text-[11px]">
          <summary className="cursor-pointer text-primary/70">{review.edits.length} correzioni editoriali</summary>
          <div className="mt-1 space-y-2 p-2 rounded border border-border/40 bg-card max-h-60 overflow-auto">
            {review.edits.map((e, i) => (
              <div key={i} className="space-y-0.5">
                <span className="font-mono opacity-40">[{e.type}]</span>
                <div className="line-through text-destructive/70">{e.original_fragment}</div>
                <div className="text-emerald-500">{e.edited_fragment}</div>
                <div className="italic text-foreground/50">{e.reason}</div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
