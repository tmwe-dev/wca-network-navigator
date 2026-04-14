/**
 * AISettingsTab — AI configuration, API keys, and KB management
 */
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSettingsV2, useUpdateSettingV2 } from "@/v2/hooks/useSettingsV2";
import { useState, useEffect } from "react";
import { Button } from "../../atoms/Button";
import { toast } from "sonner";
import { queryKeys } from "@/lib/queryKeys";
import { Eye, EyeOff, Key, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const AI_PROVIDERS = [
  {
    id: "openai",
    name: "OpenAI",
    settingKey: "ai_key_openai",
    description: "GPT-4, GPT-5 e modelli avanzati",
    link: "https://platform.openai.com/api-keys",
    placeholder: "sk-...",
  },
  {
    id: "google",
    name: "Google AI (Gemini)",
    settingKey: "ai_key_google",
    description: "Modelli Gemini per ragionamento multimodale",
    link: "https://aistudio.google.com/apikey",
    placeholder: "AIza...",
  },
  {
    id: "anthropic",
    name: "Anthropic (Claude)",
    settingKey: "ai_key_anthropic",
    description: "Claude per analisi precise e sicure",
    link: "https://console.anthropic.com/settings/keys",
    placeholder: "sk-ant-...",
  },
  {
    id: "xai",
    name: "xAI (Grok)",
    settingKey: "ai_key_xai",
    description: "Grok per analisi in tempo reale",
    link: "https://console.x.ai/",
    placeholder: "xai-...",
  },
  {
    id: "qwen",
    name: "Qwen (Alibaba)",
    settingKey: "ai_key_qwen",
    description: "Modelli Qwen per multilingua e ragionamento",
    link: "https://dashscope.console.aliyun.com/",
    placeholder: "sk-...",
  },
  {
    id: "elevenlabs",
    name: "ElevenLabs",
    settingKey: "ai_key_elevenlabs",
    description: "Sintesi vocale e agenti conversazionali",
    link: "https://elevenlabs.io/app/settings/api-keys",
    placeholder: "xi-...",
  },
];

export function AISettingsTab(): React.ReactElement {
  const { data: settings } = useSettingsV2();
  const updateSetting = useUpdateSettingV2();
  const [defaultModel, setDefaultModel] = useState("openai/gpt-5-mini");
  const [approvalRequired, setApprovalRequired] = useState(false);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!settings) return;
    if (settings.default_ai_model) setDefaultModel(settings.default_ai_model);
    if (settings.ai_approval_required) setApprovalRequired(settings.ai_approval_required === "true");
    const keys: Record<string, string> = {};
    for (const p of AI_PROVIDERS) {
      const val = settings[p.settingKey];
      if (val) keys[p.id] = val;
    }
    setApiKeys(keys);
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
    setSaving(true);
    try {
      await updateSetting.mutateAsync({ key: "default_ai_model", value: defaultModel });
      await updateSetting.mutateAsync({ key: "ai_approval_required", value: String(approvalRequired) });
      for (const p of AI_PROVIDERS) {
        const val = apiKeys[p.id]?.trim() || "";
        await updateSetting.mutateAsync({ key: p.settingKey, value: val });
      }
      toast.success("Configurazione AI salvata");
    } catch {
      toast.error("Errore nel salvataggio");
    } finally {
      setSaving(false);
    }
  };

  const configuredCount = Object.values(apiKeys).filter(k => k?.trim()).length;

  return (
    <ScrollArea className="h-[calc(100vh-12rem)]">
      <div className="space-y-6 max-w-lg pr-4">
        {/* Model selection */}
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

        {/* Approval */}
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

        {/* API Keys */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">
              Chiavi API Provider ({configuredCount}/{AI_PROVIDERS.length})
            </h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Inserisci le chiavi API per usare i tuoi account provider senza consumare crediti. Le chiavi sono crittografate e accessibili solo a te.
          </p>

          <div className="space-y-2 mt-3">
            {AI_PROVIDERS.map(provider => {
              const hasKey = !!apiKeys[provider.id]?.trim();
              return (
                <Collapsible key={provider.id}>
                  <CollapsibleTrigger className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors text-left">
                    <div className="flex items-center gap-2">
                      {hasKey ? (
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                      )}
                      <span className="text-sm font-medium text-foreground">{provider.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {hasKey ? "Configurata" : "Non configurata"}
                    </span>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-3 pb-3 pt-2 space-y-2">
                    <p className="text-xs text-muted-foreground">{provider.description}</p>
                    <div className="relative">
                      <Input
                        type={showKeys[provider.id] ? "text" : "password"}
                        value={apiKeys[provider.id] || ""}
                        onChange={e => setApiKeys(prev => ({ ...prev, [provider.id]: e.target.value }))}
                        placeholder={provider.placeholder}
                        className="pr-10 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKeys(p => ({ ...p, [provider.id]: !p[provider.id] }))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showKeys[provider.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <a
                      href={provider.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" /> Ottieni chiave API
                    </a>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        </div>

        {/* Stats */}
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

        <Button onClick={handleSave} isLoading={saving}>
          Salva configurazione
        </Button>
      </div>
    </ScrollArea>
  );
}
