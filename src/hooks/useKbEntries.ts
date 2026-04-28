/**
 * useKbEntries — thin wrapper around DAL.
 * Seed data extracted to src/data/kbSeedData.ts
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  findKbEntries, upsertKbEntry, deleteKbEntry as dalDeleteKbEntry,
  countKbEntries, bulkInsertKbEntries, invalidateKbEntries,
  type KbEntry,
} from "@/data/kbEntries";
import { getDefaultKbEntries } from "@/data/kbSeedData";
import type { Database } from "@/integrations/supabase/types";
import { queryKeys } from "@/lib/queryKeys";

type KbInsert = Database["public"]["Tables"]["kb_entries"]["Insert"];

export type { KbEntry };

export function useKbEntries() {
  return useQuery({
    queryKey: queryKeys.v2.kbEntries(),
    queryFn: findKbEntries,
  });
}

export function useUpsertKbEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: Partial<KbEntry> & { title: string; content: string }) => {
      const { data: { session: __s } } = await supabase.auth.getSession(); const user = __s?.user ?? null;
      if (!user) throw new Error("Not authenticated");
      await upsertKbEntry(entry, user.id);
    },
    onSuccess: () => {
      invalidateKbEntries(qc);
      toast.success("Scheda KB salvata");
    },
    onError: (e: Error) => toast.error(e.message || "Errore salvataggio KB"),
  });
}

export function useDeleteKbEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: dalDeleteKbEntry,
    onSuccess: () => {
      invalidateKbEntries(qc);
      toast.success("Scheda eliminata");
    },
    onError: (e: Error) => toast.error(e.message || "Errore eliminazione"),
  });
}

export function useSeedKbFromLegacy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data: { session: __s } } = await supabase.auth.getSession(); const user = __s?.user ?? null;
      if (!user) throw new Error("Not authenticated");

      const count = await countKbEntries();
      if (count > 0) throw new Error("KB già popolata. Elimina le schede esistenti prima di re-importare.");

      const entries = getDefaultKbEntries(user.id);
      return bulkInsertKbEntries(entries as KbInsert[]);
    },
    onSuccess: (count) => {
      invalidateKbEntries(qc);
      toast.success(`${count} schede KB importate con successo`);
    },
    onError: (e: Error) => toast.error(e.message || "Errore importazione"),
  });
}
