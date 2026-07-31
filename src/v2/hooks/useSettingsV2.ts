/**
 * useSettingsV2 — Settings CRUD with Result pattern
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import { fetchUserSettingsMap } from "@/data/settingsMapV2";
import { saveAppSettingForUser } from "@/data/appSettings";

export interface SettingsMap {
  readonly [key: string]: string;
}

export function useSettingsV2() {
  return useQuery({
    queryKey: queryKeys.v2.settings,
    queryFn: async (): Promise<SettingsMap> => {
      const { data: { session: __s } } = await supabase.auth.getSession(); const user = __s?.user ?? null;
      if (!user) return {};
      return fetchUserSettingsMap(user.id);
    },
  });
}

export function useUpdateSettingV2() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const { data: { session: __s } } = await supabase.auth.getSession(); const user = __s?.user ?? null;
      if (!user) throw new Error("Not authenticated");
      await saveAppSettingForUser(user.id, key, value);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.v2.settings }),
  });
}
