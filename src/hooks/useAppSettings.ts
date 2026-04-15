import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import { useAuth } from "@/providers/AuthProvider";

export function useAppSettings() {
  const { status, user } = useAuth();

  return useQuery({
    queryKey: queryKeys.appSettings.all,
    queryFn: async () => {
      if (!user) return {} as Record<string, string>;

      const { data, error } = await supabase
        .from("app_settings")
        .select("key, value")
        .eq("user_id", user.id);
      if (error) throw error;
      const map: Record<string, string> = {};
      data?.forEach((row) => {
        map[row.key] = row.value ?? "";
      });
      return map;
    },
    enabled: status === "authenticated" && !!user?.id,
    staleTime: 5 * 60_000,
  });
}

export function useUpdateSetting() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.appSettings.all });
    },
  });
}
