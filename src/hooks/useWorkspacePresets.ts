import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  findWorkspacePresets,
  updateWorkspacePreset,
  insertWorkspacePreset,
  deleteWorkspacePreset,
  type WorkspacePresetRow,
} from "@/data/workspacePresets";

export type WorkspacePreset = WorkspacePresetRow;

export function useWorkspacePresets() {
  const qc = useQueryClient();
  const key = ["workspace-presets"];

  const { data: presets = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data: { session: __s } } = await supabase.auth.getSession(); const user = __s?.user ?? null;
      if (!user) return [];
      return await findWorkspacePresets(user.id);
    },
    staleTime: 5 * 60_000,
  });

  const save = useMutation({
    mutationFn: async (preset: { id?: string; name: string; goal: string; base_proposal: string; document_ids: string[]; reference_links: string[] }) => {
      const { data: { session: __s } } = await supabase.auth.getSession(); const user = __s?.user ?? null;
      if (!user) throw new Error("Not authenticated");

      if (preset.id) {
        await updateWorkspacePreset(preset.id, {
          name: preset.name,
          goal: preset.goal,
          base_proposal: preset.base_proposal,
          document_ids: preset.document_ids,
          reference_links: preset.reference_links,
        });
      } else {
        await insertWorkspacePreset(user.id, {
          name: preset.name,
          goal: preset.goal,
          base_proposal: preset.base_proposal,
          document_ids: preset.document_ids,
          reference_links: preset.reference_links,
        });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteWorkspacePreset(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { presets, isLoading, save, remove };
}
