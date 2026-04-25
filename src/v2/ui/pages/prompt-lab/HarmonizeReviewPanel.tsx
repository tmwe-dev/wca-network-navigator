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
import { ChevronDown, AlertTriangle, Wrench, Code2, BookOpen, FileText, Lock, FlaskConical, Pencil, Check, X, Send, Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { toast } from "sonner";
import type { HarmonizeProposal } from "@/data/harmonizeRuns";

function EditableAfter({
  value,
  editable,
  onSave,
}: {
  value: string;
  editable: boolean;
  onSave: (next: string) => Promise<{ ok: boolean; reason?: string }>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  if (!editing) {
    return (
      <div>
        <div className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
          <span>Dopo:</span>
          {editable && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs"
              onClick={() => {
                setDraft(value);
                setEditing(true);
              }}
            >
              <Pencil className="h-3 w-3 mr-1" />
              Modifica
            </Button>
          )}
        </div>
        <pre className="text-xs bg-muted p-2 rounded whitespace-pre-wrap max-h-48 overflow-auto">{value}</pre>
      </div>
    );
  }

  return (
    <div>
      <div className="text-xs font-semibold text-muted-foreground mb-1">Dopo (in modifica):</div>
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="text-xs font-mono min-h-[120px]"
      />
      <div className="flex justify-end gap-2 mt-1">
        <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditing(false)}>
          <X className="h-3 w-3 mr-1" />
          Annulla
        </Button>
        <Button
          size="sm"
          className="h-7"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            try {
              const res = await onSave(draft);
              if (res.ok) {
                toast.success("Modifica salvata nel DB");
                setEditing(false);
              } else {
                toast.error(`Salvataggio fallito: ${res.reason ?? "errore sconosciuto"}`);
              }
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
          Salva modifica
        </Button>
      </div>
    </div>
  );
}

interface Props {
  proposals: HarmonizeProposal[];
  approvedIds: Set<string>;
  onToggle: (id: string) => void;
  onApproveAllSafe: () => void;
  onEditAfter?: (proposalId: string, newAfter: string) => Promise<{ ok: boolean; reason?: string }>;
  onApplySingle?: (proposalId: string) => Promise<{ ok: boolean; reason?: string }>;
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

const SEVERITY_CLS: Record<NonNullable<HarmonizeProposal["severity"]>, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  high: "bg-orange-500/10 text-orange-700 border-orange-500/20",
  critical: "bg-destructive/15 text-destructive border-destructive/30",
};

const TEST_URGENCY_LABEL: Record<NonNullable<HarmonizeProposal["test_urgency"]>, string> = {
  none: "Nessun test",
  manual_smoke: "Smoke manuale",
  regression_full: "Regression completa",
};

export function HarmonizeReviewPanel({ proposals, approvedIds, onToggle, onApproveAllSafe, onEditAfter, onApplySingle }: Props) {
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const handleApplySingle = async (id: string) => {
    if (!onApplySingle) return;
    setApplyingId(id);
    try {
      const res = await onApplySingle(id);
      if (res.ok) toast.success("Proposta applicata al DB");
      else toast.error(`Applicazione fallita: ${res.reason ?? "errore sconosciuto"}`);
    } finally {
      setApplyingId(null);
    }
  };

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
            // Dipendenze cablate: bloccato finché tutte le sue deps non sono approvate.
            const missingDeps = (p.dependencies ?? []).filter((d) => !approvedIds.has(d));
            const blockedByDeps = missingDeps.length > 0;
            const disabled = isReadOnly || blockedByDeps;
            return (
              <Card key={p.id} className="p-3">
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={approvedIds.has(p.id)}
                    disabled={disabled}
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
                      {p.severity && (
                        <Badge className={SEVERITY_CLS[p.severity]} variant="outline">
                          Severità: {p.severity}
                        </Badge>
                      )}
                      {typeof p.impact_score === "number" && (
                        <Badge variant="outline" title="Impact score (1-10)">
                          Impatto {p.impact_score}/10
                        </Badge>
                      )}
                      {p.test_urgency && p.test_urgency !== "none" && (
                        <Badge variant="outline" className="gap-1">
                          <FlaskConical className="h-3 w-3" />
                          {TEST_URGENCY_LABEL[p.test_urgency]}
                        </Badge>
                      )}
                      {blockedByDeps && (
                        <Badge variant="outline" className="gap-1 bg-muted">
                          <Lock className="h-3 w-3" />
                          Bloccato: {missingDeps.length} dipendenz{missingDeps.length === 1 ? "a" : "e"}
                        </Badge>
                      )}
                       <span className="text-xs text-muted-foreground truncate">{p.block_label}</span>
                       {onApplySingle && !isReadOnly && (
                         <Button
                           size="sm"
                           variant="outline"
                           className="h-6 px-2 text-xs ml-auto"
                           disabled={applyingId === p.id || blockedByDeps}
                           onClick={() => handleApplySingle(p.id)}
                           title="Applica questa proposta al DB e rimuovila dalla lista"
                         >
                           {applyingId === p.id ? (
                             <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                           ) : (
                             <Send className="h-3 w-3 mr-1" />
                           )}
                           Applica
                         </Button>
                       )}
                     </div>
                    {p.after != null && (
                      <div className="mb-2">
                        <EditableAfter
                          value={p.after}
                          editable={!!onEditAfter && !isReadOnly}
                          onSave={(v) => onEditAfter ? onEditAfter(p.id, v) : Promise.resolve({ ok: false, reason: "modifica non disponibile" })}
                        />
                      </div>
                    )}
                    <Collapsible>
                      <CollapsibleTrigger className="text-xs text-primary hover:underline flex items-center gap-1">
                        <ChevronDown className="h-3 w-3" />
                        Spiegazione e dettagli
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2 space-y-2">
                        <div>
                          <div className="text-xs font-semibold text-muted-foreground">Perché:</div>
                          <p className="text-sm text-foreground/90">{p.reasoning}</p>
                        </div>
                        {(p.current_location || p.proposed_location) && (
                          <div className="text-xs grid grid-cols-2 gap-2">
                            {p.current_location && (
                              <div>
                                <span className="font-semibold text-muted-foreground">Posizione attuale:</span>
                                <div className="font-mono text-[10px]">{p.current_location}</div>
                              </div>
                            )}
                            {p.proposed_location && (
                              <div>
                                <span className="font-semibold text-muted-foreground">Posizione proposta:</span>
                                <div className="font-mono text-[10px]">{p.proposed_location}</div>
                              </div>
                            )}
                          </div>
                        )}
                        {p.before != null && (
                          <div>
                            <div className="text-xs font-semibold text-muted-foreground">Prima:</div>
                            <pre className="text-xs bg-muted p-2 rounded whitespace-pre-wrap max-h-32 overflow-auto">{p.before}</pre>
                          </div>
                        )}
                        <div>
                          <div className="text-xs font-semibold text-muted-foreground">Evidenza ({p.evidence.source}):</div>
                          <p className="text-xs italic">"{p.evidence.excerpt}"</p>
                        </div>
                        {p.dependencies.length > 0 && (
                          <div className="text-xs">
                            <span className="font-semibold">Dipendenze:</span> {p.dependencies.length}
                            {blockedByDeps && (
                              <span className="text-amber-600 ml-1">
                                ({missingDeps.length} non ancora approvat{missingDeps.length === 1 ? "a" : "e"})
                              </span>
                            )}
                          </div>
                        )}
                        {p.missing_contracts && p.missing_contracts.length > 0 && (
                          <div className="text-xs">
                            <div className="font-semibold text-muted-foreground">Contratti mancanti:</div>
                            <ul className="list-disc list-inside">
                              {p.missing_contracts.map((c, i) => (
                                <li key={i} className="font-mono text-[10px]">
                                  {c.contract_name}{c.field ? `.${c.field}` : ""} — {c.why_needed}
                                </li>
                              ))}
                            </ul>
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