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
import { useBulkEmailAction } from "@/hooks/useEmailFolderActions";
import { upsertEmailAddressRule } from "@/data/emailAddressRules";

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
  bulkMarkRead: (messages: ChannelMessage[]) => Promise<void>;
  bulkArchive: (messages: ChannelMessage[]) => void;
  bulkDelete: (messages: ChannelMessage[]) => void;
  bulkAssignGroup: (messages: ChannelMessage[], groupName: string) => Promise<void>;
  bulkBusy: boolean;
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

  React.useEffect(() => {
    if (rawSelectedFolder !== selectedFolder) g.setFilter("funnemailFolder", selectedFolder);
  }, [g, rawSelectedFolder, selectedFolder]);

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

  React.useEffect(() => {
    if (filteredMails.length === 0) {
      if (selectedMessageId !== null) setSelectedMessageId(null);
      return;
    }
    const selectionStillExists = selectedMessageId ? filteredMails.some((m) => m.id === selectedMessageId) : false;
    if (!selectionStillExists) setSelectedMessageId(filteredMails[0].id);
  }, [filteredMails, selectedMessageId]);

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

  // ─── Bulk actions per gruppi della lista ──────────────────────────
  const bulk = useBulkEmailAction();

  const minimal = React.useCallback(
    (msgs: ChannelMessage[]) => msgs.map((m) => ({ id: m.id, imap_uid: m.imap_uid })),
    [],
  );

  const bulkMarkRead = React.useCallback(async (msgs: ChannelMessage[]) => {
    const ids = msgs.filter((m) => !m.read_at).map((m) => m.id);
    if (ids.length === 0) return;
    const { error } = await supabase
      .from("channel_messages")
      .update({ read_at: new Date().toISOString() })
      .in("id", ids);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${ids.length} email segnate come lette`);
    qc.invalidateQueries({ queryKey: ["funnemail-inbox"] });
    qc.invalidateQueries({ queryKey: queryKeys.channelMessages.root });
  }, [qc]);

  const bulkArchive = React.useCallback((msgs: ChannelMessage[]) => {
    if (msgs.length === 0) return;
    bulk.mutate(
      { messages: minimal(msgs), action: "archive" },
      { onSuccess: () => qc.invalidateQueries({ queryKey: ["funnemail-inbox"] }) },
    );
  }, [bulk, minimal, qc]);

  const bulkDelete = React.useCallback((msgs: ChannelMessage[]) => {
    if (msgs.length === 0) return;
    bulk.mutate(
      { messages: minimal(msgs), action: "delete" },
      { onSuccess: () => qc.invalidateQueries({ queryKey: ["funnemail-inbox"] }) },
    );
  }, [bulk, minimal, qc]);

  const bulkAssignGroup = React.useCallback(async (msgs: ChannelMessage[], groupName: string) => {
    if (!user?.id || msgs.length === 0) return;
    const addrs = new Set<string>();
    for (const m of msgs) {
      const raw = m.from_address ?? "";
      const match = raw.match(/<([^>]+)>/);
      const addr = (match ? match[1] : raw).trim().toLowerCase();
      if (addr) addrs.add(addr);
    }
    let ok = 0;
    for (const addr of addrs) {
      try {
        await upsertEmailAddressRule(user.id, addr, { group_name: groupName });
        ok++;
      } catch (e) {
        // continua sugli altri
      }
    }
    toast.success(`${ok} mittente${ok === 1 ? "" : "i"} assegnato/i a "${groupName}"`);
    qc.invalidateQueries({ queryKey: ["email-address-groups"] });
    qc.invalidateQueries({ queryKey: ["funnemail-inbox"] });
  }, [qc, user?.id]);

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
    bulkMarkRead,
    bulkArchive,
    bulkDelete,
    bulkAssignGroup,
    bulkBusy: bulk.isPending,
  };
}