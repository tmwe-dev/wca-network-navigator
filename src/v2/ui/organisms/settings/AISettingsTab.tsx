/**
 * AISettingsTab — AI configuration and KB management
 */
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSettingsV2, useUpdateSettingV2 } from "@/v2/hooks/useSettingsV2";
import { useState, useEffect } from "react";
import { Button } from "../../atoms/Button";
import { toast } from "sonner";
import { queryKeys } from "@/lib/queryKeys";

export function AISettingsTab(): React.ReactElement {
  const { data: settings } = useSettingsV2();
  const updateSetting = useUpdateSettingV2();
  const [defaultModel, setDefaultModel] = useState("openai/gpt-5-mini");
  const [approvalRequired, setApprovalRequired] = useState(false);

  useEffect(() => {
    if (settings?.default_ai_model) setDefaultModel(settings.default_ai_model);
    if (settings?.ai_approval_required) setApprovalRequired(settings.ai_approval_required === "true");
  }, [settings]);

  const { data: kbCount } = useQuery({
    queryKey: queryKeys.v2.kbCount,
    queryFn: async () => {
      const { count, error } = await supabase.from("kb_entries").select("id", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: memoryCount } = useQuery({
    queryKey: queryKeys.v2.memoryCount,
    queryFn: async () => {
      const { count, error } = await supabase.from("ai_memory").select("id", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });

  const handleSave = async () => {
    try {
      await updateSetting.mutateAsync({ key: "default_ai_model", value: defaultModel });
      await updateSetting.mutateAsync({ key: "ai_approval_required", value: String(approvalRequired) });
      toast.success("Configurazione AI salvata");
    } catch {
      toast.error("Errore nel salvataggio");
    }
  };

  return (
    <div className="space-y-6 max-w-lg">
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Modello AI predefinito</label>
        <select
          className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground"
          value={defaultModel}
          onChange={(e) => setDefaultModel(e.target.value)}
        >
          <option value="openai/gpt-5-mini">GPT-5 Mini</option>
          <option value="openai/gpt-5">GPT-5</option>
          <option value="openai/gpt-5-nano">GPT-5 Nano</option>
          <option value="google/gemini-2.5-flash">Gemini 2.5 Flash</option>
          <option value="google/gemini-2.5-pro">Gemini 2.5 Pro</option>
        </select>
      </div>
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="approval"
          checked={approvalRequired}
          onChange={(e) => setApprovalRequired(e.target.checked)}
          className="rounded"
        />
        <label htmlFor="approval" className="text-sm text-foreground">
          Approvazione obbligatoria per azioni AI
        </label>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 rounded-lg border bg-card">
          <p className="text-2xl font-bold text-foreground">{kbCount ?? "—"}</p>
          <p className="text-xs text-muted-foreground">Knowledge Base entries</p>
        </div>
        <div className="p-4 rounded-lg border bg-card">
          <p className="text-2xl font-bold text-foreground">{memoryCount ?? "—"}</p>
          <p className="text-xs text-muted-foreground">Memorie episodiche</p>
        </div>
      </div>
      <Button onClick={handleSave} isLoading={updateSetting.isPending}>Salva</Button>
    </div>
  );
}
