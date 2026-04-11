/**
 * useWorkspaceDocsV2 — Workspace documents management
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchWorkspaceDocs } from "@/v2/io/supabase/queries/workspace-docs";
import { createWorkspaceDoc, deleteWorkspaceDoc } from "@/v2/io/supabase/mutations/workspace-docs";
import { isOk } from "@/v2/core/domain/result";
import type { WorkspaceDoc } from "@/v2/core/domain/entities";
import type { Database } from "@/integrations/supabase/types";

export function useWorkspaceDocsV2() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["v2", "workspace-docs"],
    queryFn: async (): Promise<readonly WorkspaceDoc[]> => {
      const result = await fetchWorkspaceDocs();
      return isOk(result) ? result.value : [];
    },
  });

  const createMut = useMutation({
    mutationFn: (doc: Database["public"]["Tables"]["workspace_documents"]["Insert"]) =>
      createWorkspaceDoc(doc),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["v2", "workspace-docs"] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteWorkspaceDoc(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["v2", "workspace-docs"] }),
  });

  return { ...query, createDoc: createMut.mutate, deleteDoc: deleteMut.mutate };
}
