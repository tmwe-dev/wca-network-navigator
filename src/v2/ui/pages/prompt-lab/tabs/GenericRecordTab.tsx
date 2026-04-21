/**
 * GenericRecordTab — tab generico per Operative, Email, Playbooks, Personas.
 * Riceve un loader (ritorna Block[]) e un saver (onSave per id).
 */
import { useCallback, useState } from "react";
import { SplitBlockEditor } from "../SplitBlockEditor";
import { usePromptLabBlocks } from "../hooks/usePromptLabBlocks";
import { useLabAgent } from "../hooks/useLabAgent";
import type { Block } from "../types";
import { logSupervisorAudit } from "@/data/supervisorAuditLog";
import { toast } from "sonner";

interface GenericRecordTabProps {
  tabLabel: string;
  loader: () => Promise<Block[]>;
  saver: (block: Block) => Promise<{ table: string; id: string }>;
  loaderDeps?: ReadonlyArray<unknown>;
  emptyMessage?: string;
}

export function GenericRecordTab({ tabLabel, loader, saver, loaderDeps = [], emptyMessage }: GenericRecordTabProps) {
  const [saving, setSaving] = useState<string | null>(null);
  const lab = useLabAgent();
  const state = usePromptLabBlocks(loader, loaderDeps);

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

  const onImprove = useCallback(async (id: string) => {
    const block = state.blocks.find((b) => b.id === id);
    if (!block) return;
    setSaving(id);
    try {
      const improved = await lab.improveBlock({ block, tabLabel });
      state.setImproved(id, improved);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSaving(null);
    }
  }, [lab, state, tabLabel]);

  if (state.loading) return <div className="p-4 text-sm text-muted-foreground">Caricamento...</div>;
  if (state.blocks.length === 0) {
    return <div className="p-4 text-sm text-muted-foreground">{emptyMessage ?? "Nessun record disponibile."}</div>;
  }

  return (
    <div className="h-full min-h-0">
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
  );
}