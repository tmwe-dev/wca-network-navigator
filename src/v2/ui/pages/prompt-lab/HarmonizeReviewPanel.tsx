/**
 * HarmonizeReviewPanel — tabella di review delle proposte di armonizzazione.
 *
 * Mostra per ogni proposta:
 *  - badge azione (UPDATE/INSERT/MOVE/DELETE)
 *  - badge resolution_layer (text/contract/code_policy/kb_governance)
 *  - target tabella + id
 *  - reasoning + evidenza
 *  - before/after (per UPDATE)
 *  - checkbox approvazione (disabilitata per read-only)
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, AlertTriangle, Wrench, Code2, BookOpen, FileText } from "lucide-react";
import type { HarmonizeProposal } from "@/data/harmonizeRuns";

interface Props {
  proposals: HarmonizeProposal[];
  approvedIds: Set<string>;
  onToggle: (id: string) => void;
  onApproveAllSafe: () => void;
}

const ACTION_VARIANT: Record<HarmonizeProposal["action"], string> = {
  UPDATE: "bg-primary/10 text-primary border-primary/20",
  INSERT: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  MOVE: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  DELETE: "bg-destructive/10 text-destructive border-destructive/20",
};

const LAYER_META: Record<HarmonizeProposal["resolution_layer"], { label: string; icon: typeof FileText; cls: string }> = {
  text: { label: "Testo", icon: FileText, cls: "bg-muted text-muted-foreground" },
  contract: { label: "Contratto backend", icon: Wrench, cls: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  code_policy: { label: "Policy nel codice", icon: Code2, cls: "bg-destructive/10 text-destructive border-destructive/20" },
  kb_governance: { label: "Governance KB", icon: BookOpen, cls: "bg-primary/10 text-primary border-primary/20" },
};

export function HarmonizeReviewPanel({ proposals, approvedIds, onToggle, onApproveAllSafe }: Props) {
  if (proposals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
        <AlertTriangle className="h-8 w-8 mb-2" />
        <p>Nessuna proposta generata. Il sistema è già allineato alla libreria, oppure non c'erano gap azionabili.</p>
      </div>
    );
  }

  const actionable = proposals.filter((p) => p.resolution_layer === "text" || p.resolution_layer === "kb_governance");
  const readOnly = proposals.filter((p) => p.resolution_layer === "contract" || p.resolution_layer === "code_policy");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {proposals.length} proposte totali · {actionable.length} eseguibili · {readOnly.length} read-only (richiedono sviluppatore)
        </div>
        <Button size="sm" variant="outline" onClick={onApproveAllSafe}>
          Approva tutte le sicure
        </Button>
      </div>

      <ScrollArea className="h-[420px] pr-2">
        <div className="space-y-2">
          {proposals.map((p) => {
            const isReadOnly = p.resolution_layer === "contract" || p.resolution_layer === "code_policy";
            const layer = LAYER_META[p.resolution_layer];
            const LayerIcon = layer.icon;
            return (
              <Card key={p.id} className="p-3">
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={approvedIds.has(p.id)}
                    disabled={isReadOnly}
                    onCheckedChange={() => onToggle(p.id)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <Badge className={ACTION_VARIANT[p.action]} variant="outline">{p.action}</Badge>
                      <Badge className={layer.cls} variant="outline">
                        <LayerIcon className="h-3 w-3 mr-1" />
                        {layer.label}
                      </Badge>
                      <Badge variant="secondary">{p.target.table}</Badge>
                      {p.impact === "high" && <Badge variant="destructive">Impatto alto</Badge>}
                      <span className="text-xs text-muted-foreground truncate">{p.block_label}</span>
                    </div>
                    <p className="text-sm text-foreground/90 mb-1">{p.reasoning}</p>
                    <Collapsible>
                      <CollapsibleTrigger className="text-xs text-primary hover:underline flex items-center gap-1">
                        <ChevronDown className="h-3 w-3" />
                        Dettagli
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2 space-y-2">
                        {p.before != null && (
                          <div>
                            <div className="text-xs font-semibold text-muted-foreground">Prima:</div>
                            <pre className="text-xs bg-muted p-2 rounded whitespace-pre-wrap max-h-32 overflow-auto">{p.before}</pre>
                          </div>
                        )}
                        {p.after != null && (
                          <div>
                            <div className="text-xs font-semibold text-muted-foreground">Dopo:</div>
                            <pre className="text-xs bg-muted p-2 rounded whitespace-pre-wrap max-h-32 overflow-auto">{p.after}</pre>
                          </div>
                        )}
                        <div>
                          <div className="text-xs font-semibold text-muted-foreground">Evidenza ({p.evidence.source}):</div>
                          <p className="text-xs italic">"{p.evidence.excerpt}"</p>
                        </div>
                        {p.dependencies.length > 0 && (
                          <div className="text-xs">
                            <span className="font-semibold">Dipendenze:</span> {p.dependencies.length}
                          </div>
                        )}
                        {p.tests_required.length > 0 && (
                          <div className="text-xs">
                            <span className="font-semibold">Test:</span> {p.tests_required.join(", ")}
                          </div>
                        )}
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}