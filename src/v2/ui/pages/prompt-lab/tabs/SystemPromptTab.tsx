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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
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

  const dirtyCount = state.blocks.filter((b) => b.dirty).length;
  const improvedCount = state.blocks.filter((b) => b.improved).length;

  return (
    <div className="flex flex-col h-full min-h-0 gap-2">
      <div className="flex items-center justify-between flex-shrink-0 gap-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
          <span className="font-medium text-foreground">{state.blocks.length} blocchi</span>
          {dirtyCount > 0 && (
            <span className="text-amber-600">· {dirtyCount} non salvati</span>
          )}
          {improvedCount > 0 && (
            <span className="text-green-600">· {improvedCount} con proposta AI</span>
          )}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="text-muted-foreground/70 hover:text-foreground transition-colors">
                  <Info className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs text-xs">
                System prompt globale archiviato in <code>app_settings.{SETTING_KEY}</code>.
                Attivo nel Command Center, AI Assistant, missioni agenti e generazioni operative
                quando viene assemblato il contesto base dell'AI.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {improvedCount > 0 && (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={state.acceptAll}>
              Accetta tutte le proposte
            </Button>
          )}
          {dirtyCount > 0 && (
            <Button
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={saveAll}
              disabled={saving === "__all__"}
            >
              {saving === "__all__" ? "Salvo..." : `Salva tutto (${dirtyCount})`}
            </Button>
          )}
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <SplitBlockEditor
          blocks={state.blocks}
          onChange={state.updateContent}
          onAccept={state.acceptImproved}
          onDiscard={state.discardImproved}
          onImprove={onImprove}
          onSave={async () => { await saveAll(); }}
          saving={saving}
        />
      </div>
    </div>
  );
}