import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface WorkspacePreset {
  id: string;
  user_id: string;
  name: string;
  goal: string;
  base_proposal: string;
  document_ids: string[];
  reference_links: string[];
  created_at: string;
  updated_at: string;
}

export function useWorkspacePresets() {
  const qc = useQueryClient();
  const key = ["workspace-presets"];

  const { data: presets = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("workspace_presets" as any)
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as WorkspacePreset[];
    },
  });

  const save = useMutation({
    mutationFn: async (preset: { id?: string; name: string; goal: string; base_proposal: string; document_ids: string[]; reference_links: string[] }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (preset.id) {
        const { error } = await supabase
          .from("workspace_presets" as any)
          .update({
            name: preset.name,
            goal: preset.goal,
            base_proposal: preset.base_proposal,
            document_ids: preset.document_ids as any,
            reference_links: preset.reference_links as any,
            updated_at: new Date().toISOString(),
          })
          .eq("id", preset.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("workspace_presets" as any)
          .insert({
            user_id: user.id,
            name: preset.name,
            goal: preset.goal,
            base_proposal: preset.base_proposal,
            document_ids: preset.document_ids as any,
            reference_links: preset.reference_links as any,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("workspace_presets" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { presets, isLoading, save, remove };
}
