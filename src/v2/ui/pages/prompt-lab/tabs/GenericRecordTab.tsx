/**
 * GenericRecordTab — tab generico per Operative, Email, Playbooks, Personas.
 * Riceve un loader (ritorna Block[]) e un saver (onSave per id).
 */
import { useCallback, useMemo, useState } from "react";
import { SplitBlockEditor } from "../SplitBlockEditor";
import { usePromptLabBlocks } from "../hooks/usePromptLabBlocks";
import { useLabAgent, type BriefingPayload } from "../hooks/useLabAgent";
import { type Block, PROMPT_LAB_TABS } from "../types";
import { logSupervisorAudit } from "@/data/supervisorAuditLog";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ClipboardCheck, Sparkles } from "lucide-react";
import { ImproveBriefingDialog } from "../ImproveBriefingDialog";
import { isVoiceBlock } from "../promptRubrics";

interface GenericRecordTabProps {
  tabLabel: string;
  loader: () => Promise<Block[]>;
  saver: (block: Block) => Promise<{ table: string; id: string }>;
  loaderDeps?: ReadonlyArray<unknown>;
  emptyMessage?: string;
}

export function GenericRecordTab({ tabLabel, loader, saver, loaderDeps = [], emptyMessage }: GenericRecordTabProps) {
  const [saving, setSaving] = useState<string | null>(null);
  const [briefingOpen, setBriefingOpen] = useState(false);
  const [pendingBlockId, setPendingBlockId] = useState<string | null>(null);
  const [lastBriefing, setLastBriefing] = useState<BriefingPayload | null>(null);
  const lab = useLabAgent();
  const state = usePromptLabBlocks(loader, loaderDeps);

  const tabActivation = useMemo(
    () => PROMPT_LAB_TABS.find((t) => t.label === tabLabel)?.activation,
    [tabLabel],
  );

  const onSave = useCallback(async (id: string) => {
    const block = state.blocks.find((b) => b.id === id);
    if (!block) return;
    setSaving(id);
    try {
      const meta = await saver(block);
      await logSupervisorAudit({ action: "prompt_lab_save", target_table: meta.table, target_id: meta.id });
      state.markClean(id);
      toast.success(`${block.label} salvato`);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSaving(null);
    }
  }, [saver, state]);

  // Quando l'utente clicca "Migliora" sul blocco, apriamo il dialog briefing.
  const onImprove = useCallback((id: string) => {
    setPendingBlockId(id);
    setBriefingOpen(true);
  }, []);

  // Esegue il miglioramento dopo che il briefing è confermato.
  const runImproveWithBriefing = useCallback(
    async (briefing: BriefingPayload) => {
      if (!pendingBlockId) return;
      const block = state.blocks.find((b) => b.id === pendingBlockId);
      if (!block) return;
      setBriefingOpen(false);
      setSaving(pendingBlockId);
      setLastBriefing(briefing);
      try {
        const improved = await lab.improveBlock({
          block,
          tabLabel,
          tabActivation,
          nearbyBlocks: state.blocks,
          briefing,
        });
        state.setImproved(pendingBlockId, improved);
        toast.success("Miglioramento generato con briefing applicato");
      } catch (e) {
        toast.error(String(e));
      } finally {
        setSaving(null);
        setPendingBlockId(null);
      }
    },
    [lab, state, tabLabel, tabActivation, pendingBlockId],
  );

  // Variante "Migliora rapido" con ultimo briefing usato (skip dialog).
  const onQuickImprove = useCallback(
    async (id: string) => {
      if (!lastBriefing) {
        // Nessun briefing pregresso → apri dialog
        onImprove(id);
        return;
      }
      const block = state.blocks.find((b) => b.id === id);
      if (!block) return;
      setSaving(id);
      try {
        const improved = await lab.improveBlock({
          block,
          tabLabel,
          tabActivation,
          nearbyBlocks: state.blocks,
          briefing: lastBriefing,
        });
        state.setImproved(id, improved);
      } catch (e) {
        toast.error(String(e));
      } finally {
        setSaving(null);
      }
    },
    [lab, state, tabLabel, tabActivation, lastBriefing, onImprove],
  );

  const pendingBlock = pendingBlockId ? state.blocks.find((b) => b.id === pendingBlockId) ?? null : null;
  const detectedKind = pendingBlock
    ? isVoiceBlock({
        tabLabel,
        source: pendingBlock.source,
        label: pendingBlock.label,
        content: pendingBlock.content,
      })
      ? "voice"
      : pendingBlock.source.kind
    : undefined;

  if (state.loading) return <div className="p-4 text-sm text-muted-foreground">Caricamento...</div>;
  if (state.blocks.length === 0) {
    return <div className="p-4 text-sm text-muted-foreground">{emptyMessage ?? "Nessun record disponibile."}</div>;
  }

  return (
    <div className="flex flex-col h-full min-h-0 gap-2">
      <div className="flex items-center gap-2 flex-shrink-0 text-[11px] text-muted-foreground">
        <ClipboardCheck className="h-3.5 w-3.5 flex-shrink-0" />
        <span>
          Cliccando <strong className="text-foreground">Migliora</strong> apri la <em>checklist briefing</em>:
          obiettivo + canale + audience + vincoli. L'AI userà solo questi parametri.
        </span>
        {lastBriefing && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[10px] gap-1 ml-auto"
            onClick={() => setLastBriefing(null)}
            title="Resetta briefing salvato"
          >
            <Sparkles className="h-3 w-3" />
            Briefing attivo · reset
          </Button>
        )}
      </div>
      <div className="flex-1 min-h-0">
        <SplitBlockEditor
          blocks={state.blocks}
          onChange={state.updateContent}
          onAccept={state.acceptImproved}
          onDiscard={state.discardImproved}
          onImprove={onImprove}
          onSave={onSave}
          saving={saving}
        />
      </div>
      <ImproveBriefingDialog
        open={briefingOpen}
        onOpenChange={(v) => {
          setBriefingOpen(v);
          if (!v) setPendingBlockId(null);
        }}
        block={pendingBlock}
        tabLabel={tabLabel}
        detectedKind={detectedKind}
        onConfirm={runImproveWithBriefing}
        loading={saving === pendingBlockId}
      />
    </div>
  );
}