/**
 * ResultPanel — right panel of Email Forge.
 * SEMPLIFICATO: subject + body (Preview/Codice) + OracleContextPanel.
 * Le metriche (model/quality/latency/tokens) sono nel footer di pagina, non più qui.
 */
import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, AlertCircle } from "lucide-react";
import OracleContextPanel from "@/components/email/OracleContextPanel";
import type { ForgeResult } from "@/v2/hooks/useEmailForge";

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
