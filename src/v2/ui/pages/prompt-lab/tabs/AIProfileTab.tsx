/**
 * AIProfileTab — chiavi ai_* da app_settings.
 */
import { useCallback, useState } from "react";
import { SplitBlockEditor } from "../SplitBlockEditor";
import { usePromptLabBlocks } from "../hooks/usePromptLabBlocks";
import { useLabAgent } from "../hooks/useLabAgent";
import type { Block } from "../types";
import { upsertAppSetting } from "@/data/appSettings";
import { logSupervisorAudit } from "@/data/supervisorAuditLog";
import { useAuth } from "@/providers/AuthProvider";
import { useAppSettings } from "@/hooks/useAppSettings";
import { toast } from "sonner";

const AI_PROFILE_KEYS: Array<{ key: string; label: string }> = [
  { key: "ai_company_name", label: "Azienda — Nome" },
  { key: "ai_company_alias", label: "Azienda — Alias" },
  { key: "ai_contact_name", label: "Referente — Nome" },
  { key: "ai_contact_role", label: "Referente — Ruolo" },
  { key: "ai_sector", label: "Settore" },
  { key: "ai_tone", label: "Tono" },
  { key: "ai_language", label: "Lingua" },
  { key: "ai_business_goals", label: "Obiettivi business" },
  { key: "ai_behavior_rules", label: "Regole comportamentali" },
  { key: "ai_style_instructions", label: "Istruzioni stile" },
  { key: "system_mission_text", label: "Mission di Sistema (Migliora tutto)" },
];

export function AIProfileTab() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const settings = useAppSettings();
  const [saving, setSaving] = useState<string | null>(null);
  const lab = useLabAgent();

  const state = usePromptLabBlocks(async (): Promise<Block[]> => {
    return AI_PROFILE_KEYS.map((k) => ({
      id: k.key,
      label: k.label,
      content: settings.data?.[k.key] ?? "",
      source: { kind: "app_setting", key: k.key },
      dirty: false,
    }));
  }, [settings.data]);

  const onSave = useCallback(async (id: string) => {
    const block = state.blocks.find((b) => b.id === id);
    if (!block || !userId) return;
    setSaving(id);
    try {
      await upsertAppSetting(userId, id, block.content);
      await logSupervisorAudit({ action: "prompt_lab_save", target_table: "app_settings", target_id: id });
      state.markClean(id);
      toast.success(`${block.label} salvato`);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSaving(null);
    }
  }, [state, userId]);

  const onImprove = useCallback(async (id: string) => {
    const block = state.blocks.find((b) => b.id === id);
    if (!block) return;
    setSaving(id);
    try {
      const improved = await lab.improveBlock({ block, tabLabel: "AI Profile" });
      state.setImproved(id, improved);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSaving(null);
    }
  }, [lab, state]);

  if (state.loading) return <div className="p-4 text-sm text-muted-foreground">Caricamento...</div>;

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