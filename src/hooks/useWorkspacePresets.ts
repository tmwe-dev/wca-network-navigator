import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type WorkspacePresetRow = Database["public"]["Tables"]["workspace_presets"]["Row"];

export type WorkspacePreset = WorkspacePresetRow;

export function useWorkspacePresets() {
  const qc = useQueryClient();
  const key = ["workspace-presets"];

  const { data: presets = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("workspace_presets")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60_000,
  });

  const save = useMutation({
    mutationFn: async (preset: { id?: string; name: string; goal: string; base_proposal: string; document_ids: string[]; reference_links: string[] }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (preset.id) {
        const { error } = await supabase
          .from("workspace_presets")
          .update({
            name: preset.name,
            goal: preset.goal,
            base_proposal: preset.base_proposal,
            document_ids: preset.document_ids,
            reference_links: preset.reference_links,
            updated_at: new Date().toISOString(),
          })
          .eq("id", preset.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("workspace_presets")
          .insert({
            user_id: user.id,
            name: preset.name,
            goal: preset.goal,
            base_proposal: preset.base_proposal,
            document_ids: preset.document_ids,
            reference_links: preset.reference_links,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("workspace_presets")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { presets, isLoading, save, remove };
}
