/**
 * useKbEntriesV2 — Knowledge Base entries
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchKbEntries, searchKbEntries } from "@/v2/io/supabase/queries/kb-entries";
import { createKbEntry, updateKbEntry, deleteKbEntry } from "@/v2/io/supabase/mutations/kb-entries";
import { isOk } from "@/v2/core/domain/result";
import type { KbEntry } from "@/v2/core/domain/entities";
import type { Database } from "@/integrations/supabase/types";

export function useKbEntriesV2(searchQuery?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["v2", "kb-entries", searchQuery ?? ""],
    queryFn: async (): Promise<readonly KbEntry[]> => {
      const result = searchQuery
        ? await searchKbEntries(searchQuery)
        : await fetchKbEntries();
      return isOk(result) ? result.value : [];
    },
  });

  const createMut = useMutation({
    mutationFn: (input: Database["public"]["Tables"]["kb_entries"]["Insert"]) => createKbEntry(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["v2", "kb-entries"] }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Database["public"]["Tables"]["kb_entries"]["Update"] }) =>
      updateKbEntry(id, updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["v2", "kb-entries"] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteKbEntry(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["v2", "kb-entries"] }),
  });

  return {
    ...query,
    createEntry: createMut.mutate,
    updateEntry: updateMut.mutate,
    deleteEntry: deleteMut.mutate,
  };
}
