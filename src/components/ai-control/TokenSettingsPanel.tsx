/**
 * TokenSettingsPanel — Configuration for token limits and settings
 */
import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getTokenSettings, updateTokenSetting } from "@/data/tokenUsage";
import { queryKeys } from "@/lib/queryKeys";
import { Card } from "@/components/ui/card";
import { Button } from "@/v2/ui/atoms/Button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface TokenSetting {
  key: string;
  label: string;
  description: string;
  value: string;
  type: "number";
}

export function TokenSettingsPanel() {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});

  // Load user
  useEffect(() => {
    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user?.id) {
        setUserId(data.user.id);
      }
    };
    loadUser();
  }, []);

  // Load token settings
  const { data: settings } = useQuery({
    queryKey: queryKeys.tokenUsage.settings,
    queryFn: async () => {
      if (!userId) return {};
      return getTokenSettings(userId);
    },
    enabled: !!userId,
  });

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (updates: Record<string, string>) => {
      if (!userId) throw new Error("Not authenticated");
      for (const [key, value] of Object.entries(updates)) {
        await updateTokenSetting(userId, key, value);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tokenUsage.settings });
      toast.success("Impostazioni token salvate");
    },
    onError: (error) => {
      toast.error("Errore salvataggio impostazioni");
      console.error(error);
    },
  });

  const handleChange = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    saveMutation.mutate(formData);
  };

  const tokenSettings: TokenSetting[] = [
    {
      key: "ai_daily_token_limit",
      label: "Limite giornaliero token",
      description: "Massimo numero di token consumabili al giorno",
      value: formData.ai_daily_token_limit || "500000",
      type: "number",
    },
    {
      key: "ai_monthly_token_limit",
      label: "Limite mensile token",
      description: "Massimo numero di token consumabili al mese",
      value: formData.ai_monthly_token_limit || "10000000",
      type: "number",
    },
    {
      key: "ai_max_tokens_generate_email",
      label: "Max token - Genera Email",
      description: "Limite per funzione di generazione email",
      value: formData.ai_max_tokens_generate_email || "1500",
      type: "number",
    },
    {
      key: "ai_max_tokens_generate_outreach",
      label: "Max token - Genera Outreach",
      description: "Limite per funzione di generazione outreach",
      value: formData.ai_max_tokens_generate_outreach || "1200",
      type: "number",
    },
    {
      key: "ai_max_tokens_improve_email",
      label: "Max token - Migliora Email",
      description: "Limite per funzione di miglioramento email",
      value: formData.ai_max_tokens_improve_email || "1500",
      type: "number",
    },
    {
      key: "ai_max_tokens_classify_email",
      label: "Max token - Classifica Email",
      description: "Limite per funzione di classificazione email",
      value: formData.ai_max_tokens_classify_email || "300",
      type: "number",
    },
    {
      key: "ai_max_tokens_ai_assistant",
      label: "Max token - Assistente AI",
      description: "Limite per assistente AI",
      value: formData.ai_max_tokens_ai_assistant || "2048",
      type: "number",
    },
    {
      key: "ai_rate_limit_per_minute",
      label: "Rate limit - Richieste/minuto",
      description: "Massimo numero di richieste AI al minuto",
      value: formData.ai_rate_limit_per_minute || "20",
      type: "number",
    },
    {
      key: "ai_cooldown_between_calls_ms",
      label: "Cooldown tra chiamate (ms)",
      description: "Millisecondi di attesa tra chiamate AI consecutive",
      value: formData.ai_cooldown_between_calls_ms || "500",
      type: "number",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-4">
          Configurazione Token Management
        </h3>
        <p className="text-xs text-muted-foreground mb-6">
          Configura i limiti di token e le impostazioni di rate limiting per le funzioni AI
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tokenSettings.map((setting) => (
          <Card key={setting.key} className="p-4 dark:bg-slate-900/50">
            <div className="space-y-3">
              <div>
                <Label htmlFor={setting.key} className="text-xs font-semibold">
                  {setting.label}
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {setting.description}
                </p>
              </div>
              <Input
                id={setting.key}
                type="number"
                value={setting.value}
                onChange={(e) => handleChange(setting.key, e.target.value)}
                className="h-8 text-sm"
                min="0"
              />
            </div>
          </Card>
        ))}
      </div>

      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setFormData(settings || {});
          }}
          disabled={saveMutation.isPending}
        >
          Annulla
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? "Salvataggio..." : "Salva impostazioni"}
        </Button>
      </div>
    </div>
  );
}
