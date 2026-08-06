import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import { findAppSettingsMapForUser, saveAppSettingForUser } from "@/data/appSettings";

export function useAppSettings() {
  return useQuery({
    queryKey: queryKeys.appSettings.all,
    queryFn: async () => {
      const {
        data: { session: __s },
      } = await supabase.auth.getSession();
      const user = __s?.user ?? null;
      if (!user) return {} as Record<string, string>;
      return findAppSettingsMapForUser(user.id);
    },
    staleTime: 5 * 60_000,
  });
}

export function useUpdateSetting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const {
        data: { session: __s },
      } = await supabase.auth.getSession();
      const user = __s?.user ?? null;
      if (!user) throw new Error("Not authenticated");

      await saveAppSettingForUser(user.id, key, value);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.appSettings.all });
    },
  });
}
