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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronDown, AlertTriangle, Wrench, Code2, BookOpen, FileText, Lock, FlaskConical, Pencil, Check, X, Send, Loader2, ShieldCheck, Eye, FileQuestion, CheckCircle2, EyeOff, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
  onDiscardSingle?: (proposalId: string) => Promise<{ ok: boolean; reason?: string }>;
  onApplySelected?: () => void;
  applyingSelected?: boolean;
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

export function HarmonizeReviewPanel({ proposals, approvedIds, onToggle, onApproveAllSafe, onEditAfter, onApplySingle, onDiscardSingle, onApplySelected, applyingSelected }: Props) {
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [discardingId, setDiscardingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "safe" | "review" | "notes" | "done">("all");
  const [hideManaged, setHideManaged] = useState(true);

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

  const handleDiscardSingle = async (id: string) => {
    if (!onDiscardSingle) return;
    setDiscardingId(id);
    try {
      const res = await onDiscardSingle(id);
      if (res.ok) toast.success("Proposta scartata");
      else toast.error(`Eliminazione fallita: ${res.reason ?? "errore sconosciuto"}`);
    } finally {
      setDiscardingId(null);
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

  const readOnly = proposals.filter((p) => p.resolution_layer === "contract" || p.resolution_layer === "code_policy");

  // Una proposta è "nota documentale" se l'AI l'ha marcata come tale.
  const isDocNote = (p: HarmonizeProposal) => p.is_document_note === true;
  // "Gestita" = già applicata al DB (executed) o fallita.
  const isManaged = (p: HarmonizeProposal) => p.status === "executed" || p.status === "failed";

  // Una proposta è "sicura" se è solo testo, non DELETE, non INSERT su agents, e impatto non alto.
  const isSafe = (p: HarmonizeProposal) =>
    !isDocNote(p) &&
    p.resolution_layer === "text" &&
    p.action !== "DELETE" &&
    p.impact !== "high" &&
    !(p.action === "INSERT" && p.target.table === "agents");

  // Conteggi per i tab — sempre escludendo le note doc dai gruppi sicure/da rivedere
  // (le note doc hanno il loro tab dedicato).
  const notesAll = proposals.filter(isDocNote);
  const managedAll = proposals.filter(isManaged);
  const safeAll = proposals.filter((p) => !isDocNote(p) && isSafe(p));
  const reviewAll = proposals.filter((p) => !isDocNote(p) && !isSafe(p));

  // Helper: conta solo le rimanenti (non gestite) per il badge "X di Y"
  const remaining = (arr: HarmonizeProposal[]) => arr.filter((p) => !isManaged(p)).length;

  // Lista visibile nel tab attivo
  let baseList: HarmonizeProposal[];
  switch (filter) {
    case "safe":   baseList = safeAll;    break;
    case "review": baseList = reviewAll;  break;
    case "notes":  baseList = notesAll;   break;
    case "done":   baseList = managedAll; break;
    default:       baseList = proposals;  break;
  }
  // Filtro "nascondi gestite": attivo ovunque tranne nel tab "Gestite".
  const visible = (hideManaged && filter !== "done")
    ? baseList.filter((p) => !isManaged(p))
    : baseList;

  // Selezione "tutte le visibili" — toggle massivo che rispetta dipendenze e read-only.
  const visibleSelectableIds = visible
    .filter((p) => p.resolution_layer !== "contract" && p.resolution_layer !== "code_policy")
    .map((p) => p.id);
  const allVisibleSelected =
    visibleSelectableIds.length > 0 && visibleSelectableIds.every((id) => approvedIds.has(id));
  const someVisibleSelected = visibleSelectableIds.some((id) => approvedIds.has(id));

  const toggleAllVisible = () => {
    if (allVisibleSelected) {
      // deseleziona solo le visibili
      for (const id of visibleSelectableIds) if (approvedIds.has(id)) onToggle(id);
    } else {
      // seleziona tutte le visibili (rispettando dipendenze: passa più volte se servono cascate)
      const tryAdd = (remaining: string[], guard: number): void => {
        if (remaining.length === 0 || guard <= 0) return;
        const stillMissing: string[] = [];
        for (const id of remaining) {
          if (approvedIds.has(id)) continue;
          const p = proposals.find((x) => x.id === id);
          const deps = p?.dependencies ?? [];
          const depsOk = deps.every((d) => approvedIds.has(d));
          if (depsOk) onToggle(id);
          else stillMissing.push(id);
        }
        if (stillMissing.length > 0 && stillMissing.length < remaining.length) {
          tryAdd(stillMissing, guard - 1);
        }
      };
      tryAdd(visibleSelectableIds.filter((id) => !approvedIds.has(id)), 5);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Tabs orizzontali: 5 categorie con contatori "rimanenti / totali" */}
      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
        <TabsList className="w-full grid grid-cols-5 h-auto">
          <TabsTrigger value="all" className="gap-1.5 py-2 flex-col sm:flex-row">
            <span>Tutte</span>
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]" title={`${remaining(proposals)} da gestire su ${proposals.length} totali`}>
              {remaining(proposals)}/{proposals.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="safe" className="gap-1.5 py-2 flex-col sm:flex-row data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-700">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Sicure</span>
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-emerald-500/15 text-emerald-700 border-emerald-500/30" title={`${remaining(safeAll)} da gestire su ${safeAll.length} sicure`}>
              {remaining(safeAll)}/{safeAll.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="review" className="gap-1.5 py-2 flex-col sm:flex-row data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-700">
            <Eye className="h-3.5 w-3.5" />
            <span>Da rivedere</span>
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-amber-500/15 text-amber-700 border-amber-500/30" title={`${remaining(reviewAll)} da gestire su ${reviewAll.length} da rivedere`}>
              {remaining(reviewAll)}/{reviewAll.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="notes" className="gap-1.5 py-2 flex-col sm:flex-row data-[state=active]:bg-muted data-[state=active]:text-foreground" title="Riferimenti, indici, commenti dell'autore: non sono contenuto KB">
            <FileQuestion className="h-3.5 w-3.5" />
            <span>Note doc</span>
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
              {remaining(notesAll)}/{notesAll.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="done" className="gap-1.5 py-2 flex-col sm:flex-row data-[state=active]:bg-primary/10 data-[state=active]:text-primary" title="Già applicate al database o fallite">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Gestite</span>
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-primary/10 text-primary border-primary/30">
              {managedAll.length}
            </Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Sub-toolbar: selettore master + azioni di massa sul tab attivo */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background/60 px-3 py-2">
        <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
          <Checkbox
            checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
            onCheckedChange={toggleAllVisible}
            aria-label="Seleziona tutte le visibili"
          />
          <span className="font-medium">
            {allVisibleSelected ? "Deseleziona tutte in questa scheda" : "Seleziona tutte in questa scheda"}
            <span className="text-muted-foreground ml-1">({visibleSelectableIds.length})</span>
          </span>
        </label>
        <div className="flex items-center gap-2 flex-wrap">
          {onApplySelected && approvedIds.size > 0 && (
            <Button
              size="sm"
              className="h-7 gap-1.5 px-3"
              onClick={onApplySelected}
              disabled={applyingSelected}
              title="Applica al database tutte le proposte attualmente selezionate"
            >
              {applyingSelected ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              Applica selezionate ({approvedIds.size})
            </Button>
          )}
          {filter !== "done" && (
            <div className="flex items-center gap-1.5" title="Nasconde le proposte già applicate, scartate o fallite">
              <Switch id="hide-managed" checked={hideManaged} onCheckedChange={setHideManaged} className="scale-75" />
              <Label htmlFor="hide-managed" className="cursor-pointer text-xs flex items-center gap-1">
                {hideManaged ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                Nascondi gestite
              </Label>
            </div>
          )}
          {readOnly.length > 0 && <span className="text-xs text-muted-foreground">{readOnly.length} read-only nel totale</span>}
        </div>
      </div>

      <ScrollArea className="h-[420px] pr-2">
        <div className="space-y-2">
          {visible.length === 0 && (
            <div className="text-center text-xs text-muted-foreground py-8">
              Nessuna proposta in questa categoria.
            </div>
          )}
          {visible.map((p) => {
            const isReadOnly = p.resolution_layer === "contract" || p.resolution_layer === "code_policy";
            const layer = LAYER_META[p.resolution_layer];
            const LayerIcon = layer.icon;
            const safe = isSafe(p);
            // Dipendenze cablate: bloccato finché tutte le sue deps non sono approvate.
            const missingDeps = (p.dependencies ?? []).filter((d) => !approvedIds.has(d));
            const blockedByDeps = missingDeps.length > 0;
            const disabled = isReadOnly || blockedByDeps;
            return (
              <Card key={p.id} className={`p-3 ${safe ? "border-l-4 border-l-emerald-500/70" : "border-l-4 border-l-amber-500/70"}`}>
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={approvedIds.has(p.id)}
                    disabled={disabled}
                    onCheckedChange={() => onToggle(p.id)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      {safe ? (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30 gap-1" title="Modifica di solo testo, basso impatto, reversibile">
                          <ShieldCheck className="h-3 w-3" />
                          Sicura
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30 gap-1" title="Da rivedere a mano: inserimento, eliminazione o impatto alto">
                          <Eye className="h-3 w-3" />
                          Da rivedere
                        </Badge>
                      )}
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