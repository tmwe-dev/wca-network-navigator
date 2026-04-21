/**
 * GenericRecordTab — tab generico per Operative, Email, Playbooks, Personas.
 * Riceve un loader (ritorna Block[]) e un saver (onSave per id).
 */
import { useCallback, useMemo, useState } from "react";
import { SplitBlockEditor } from "../SplitBlockEditor";
import { usePromptLabBlocks } from "../hooks/usePromptLabBlocks";
import { useLabAgent } from "../hooks/useLabAgent";
import { type Block, PROMPT_LAB_TABS } from "../types";
import { logSupervisorAudit } from "@/data/supervisorAuditLog";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Target } from "lucide-react";

interface GenericRecordTabProps {
  tabLabel: string;
  loader: () => Promise<Block[]>;
  saver: (block: Block) => Promise<{ table: string; id: string }>;
  loaderDeps?: ReadonlyArray<unknown>;
  emptyMessage?: string;
}

export function GenericRecordTab({ tabLabel, loader, saver, loaderDeps = [], emptyMessage }: GenericRecordTabProps) {
  const [saving, setSaving] = useState<string | null>(null);
  const [goal, setGoal] = useState("");
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

  const onImprove = useCallback(async (id: string) => {
    const block = state.blocks.find((b) => b.id === id);
    if (!block) return;
    setSaving(id);
    try {
      const improved = await lab.improveBlock({
        block,
        tabLabel,
        tabActivation,
        nearbyBlocks: state.blocks,
        goal: goal.trim() || undefined,
      });
      state.setImproved(id, improved);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSaving(null);
    }
  }, [lab, state, tabLabel, tabActivation, goal]);

  if (state.loading) return <div className="p-4 text-sm text-muted-foreground">Caricamento...</div>;
  if (state.blocks.length === 0) {
    return <div className="p-4 text-sm text-muted-foreground">{emptyMessage ?? "Nessun record disponibile."}</div>;
  }

  return (
    <div className="flex flex-col h-full min-h-0 gap-2">
      <div className="flex items-center gap-2 flex-shrink-0">
        <Target className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        <Input
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder='Obiettivo opzionale per il "Migliora" (es: "più risposte da lead in holding")'
          className="h-7 text-xs"
        />
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
    </div>
  );
}