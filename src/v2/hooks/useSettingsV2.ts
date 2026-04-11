/**
 * useSettingsV2 — Settings CRUD with Result pattern
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SettingsMap {
  readonly [key: string]: string;
}

export function useSettingsV2() {
  return useQuery({
    queryKey: ["v2-settings"],
    queryFn: async (): Promise<SettingsMap> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return {};
      const { data, error } = await supabase
        .from("app_settings")
        .select("key, value")
        .eq("user_id", user.id);
      if (error) throw error;
      const map: Record<string, string> = {};
      data?.forEach((row) => {
        if (row.value) map[row.key] = row.value;
      });
      return map;
    },
  });
}

export function useUpdateSettingV2() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data: existing } = await supabase
        .from("app_settings")
        .select("id")
        .eq("key", key)
        .eq("user_id", user.id)
        .maybeSingle();
      if (existing) {
        const { error } = await supabase
          .from("app_settings")
          .update({ value })
          .eq("key", key)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("app_settings")
          .insert({ key, value, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["v2-settings"] }),
  });
}
