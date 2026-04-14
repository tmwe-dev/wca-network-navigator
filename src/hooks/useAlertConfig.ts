import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

export interface AlertConfig {
  id: string;
  user_id: string;
  webhook_url: string | null;
  email_alert: string | null;
  enabled: boolean;
  alert_on_degraded: boolean;
  alert_on_error_rate: number;
  cooldown_minutes: number;
  last_alert_at: string | null;
  created_at: string;
}

export function useAlertConfig() {
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: queryKeys.alertConfig.all,
    queryFn: async () => {
      const { data } = await supabase
        .from("alert_config")
        .select("*")
        .maybeSingle();
      return data as AlertConfig | null;
    },
  });

  const updateConfig = useMutation({
    mutationFn: async (updates: Partial<AlertConfig>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("alert_config")
        .upsert({
          ...updates,
          user_id: user.id,
          ...(config?.id ? { id: config.id } : {}),
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.alertConfig.all });
    },
  });

  const testWebhook = useMutation({
    mutationFn: async (webhookUrl: string) => {
      const resp = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: "🧪 WCA Navigator — Test Alert",
          checks: { database: "ok", auth: "ok", storage: "ok", ai_gateway: "ok" },
          timestamp: new Date().toISOString(),
        }),
      });
      if (!resp.ok) throw new Error(`Webhook returned ${resp.status}`);
    },
  });

  return { config, isLoading, updateConfig, testWebhook };
}
