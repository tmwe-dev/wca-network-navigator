/**
 * SingleProposalReview — vista a singola proposta con chat di Gordon a destra.
 *
 * Layout:
 *  - Sinistra: dettaglio proposta (badge azione/target, before/after editabile, spiegazione collapsible, bottoni)
 *  - Destra: GordonChatPanel
 *  - Stack su viewport <md
 */
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Pencil, Check, X, Loader2, Send, AlertTriangle, ShieldCheck, Eye, FileQuestion, CheckCircle2, Database, BookOpen, Wrench, Mail, Settings, Users } from "lucide-react";
import { toast } from "sonner";
import type { HarmonizeProposal } from "@/data/harmonizeRuns";
import { ProposalNavigator } from "./ProposalNavigator";
import { GordonChatPanel } from "./GordonChatPanel";

interface Props {
  runId: string;
  proposals: HarmonizeProposal[];
  approvedIds: Set<string>;
  userId: string;
  gordonAgentId: string | null;
  gordonVoiceId: string | null;
  onToggle: (id: string) => void;
  onEditAfter: (proposalId: string, newAfter: string) => Promise<{ ok: boolean; reason?: string }>;
  onApplySingle?: (proposalId: string) => Promise<{ ok: boolean; reason?: string }>;
}

const ACTION_VARIANT: Record<HarmonizeProposal["action"], string> = {
  UPDATE: "bg-primary/10 text-primary border-primary/20",
  INSERT: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  MOVE: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  DELETE: "bg-destructive/10 text-destructive border-destructive/20",
};

/** Etichetta umana per la tabella di destinazione (categoria leggibile). */
const TABLE_META: Record<HarmonizeProposal["target"]["table"], { label: string; icon: typeof Database }> = {
  kb_entries:           { label: "Knowledge Base",    icon: BookOpen },
  agents:               { label: "Agente AI",         icon: Users },
  agent_personas:       { label: "Persona agente",    icon: Users },
  operative_prompts:    { label: "Prompt operativo",  icon: Wrench },
  email_prompts:        { label: "Template email",    icon: Mail },
  email_address_rules:  { label: "Regola email",      icon: Mail },
  commercial_playbooks: { label: "Playbook vendita",  icon: BookOpen },
  app_settings:         { label: "Impostazione app",  icon: Settings },
};

/** Classifica una proposta per il badge di stato in cima. */
function getProposalStatus(p: HarmonizeProposal): {
  kind: "done" | "failed" | "note" | "safe" | "review";
  label: string;
  cls: string;
  Icon: typeof ShieldCheck;
  tip: string;
} {
  if (p.status === "executed") {
    return { kind: "done", label: "Già applicata", cls: "bg-primary/15 text-primary border-primary/40", Icon: CheckCircle2, tip: "Questa proposta è già stata salvata nel database." };
  }
  if (p.status === "failed") {
    return { kind: "failed", label: "Applicazione fallita", cls: "bg-destructive/15 text-destructive border-destructive/40", Icon: AlertTriangle, tip: p.failure_reason ?? "Tentativo di salvataggio fallito." };
  }
  if (p.is_document_note) {
    return { kind: "note", label: "Nota documento — scarta", cls: "bg-muted text-muted-foreground border-border", Icon: FileQuestion, tip: p.document_note_reason ?? "Riferimento interno al documento, non contenuto KB." };
  }
  const isSafe =
    p.resolution_layer === "text" &&
    p.action !== "DELETE" &&
    p.impact !== "high" &&
    !(p.action === "INSERT" && p.target.table === "agents");
  if (isSafe) {
    return { kind: "safe", label: "Sicura", cls: "bg-emerald-500/15 text-emerald-700 border-emerald-500/40", Icon: ShieldCheck, tip: "Modifica di solo testo, basso impatto, reversibile." };
  }
  return { kind: "review", label: "Da rivedere", cls: "bg-amber-500/15 text-amber-700 border-amber-500/40", Icon: Eye, tip: "Inserimento, eliminazione o impatto alto: leggi attentamente prima di approvare." };
}

function EditableAfterInline({
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

  useEffect(() => { setDraft(value); setEditing(false); }, [value]);

  if (!editing) {
    return (
      <div>
        <div className="text-xs font-semibold text-muted-foreground flex items-center justify-between mb-1">
          <span>Dopo (proposta di Marco):</span>
          {editable && (
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => { setDraft(value); setEditing(true); }}>
              <Pencil className="h-3 w-3 mr-1" /> Modifica a mano
            </Button>
          )}
        </div>
        <pre className="text-xs bg-muted p-2.5 rounded whitespace-pre-wrap max-h-64 overflow-auto border">{value}</pre>
      </div>
    );
  }
  return (
    <div>
      <div className="text-xs font-semibold text-muted-foreground mb-1">Dopo (in modifica manuale):</div>
      <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} className="text-xs font-mono min-h-[140px]" />
      <div className="flex justify-end gap-2 mt-1.5">
        <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditing(false)}>
          <X className="h-3 w-3 mr-1" /> Annulla
        </Button>
        <Button
          size="sm"
          className="h-7"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            try {
              const res = await onSave(draft);
              if (res.ok) { toast.success("Modifica salvata nel DB"); setEditing(false); }
              else toast.error(`Salvataggio fallito: ${res.reason ?? "errore"}`);
            } finally { setSaving(false); }
          }}
        >
          {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
          Salva modifica
        </Button>
      </div>
    </div>
  );
}

export function SingleProposalReview({
  runId,
  proposals,
  approvedIds,
  userId,
  gordonAgentId,
  gordonVoiceId,
  onToggle,
  onEditAfter,
  onApplySingle,
}: Props) {
  const [index, setIndex] = useState(0);
  const [applying, setApplying] = useState(false);

  // Bound index quando la lista cambia
  useEffect(() => {
    if (index >= proposals.length) setIndex(Math.max(0, proposals.length - 1));
  }, [proposals.length, index]);

  const proposal = proposals[index];
  const isApproved = useMemo(() => proposal ? approvedIds.has(proposal.id) : false, [proposal, approvedIds]);

  if (!proposal) {
    return (
      <div className="flex flex-col items-center justify-center p-10 text-center text-muted-foreground">
        <AlertTriangle className="h-8 w-8 mb-2" />
        <p>Nessuna proposta da revisionare in questa run.</p>
      </div>
    );
  }

  const isReadOnly = proposal.resolution_layer === "contract" || proposal.resolution_layer === "code_policy";
  const statusBadge = getProposalStatus(proposal);
  const tableMeta = TABLE_META[proposal.target.table];
  const TableIcon = tableMeta?.icon ?? Database;
  const StatusIcon = statusBadge.Icon;

  const handleApply = async () => {
    if (!onApplySingle) return;
    setApplying(true);
    try {
      const res = await onApplySingle(proposal.id);
      if (res.ok) {
        toast.success("Proposta applicata al DB");
        // Avanza automaticamente
        if (index < proposals.length - 1) setIndex(index + 1);
      } else {
        toast.error(res.reason ?? "Applicazione fallita");
      }
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Striscia di stato in cima — sempre visibile, dice subito cos'è questa proposta */}
      <div className={`rounded-md border px-3 py-2 flex flex-wrap items-center gap-2 text-xs ${statusBadge.cls}`} title={statusBadge.tip}>
        <StatusIcon className="h-4 w-4 shrink-0" />
        <span className="font-semibold">{statusBadge.label}</span>
        <span className="opacity-50">·</span>
        <TableIcon className="h-3.5 w-3.5 shrink-0" />
        <span>Destinazione: <span className="font-medium">{tableMeta?.label ?? proposal.target.table}</span></span>
        {proposal.is_document_note && proposal.document_note_reason && (
          <span className="opacity-75 italic ml-1 truncate">— {proposal.document_note_reason}</span>
        )}
        {statusBadge.kind === "failed" && proposal.failure_reason && (
          <span className="opacity-75 italic ml-1 truncate">— {proposal.failure_reason}</span>
        )}
      </div>

      <ProposalNavigator
        index={index}
        total={proposals.length}
        onPrev={() => setIndex(Math.max(0, index - 1))}
        onNext={() => setIndex(Math.min(proposals.length - 1, index + 1))}
        onSkip={() => setIndex(Math.min(proposals.length - 1, index + 1))}
      />

      <div className="grid gap-3 md:grid-cols-2">
        {/* SINISTRA — dettaglio proposta */}
        <Card className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={ACTION_VARIANT[proposal.action]} variant="outline">{proposal.action}</Badge>
            <Badge variant="secondary">{proposal.target.table}</Badge>
            {proposal.target.id && (
              <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{proposal.target.id.slice(0, 8)}…</code>
            )}
            {isApproved && <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30" variant="outline">Selezionata</Badge>}
            {proposal.edited_by_user && <Badge variant="outline" className="text-amber-600 border-amber-500/40">Modificata da te</Badge>}
          </div>

          {proposal.block_label && (
            <div className="text-xs text-muted-foreground truncate">{proposal.block_label}</div>
          )}

          {proposal.before != null && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-1">Prima:</div>
              <pre className="text-xs bg-background border p-2.5 rounded whitespace-pre-wrap max-h-40 overflow-auto">{proposal.before}</pre>
            </div>
          )}

          {proposal.after != null && (
            <EditableAfterInline
              value={proposal.after}
              editable={!isReadOnly}
              onSave={(v) => onEditAfter(proposal.id, v)}
            />
          )}

          <Collapsible>
            <CollapsibleTrigger className="text-xs text-primary hover:underline flex items-center gap-1">
              <ChevronDown className="h-3 w-3" /> Spiegazione e dettagli
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-2">
              <div>
                <div className="text-xs font-semibold text-muted-foreground">Perché:</div>
                <p className="text-sm text-foreground/90">{proposal.reasoning}</p>
              </div>
              <div>
                <div className="text-xs font-semibold text-muted-foreground">Evidenza ({proposal.evidence.source}):</div>
                <p className="text-xs italic">"{proposal.evidence.excerpt}"</p>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <div className="flex items-center gap-2 pt-2 border-t">
            <Button
              size="sm"
              variant={isApproved ? "default" : "outline"}
              className="h-8"
              onClick={() => onToggle(proposal.id)}
              disabled={isReadOnly}
            >
              <Check className="w-3.5 h-3.5 mr-1" />
              {isApproved ? "Selezionata" : "Seleziona"}
            </Button>
            {onApplySingle && !isReadOnly && (
              <Button size="sm" className="h-8" onClick={handleApply} disabled={applying}>
                {applying ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1" />}
                Applica subito
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-8 ml-auto" onClick={() => setIndex(Math.min(proposals.length - 1, index + 1))} disabled={index >= proposals.length - 1}>
              Salta →
            </Button>
          </div>
        </Card>

        {/* DESTRA — Gordon chat */}
        <GordonChatPanel
          runId={runId}
          proposal={proposal}
          userId={userId}
          agentId={gordonAgentId}
          voiceId={gordonVoiceId}
          onApplyRegenerated={onEditAfter}
        />
      </div>
    </div>
  );
}