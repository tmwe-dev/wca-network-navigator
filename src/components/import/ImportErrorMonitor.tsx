import { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertCircle, Wand2, Loader2, ChevronDown, ChevronRight,
  CheckCircle2, XCircle, RotateCcw, Settings2, Play, Pause,
} from "lucide-react";
import { type ImportError } from "@/hooks/useImportLogs";

interface ImportErrorMonitorProps {
  errors: ImportError[];
  pendingErrors: ImportError[];
  correctedErrors: ImportError[];
  dismissedErrors: ImportError[];
  activeLogId: string | null;
  fixErrors: any; // UseMutationResult
}

export function ImportErrorMonitor({
  errors,
  pendingErrors,
  correctedErrors,
  dismissedErrors,
  activeLogId,
  fixErrors,
}: ImportErrorMonitorProps) {
  const [customPrompt, setCustomPrompt] = useState("");
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ processed: 0, total: 0, corrected: 0, dismissed: 0 });
  const [expandedErrorId, setExpandedErrorId] = useState<string | null>(null);

  const totalErrors = errors.length;
  const progressPercent = totalErrors > 0
    ? ((correctedErrors.length + dismissedErrors.length) / totalErrors) * 100
    : 0;

  // Group errors by type
  const errorsByType = useMemo(() => {
    const groups: Record<string, ImportError[]> = {};
    pendingErrors.forEach((e) => {
      const key = e.error_type || "unknown";
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    });
    return groups;
  }, [pendingErrors]);

  // Single batch fix
  const handleSingleBatch = useCallback(async () => {
    if (!activeLogId) return;
    const prompt = customPrompt.trim() || undefined;
    await fixErrors.mutateAsync({ importLogId: activeLogId, customPrompt: prompt });
  }, [activeLogId, fixErrors, customPrompt]);

  // Full batch processing - loops until all done
  const handleFullBatchFix = useCallback(async () => {
    if (!activeLogId) return;
    setBatchProcessing(true);
    const total = pendingErrors.length;
    setBatchProgress({ processed: 0, total, corrected: 0, dismissed: 0 });

    let corrected = 0;
    let dismissed = 0;
    let hasMore = true;

    while (hasMore) {
      try {
        const prompt = customPrompt.trim() || undefined;
        const result = await fixErrors.mutateAsync({ importLogId: activeLogId, customPrompt: prompt });
        corrected += result.corrected;
        dismissed += result.dismissed;
        hasMore = result.has_more;
        setBatchProgress({
          processed: corrected + dismissed,
          total,
          corrected,
          dismissed,
        });

        // Small delay between batches
        if (hasMore) await new Promise((r) => setTimeout(r, 1000));
      } catch {
        hasMore = false;
      }
    }

    setBatchProcessing(false);
  }, [activeLogId, fixErrors, customPrompt, pendingErrors.length]);

  const stopBatchProcessing = useCallback(() => {
    setBatchProcessing(false);
  }, []);

  return (
    <div className="space-y-4">
      {/* Stats header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-destructive" />
              Monitor Errori di Importazione
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{pendingErrors.length} da correggere</Badge>
              <Badge variant="default">{correctedErrors.length} corretti</Badge>
              <Badge variant="destructive">{dismissedErrors.length} non recuperabili</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Progresso correzione</span>
              <span>{correctedErrors.length + dismissedErrors.length}/{totalErrors}</span>
            </div>
            <Progress value={progressPercent} className="h-2.5" />
          </div>

          {/* Batch progress (when running) */}
          {batchProcessing && (
            <div className="bg-muted/40 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  Elaborazione batch in corso…
                </span>
                <Button size="sm" variant="outline" onClick={stopBatchProcessing}>
                  <Pause className="w-3 h-3 mr-1" /> Stop
                </Button>
              </div>
              <Progress
                value={batchProgress.total > 0 ? (batchProgress.processed / batchProgress.total) * 100 : 0}
                className="h-2"
              />
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>Corretti: <strong className="text-foreground">{batchProgress.corrected}</strong></span>
                <span>Non recuperabili: <strong className="text-foreground">{batchProgress.dismissed}</strong></span>
                <span>Rimanenti: <strong className="text-foreground">{batchProgress.total - batchProgress.processed}</strong></span>
              </div>
            </div>
          )}

          {/* Error type breakdown */}
          {Object.keys(errorsByType).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(errorsByType).map(([type, errs]) => (
                <Badge key={type} variant="secondary" className="text-xs">
                  {type}: {errs.length}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Custom prompt editor */}
      <Card>
        <CardHeader className="pb-2">
          <Collapsible open={showPromptEditor} onOpenChange={setShowPromptEditor}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Settings2 className="w-4 h-4" />
                  Prompt AI personalizzato
                </span>
                {showPromptEditor ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <Textarea
                placeholder={`Es: "Questi dati provengono da una directory di spedizionieri in Asia. I numeri di telefono sono in formato locale cinese (+86). Se manca il paese, usa 'China'. Prova a derivare l'email dal dominio aziendale quando possibile."`}
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                className="min-h-[100px] text-xs font-mono"
              />
              <p className="text-[10px] text-muted-foreground mt-1.5">
                Lascia vuoto per usare il prompt predefinito. Il prompt personalizzato sostituisce le istruzioni base di correzione.
              </p>
            </CollapsibleContent>
          </Collapsible>
        </CardHeader>
      </Card>

      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap">
        {pendingErrors.length > 0 && !batchProcessing && (
          <>
            <Button
              size="sm"
              onClick={handleSingleBatch}
              disabled={fixErrors.isPending}
            >
              {fixErrors.isPending ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <Wand2 className="w-3.5 h-3.5 mr-1.5" />
              )}
              Correggi batch ({Math.min(pendingErrors.length, 15)})
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleFullBatchFix}
            >
              <Play className="w-3.5 h-3.5 mr-1.5" />
              Correggi tutti ({pendingErrors.length})
            </Button>
          </>
        )}
      </div>

      {/* Error list with expandable details */}
      <Card>
        <CardContent className="pt-4">
          <ScrollArea className="h-[calc(100vh-580px)]">
            <div className="space-y-2">
              {errors.map((err) => (
                <Collapsible
                  key={err.id}
                  open={expandedErrorId === err.id}
                  onOpenChange={(open) => setExpandedErrorId(open ? err.id : null)}
                >
                  <Alert variant={err.status === "corrected" ? "default" : "destructive"} className="p-3">
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center gap-2 cursor-pointer">
                        <ErrorStatusIcon status={err.status} />
                        <AlertTitle className="text-xs flex-1 flex items-center gap-2 mb-0">
                          <span className="font-mono">R{err.row_number}</span>
                          <Badge variant="outline" className="text-[9px]">{err.error_type}</Badge>
                          <span className="text-muted-foreground truncate">{err.error_message}</span>
                        </AlertTitle>
                        {err.attempted_corrections > 0 && (
                          <Badge variant="secondary" className="text-[9px]">
                            <RotateCcw className="w-2.5 h-2.5 mr-0.5" />{err.attempted_corrections}
                          </Badge>
                        )}
                        {expandedErrorId === err.id ? (
                          <ChevronDown className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                        )}
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <AlertDescription className="text-xs mt-2 space-y-2">
                        {/* Raw data */}
                        {err.raw_data && (
                          <div>
                            <p className="text-[10px] font-medium text-muted-foreground mb-1">Dati originali:</p>
                            <pre className="text-[10px] bg-background/60 p-2 rounded overflow-x-auto max-h-[120px]">
                              {JSON.stringify(err.raw_data, null, 2)}
                            </pre>
                          </div>
                        )}
                        {/* Corrected data */}
                        {err.corrected_data && (
                          <div>
                            <p className="text-[10px] font-medium text-muted-foreground mb-1">Dati corretti:</p>
                            <pre className="text-[10px] bg-primary/5 p-2 rounded overflow-x-auto max-h-[120px] border border-primary/20">
                              {JSON.stringify(err.corrected_data, null, 2)}
                            </pre>
                          </div>
                        )}
                        {/* AI suggestions */}
                        {err.ai_suggestions && (
                          <div>
                            <p className="text-[10px] font-medium text-muted-foreground mb-1">Prompt usato:</p>
                            <pre className="text-[10px] bg-muted/50 p-2 rounded overflow-x-auto max-h-[60px]">
                              {JSON.stringify(err.ai_suggestions, null, 2)}
                            </pre>
                          </div>
                        )}
                      </AlertDescription>
                    </CollapsibleContent>
                  </Alert>
                </Collapsible>
              ))}
              {errors.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">Nessun errore</p>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function ErrorStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "corrected": return <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />;
    case "dismissed": return <XCircle className="w-3.5 h-3.5 text-destructive shrink-0" />;
    default: return <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0" />;
  }
}
