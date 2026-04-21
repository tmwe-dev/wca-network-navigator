/**
 * SystemPromptTab — blocchi system prompt da app_settings.system_prompt_blocks
 */
import { useCallback, useState } from "react";
import { SplitBlockEditor } from "../SplitBlockEditor";
import { usePromptLabBlocks } from "../hooks/usePromptLabBlocks";
import { useLabAgent } from "../hooks/useLabAgent";
import { DEFAULT_SYSTEM_PROMPT_BLOCKS, type Block } from "../types";
import { getAppSetting, upsertAppSetting } from "@/data/appSettings";
import { logSupervisorAudit } from "@/data/supervisorAuditLog";
import { useAuth } from "@/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const SETTING_KEY = "system_prompt_blocks";

export function SystemPromptTab() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const [saving, setSaving] = useState<string | null>(null);
  const lab = useLabAgent();

  const state = usePromptLabBlocks(async (): Promise<Block[]> => {
    if (!userId) return [];
    const raw = await getAppSetting(SETTING_KEY, userId);
    let stored: Array<{ id: string; label: string; content: string }> = [];
    if (raw) {
      try { stored = JSON.parse(raw); } catch { stored = []; }
    }
    return DEFAULT_SYSTEM_PROMPT_BLOCKS.map((d) => {
      const hit = stored.find((s) => s.id === d.id);
      return {
        id: d.id,
        label: d.label,
        content: hit?.content ?? d.content,
        source: { kind: "app_setting", key: SETTING_KEY },
        dirty: false,
      };
    });
  }, [userId]);

  const saveAll = useCallback(async () => {
    if (!userId) return;
    setSaving("__all__");
    try {
      const payload = state.blocks.map((b) => ({ id: b.id, label: b.label, content: b.content }));
      await upsertAppSetting(userId, SETTING_KEY, JSON.stringify(payload));
      await logSupervisorAudit({
        action: "prompt_lab_save",
        target_table: "app_settings",
        target_id: SETTING_KEY,
        payload: { blocks: payload.length },
      });
      state.blocks.forEach((b) => state.markClean(b.id));
      toast.success("System prompt salvato");
    } catch (e) {
      toast.error(`Errore salvataggio: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(null);
    }
  }, [state, userId]);

  const onImprove = useCallback(async (id: string) => {
    const block = state.blocks.find((b) => b.id === id);
    if (!block) return;
    setSaving(id);
    try {
      const improved = await lab.improveBlock({ block, tabLabel: "System Prompt" });
      state.setImproved(id, improved);
    } catch (e) {
      toast.error(`Lab Agent: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(null);
    }
  }, [lab, state]);

  if (state.loading) return <div className="p-4 text-sm text-muted-foreground">Caricamento...</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">7 blocchi del system prompt globale (app_settings.{SETTING_KEY})</p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={state.acceptAll}>Accetta tutti</Button>
          <Button size="sm" onClick={saveAll} disabled={saving === "__all__"}>
            {saving === "__all__" ? "Salvo..." : "Salva tutto"}
          </Button>
        </div>
      </div>
      <SplitBlockEditor
        blocks={state.blocks}
        onChange={state.updateContent}
        onAccept={state.acceptImproved}
        onDiscard={state.discardImproved}
        onImprove={onImprove}
        saving={saving}
      />
    </div>
  );
}