/**
 * ResultPanel — right panel of Email Forge.
 * Shows subject, body (HTML preview + plain), metrics footer, and reuses OracleContextPanel.
 */
import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Clock, Cpu, Coins, AlertCircle } from "lucide-react";
import OracleContextPanel from "@/components/email/OracleContextPanel";
import type { ForgeResult } from "@/v2/hooks/useEmailForge";

interface Props {
  result: ForgeResult | null;
  isLoading: boolean;
  error: string | null;
  elapsedMs: number | null;
  hasRecipient: boolean;
}

export function ResultPanel({ result, isLoading, error, elapsedMs, hasRecipient }: Props) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground gap-2">
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
      <div className="flex flex-col items-center justify-center h-full text-center text-sm text-muted-foreground p-6">
        <Mail className="w-10 h-10 mb-3 opacity-40" />
        <p className="font-medium">Nessun risultato ancora</p>
        <p className="text-xs mt-1 max-w-xs">
          L'email generata e le metriche compariranno qui.
        </p>
      </div>
    );
  }

  const dbg = result._debug;
  const tokensIn = dbg?.tokens_in ?? null;
  const tokensOut = dbg?.tokens_out ?? null;
  const totalTokens = (tokensIn ?? 0) + (tokensOut ?? 0);
  const credits = totalTokens > 0 ? Math.max(1, Math.ceil(((tokensIn ?? 0) + (tokensOut ?? 0) * 2) / 1000)) : null;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40 shrink-0 text-xs font-medium">
        <Mail className="w-3.5 h-3.5" />
        Risultato
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-3">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Subject</div>
          <div className="text-sm font-medium border border-border/40 rounded px-2 py-1.5 bg-card">
            {result.subject || "(vuoto)"}
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Body</div>
          <Tabs defaultValue="preview" className="w-full">
            <TabsList className="h-7">
              <TabsTrigger value="preview" className="text-xs h-6 px-2">Preview</TabsTrigger>
              <TabsTrigger value="html" className="text-xs h-6 px-2">HTML</TabsTrigger>
              <TabsTrigger value="raw" className="text-xs h-6 px-2">Raw</TabsTrigger>
            </TabsList>
            <TabsContent value="preview" className="mt-2">
              <div
                className="prose prose-sm max-w-none border border-border/40 rounded p-3 bg-card text-foreground text-sm"
                /* eslint-disable-next-line react/no-danger */
                dangerouslySetInnerHTML={{ __html: result.body || "<em>(vuoto)</em>" }}
              />
            </TabsContent>
            <TabsContent value="html" className="mt-2">
              <pre className="whitespace-pre-wrap break-words text-[11px] leading-relaxed bg-muted/40 p-2 rounded font-mono text-foreground/90 max-h-96 overflow-auto">
                {result.body || "(vuoto)"}
              </pre>
            </TabsContent>
            <TabsContent value="raw" className="mt-2">
              <pre className="whitespace-pre-wrap break-words text-[11px] leading-relaxed bg-muted/40 p-2 rounded font-mono text-foreground/90 max-h-96 overflow-auto">
                {result.full_content || "(vuoto)"}
              </pre>
            </TabsContent>
          </Tabs>
        </div>

        <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground border-t border-border/30 pt-2">
          <span className="flex items-center gap-1">
            <Cpu className="w-3 h-3" /> {result.model}
          </span>
          <span>·</span>
          <span>quality: {result.quality}</span>
          {dbg?.ai_latency_ms != null && (
            <>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" /> AI {dbg.ai_latency_ms}ms
              </span>
            </>
          )}
          {elapsedMs != null && (
            <>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" /> Totale {elapsedMs}ms
              </span>
            </>
          )}
          {tokensIn != null && (
            <>
              <span>·</span>
              <span>{tokensIn} in</span>
            </>
          )}
          {tokensOut != null && (
            <>
              <span>·</span>
              <span>{tokensOut} out</span>
            </>
          )}
          {credits != null && (
            <>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Coins className="w-3 h-3" /> {credits} crediti
              </span>
            </>
          )}
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
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
