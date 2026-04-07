import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useDeleteCockpitContacts, type CockpitContact } from "@/hooks/useCockpitContacts";
import { toast } from "sonner";

interface UseBulkContactActionsOptions {
  contactsMap: Record<string, CockpitContact>;
  selection: {
    selectedIds: Set<string>;
    count: number;
    clear: () => void;
  };
  linkedInLookup: {
    lookupBatch: (ids: string[]) => Promise<void>;
  };
}

export function useBulkContactActions({ contactsMap, selection, linkedInLookup }: UseBulkContactActionsOptions) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const deleteContacts = useDeleteCockpitContacts();
  const queryClient = useQueryClient();

  const handleBulkDeepSearch = useCallback(
    () => toast.info(`Deep Search per ${selection.count} contatti`),
    [selection.count],
  );

  const handleBulkAlias = useCallback(
    () => toast.info(`Generazione Alias per ${selection.count} contatti`),
    [selection.count],
  );

  const handleBulkLinkedInLookup = useCallback(async () => {
    const ids = Array.from(selection.selectedIds);
    if (!ids.length) return;
    const sourceIds = ids
      .map(id => contactsMap[id])
      .filter(c => c && c.sourceType === "contact")
      .map(c => c!.sourceId);
    if (!sourceIds.length) {
      toast.info("Seleziona contatti importati per il LinkedIn Lookup");
      return;
    }
    await linkedInLookup.lookupBatch(sourceIds);
    queryClient.invalidateQueries({ queryKey: ["cockpit-queue"] });
  }, [selection.selectedIds, contactsMap, linkedInLookup, queryClient]);

  const handleSingleDeepSearch = useCallback(
    (id: string) => toast.info(`Deep Search per ${contactsMap[id]?.name || id}`),
    [contactsMap],
  );

  const handleSingleAlias = useCallback(
    (id: string) => toast.info(`Genera Alias per ${contactsMap[id]?.name || id}`),
    [contactsMap],
  );

  const handleSingleLinkedInLookup = useCallback((id: string) => {
    const contact = contactsMap[id];
    if (!contact) return;
    if (contact.sourceId) linkedInLookup.lookupBatch([contact.sourceId]);
  }, [contactsMap, linkedInLookup]);

  const handleBulkDelete = useCallback(() => setShowDeleteConfirm(true), []);

  const confirmBulkDelete = useCallback(async () => {
    const ids = Array.from(selection.selectedIds);
    try {
      await deleteContacts.mutateAsync(ids);
      selection.clear();
      toast.success(`${ids.length} record eliminati`);
    } catch {
      toast.error("Errore durante l'eliminazione");
    }
    setShowDeleteConfirm(false);
  }, [selection, deleteContacts]);

  return {
    handleBulkDeepSearch, handleBulkAlias, handleBulkLinkedInLookup,
    handleSingleDeepSearch, handleSingleAlias, handleSingleLinkedInLookup,
    handleBulkDelete, confirmBulkDelete,
    showDeleteConfirm, setShowDeleteConfirm,
  };
}
