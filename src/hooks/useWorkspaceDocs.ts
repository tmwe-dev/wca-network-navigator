/**
 * useWorkspaceDocs — hook di dominio per i documenti del workspace.
 * Isola i componenti dal DAL (regola layer: i componenti non importano @/data).
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { findWorkspaceDocs, createWorkspaceDoc, deleteWorkspaceDoc } from "@/data/workspaceDocs";
import { queryKeys } from "@/lib/queryKeys";

export function useWorkspaceDocs() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.workspaceDocs.all,
    queryFn: () => findWorkspaceDocs(),
  });
  return {
    documents: query.data ?? [],
    isLoading: query.isLoading,
    createDoc: createWorkspaceDoc,
    deleteDoc: deleteWorkspaceDoc,
    invalidate: () => qc.invalidateQueries({ queryKey: queryKeys.workspaceDocs.all }),
  };
}
