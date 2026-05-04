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
import { useAuth } from "@/providers/AuthProvider";
import { queryKeys } from "@/lib/queryKeys";
import {
  listFunnemailGroupedInbox,
  overrideFunnemailFolder,
  type FunnemailGroupFolder,
  type FunnemailGroupedInbox,
} from "@/data/funnemailInbox";
import type { ChannelMessage } from "@/hooks/useChannelMessages";

export interface UseFunnemailInboxResult {
  folders: FunnemailGroupFolder[];
  foldersLoading: boolean;
  counts: Record<string, number>;
  selectedFolder: string;
  setSelectedFolder: (slug: string) => void;
  selectedFolderLabel: string;
  mails: ChannelMessage[];
  filteredMails: ChannelMessage[];
  mailsLoading: boolean;
  selectedMessageId: string | null;
  setSelectedMessageId: (id: string | null) => void;
  selectedMail: ChannelMessage | null;
  overrideFolder: (messageId: string, newSlug: string) => void;
  reclassify: (messageId: string) => void;
  reclassifying: boolean;
}

const PAGE_SIZE = 5000;

export function useFunnemailInbox(): UseFunnemailInboxResult {
  const qc = useQueryClient();
  const g = useGlobalFilters();
  const { user } = useAuth();
  const rawSelectedFolder = g.filters.funnemailFolder || "all";
  const setSelectedFolder = React.useCallback(
    (slug: string) => g.setFilter("funnemailFolder", slug),
    [g],
  );
  const [selectedMessageId, setSelectedMessageId] = React.useState<string | null>(null);

  const groupedQ = useQuery({
    queryKey: queryKeys.funnemailInbox.grouped(user?.id ?? "anon", PAGE_SIZE),
    queryFn: () => listFunnemailGroupedInbox(user!.id, PAGE_SIZE),
    enabled: !!user?.id,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const grouped = React.useMemo<FunnemailGroupedInbox>(
    () => groupedQ.data ?? { folders: [], counts: {}, messages: [] },
    [groupedQ.data],
  );
  const folders = React.useMemo<FunnemailGroupFolder[]>(() => grouped.folders, [grouped.folders]);
  const validFolderSlugs = React.useMemo(() => new Set(folders.map((f) => f.slug)), [folders]);
  const selectedFolder = rawSelectedFolder === "all" || validFolderSlugs.has(rawSelectedFolder) ? rawSelectedFolder : "all";
  const mails = React.useMemo<ChannelMessage[]>(() => grouped.messages, [grouped.messages]);

  // Reset selected mail quando cambio cartella
  React.useEffect(() => {
    setSelectedMessageId(null);
  }, [selectedFolder]);

  // Filtri client-side guidati dalla sidebar globale.
  const filteredMails = React.useMemo<ChannelMessage[]>(() => {
    const search = g.filters.funnemailSearch.trim().toLowerCase();
    const view = g.filters.funnemailView;
    return mails.filter((m) => {
      const groupedMail = m as ChannelMessage & { funnemail_group_slug?: string };
      if (selectedFolder !== "all" && groupedMail.funnemail_group_slug !== selectedFolder) return false;
      if (search) {
        const hay = `${m.subject ?? ""} ${m.from_address ?? ""}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      if (view === "unread" && m.read_at) return false;
      if (view === "urgent" || view === "agenda" || view === "commercial") return false;
      return true;
    });
  }, [mails, selectedFolder, g.filters.funnemailSearch, g.filters.funnemailView]);

  const selectedMail = React.useMemo<ChannelMessage | null>(
    () => filteredMails.find((m) => m.id === selectedMessageId) ?? null,
    [filteredMails, selectedMessageId],
  );

  const selectedFolderLabel = React.useMemo<string>(
    () => selectedFolder === "all" ? "Tutte le email" : folders.find((f) => f.slug === selectedFolder)?.label ?? selectedFolder,
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
    foldersLoading: groupedQ.isLoading,
    counts: grouped.counts,
    selectedFolder,
    setSelectedFolder,
    selectedFolderLabel,
    mails,
    filteredMails,
    mailsLoading: groupedQ.isLoading,
    selectedMessageId,
    setSelectedMessageId,
    selectedMail,
    overrideFolder,
    reclassify,
    reclassifying: reclassifyMutation.isPending,
  };
}