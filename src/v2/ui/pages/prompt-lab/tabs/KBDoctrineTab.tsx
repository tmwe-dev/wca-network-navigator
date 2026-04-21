/**
 * KBDoctrineTab — voci KB di categoria doctrine.
 */
import { useCallback, useState } from "react";
import { SplitBlockEditor } from "../SplitBlockEditor";
import { usePromptLabBlocks } from "../hooks/usePromptLabBlocks";
import { useLabAgent } from "../hooks/useLabAgent";
import type { Block } from "../types";
import { findKbEntries, upsertKbEntry } from "@/data/kbEntries";
import { logSupervisorAudit } from "@/data/supervisorAuditLog";
import { useAuth } from "@/providers/AuthProvider";
import { toast } from "sonner";

const DOCTRINE_CATEGORIES = ["system_doctrine", "system_core", "memory_protocol", "learning_protocol", "workflow_gate", "doctrine"];

export function KBDoctrineTab() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const [saving, setSaving] = useState<string | null>(null);
  const lab = useLabAgent();

  const state = usePromptLabBlocks(async (): Promise<Block[]> => {
    const all = await findKbEntries();
    return all
      .filter((e) => DOCTRINE_CATEGORIES.includes(e.category))
      .slice(0, 50)
      .map((e) => ({
        id: e.id,
        label: `[${e.category}] ${e.title}`,
        hint: e.chapter,
        content: e.content,
        source: { kind: "kb_entry", id: e.id },
        dirty: false,
      }));
  }, []);

  const onSave = useCallback(async (id: string) => {
    const block = state.blocks.find((b) => b.id === id);
    if (!block || !userId) return;
    setSaving(id);
    try {
      await upsertKbEntry({ id, content: block.content, title: block.label.replace(/^\[[^\]]+\]\s*/, "") }, userId);
      await logSupervisorAudit({ action: "prompt_lab_save", target_table: "kb_entries", target_id: id });
      state.markClean(id);
      toast.success("KB entry salvata");
    } catch (e) {
      toast.error(`Errore: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(null);
    }
  }, [state, userId]);

  const onImprove = useCallback(async (id: string) => {
    const block = state.blocks.find((b) => b.id === id);
    if (!block) return;
    setSaving(id);
    try {
      const improved = await lab.improveBlock({ block, tabLabel: "KB Doctrine" });
      state.setImproved(id, improved);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSaving(null);
    }
  }, [lab, state]);

  if (state.loading) return <div className="p-4 text-sm text-muted-foreground">Caricamento KB...</div>;

  return (
    <SplitBlockEditor
      blocks={state.blocks}
      onChange={state.updateContent}
      onAccept={state.acceptImproved}
      onDiscard={state.discardImproved}
      onImprove={onImprove}
      onSave={onSave}
      saving={saving}
    />
  );
}