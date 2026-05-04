/**
 * useFunnemailInbox — stato e query del client Funnemail.
 *
 * Tutta la logica del client di posta vive qui. La pagina è solo presentazione.
 */
import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { queryKeys } from "@/lib/queryKeys";
import {
  listFunnemailFolders,
  countFunnemailByFolder,
  listMailsByFolder,
  overrideFunnemailFolder,
  type FunnemailFolder,
  type FunnemailMailRow,
} from "@/data/funnemailInbox";

export interface UseFunnemailInboxResult {
  folders: FunnemailFolder[];
  foldersLoading: boolean;
  counts: Record<string, number>;
  selectedFolder: string;
  setSelectedFolder: (slug: string) => void;
  selectedFolderLabel: string;
  mails: FunnemailMailRow[];
  filteredMails: FunnemailMailRow[];
  mailsLoading: boolean;
  selectedMessageId: string | null;
  setSelectedMessageId: (id: string | null) => void;
  selectedMail: FunnemailMailRow | null;
  overrideFolder: (messageId: string, newSlug: string) => void;
  reclassify: (messageId: string) => void;
  reclassifying: boolean;
}

const PAGE_SIZE = 50;

export function useFunnemailInbox(): UseFunnemailInboxResult {
  const qc = useQueryClient();
  const g = useGlobalFilters();
  const selectedFolder = g.filters.funnemailFolder || "rfq";
  const setSelectedFolder = React.useCallback(
    (slug: string) => g.setFilter("funnemailFolder", slug),
    [g],
  );
  const [selectedMessageId, setSelectedMessageId] = React.useState<string | null>(null);

  const foldersQ = useQuery({
    queryKey: queryKeys.funnemailInbox.folders,
    queryFn: listFunnemailFolders,
    staleTime: 5 * 60_000,
  });

  const countsQ = useQuery({
    queryKey: queryKeys.funnemailInbox.counts,
    queryFn: countFunnemailByFolder,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const mailsQ = useQuery({
    queryKey: queryKeys.funnemailInbox.mailsByFolder(selectedFolder, PAGE_SIZE),
    queryFn: () => listMailsByFolder(selectedFolder, PAGE_SIZE),
    staleTime: 30_000,
  });

  // Reset selected mail quando cambio cartella
  React.useEffect(() => {
    setSelectedMessageId(null);
  }, [selectedFolder]);

  const folders = React.useMemo<FunnemailFolder[]>(() => foldersQ.data ?? [], [foldersQ.data]);
  const mails = React.useMemo<FunnemailMailRow[]>(() => mailsQ.data ?? [], [mailsQ.data]);

  // Filtri client-side guidati dalla sidebar globale.
  const filteredMails = React.useMemo<FunnemailMailRow[]>(() => {
    const search = g.filters.funnemailSearch.trim().toLowerCase();
    const view = g.filters.funnemailView;
    return mails.filter((m) => {
      if (search) {
        const hay = `${m.subject ?? ""} ${m.from_address ?? ""}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      const d = m.decision;
      if (view === "urgent" && !(d?.urgency === "critical" || d?.urgency === "high")) return false;
      if (view === "agenda" && !d?.goes_to_agenda) return false;
      if (view === "commercial" && !d?.commercial_handoff) return false;
      // "unread" non è ancora tracciato a livello decision; placeholder no-op.
      return true;
    });
  }, [mails, g.filters.funnemailSearch, g.filters.funnemailView]);

  const selectedMail = React.useMemo<FunnemailMailRow | null>(
    () => filteredMails.find((m) => m.message_id === selectedMessageId) ?? null,
    [filteredMails, selectedMessageId],
  );

  const selectedFolderLabel = React.useMemo<string>(
    () => folders.find((f) => f.slug === selectedFolder)?.label ?? selectedFolder,
    [folders, selectedFolder],
  );

  const overrideMutation = useMutation({
    mutationFn: ({ messageId, newSlug }: { messageId: string; newSlug: string }) =>
      overrideFunnemailFolder(messageId, newSlug),
    onSuccess: () => {
      toast.success("Cartella aggiornata");
      qc.invalidateQueries({ queryKey: ["funnemail-inbox"] });
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Errore aggiornamento");
    },
  });

  const overrideFolder = React.useCallback(
    (messageId: string, newSlug: string) => overrideMutation.mutate({ messageId, newSlug }),
    [overrideMutation],
  );

  const reclassifyMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const { data, error } = await supabase.functions.invoke("funnemail-classify", {
        body: { message_id: messageId, force: true },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Email riclassificata");
      qc.invalidateQueries({ queryKey: ["funnemail-inbox"] });
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Errore riclassificazione");
    },
  });

  const reclassify = React.useCallback(
    (messageId: string) => reclassifyMutation.mutate(messageId),
    [reclassifyMutation],
  );

  return {
    folders,
    foldersLoading: foldersQ.isLoading,
    counts: countsQ.data ?? {},
    selectedFolder,
    setSelectedFolder,
    selectedFolderLabel,
    mails,
    filteredMails,
    mailsLoading: mailsQ.isLoading,
    selectedMessageId,
    setSelectedMessageId,
    selectedMail,
    overrideFolder,
    reclassify,
    reclassifying: reclassifyMutation.isPending,
  };
}