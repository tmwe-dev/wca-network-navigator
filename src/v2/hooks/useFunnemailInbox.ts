/**
 * useFunnemailInbox — stato e query del client Funnemail.
 *
 * Tutta la logica del client di posta vive qui. La pagina è solo presentazione.
 */
import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { useAuth } from "@/providers/AuthProvider";
import { useActiveOperator } from "@/contexts/ActiveOperatorContext";
import { queryKeys } from "@/lib/queryKeys";
import { invokeAi } from "@/lib/ai/invokeAi";
import {
  listFunnemailGroupedInbox,
  markFunnemailMessagesRead,
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
  reclassify: (message: ChannelMessage) => void;
  reclassifying: boolean;
  bulkMarkRead: (messages: ChannelMessage[]) => Promise<void>;
  bulkArchive: (messages: ChannelMessage[]) => void;
  bulkDelete: (messages: ChannelMessage[]) => void;
  bulkAssignGroup: (messages: ChannelMessage[], groupName: string) => Promise<void>;
  bulkBusy: boolean;
}

export function useFunnemailInbox(): UseFunnemailInboxResult {
  const qc = useQueryClient();
  const g = useGlobalFilters();
  const { user } = useAuth();
  const { activeOperator, viewingAll } = useActiveOperator();
  // Allinea Funnemail al switcher operatore (come InArrivoTab).
  // - viewingAll       => null (RLS decide la visibilità globale).
  // - operatore scelto => filtra channel_messages.user_id su di lui.
  // - fallback         => utente loggato.
  const targetUserId: string | null = viewingAll
    ? null
    : activeOperator?.user_id ?? user?.id ?? null;
  const folderOwnerUserId = targetUserId ?? user?.id ?? null;
  const rawSelectedFolder = g.filters.funnemailFolder || "all";
  const setSelectedFolder = React.useCallback(
    (slug: string) => g.setFilter("funnemailFolder", slug),
    [g],
  );
  const [selectedMessageId, setSelectedMessageId] = React.useState<string | null>(null);

  const groupedQ = useQuery({
    queryKey: queryKeys.funnemailInbox.grouped(folderOwnerUserId ?? "anon", targetUserId),
    queryFn: () => listFunnemailGroupedInbox(folderOwnerUserId!, targetUserId),
    enabled: !!folderOwnerUserId,
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

  // Auto mark-as-read per gruppi con policy `auto_mark_read` (es. Pubblicità/Newsletter).
  // Best-effort: no toast, no errori bloccanti; refetch silenzioso a successo.
  // Map<id, ts> con TTL per evitare rimarcatura inutile al rimount.
  const autoReadDoneRef = React.useRef<Map<string, number>>(new Map());
  const AUTO_READ_TTL_MS = 10 * 60 * 1000;
  React.useEffect(() => {
    if (!folders.length || !mails.length) return;
    const autoSlugs = new Set(folders.filter((f) => f.auto_mark_read).map((f) => f.slug));
    if (autoSlugs.size === 0) return;
    const now = Date.now();
    // Pulizia TTL
    for (const [id, ts] of autoReadDoneRef.current) {
      if (now - ts > AUTO_READ_TTL_MS) autoReadDoneRef.current.delete(id);
    }
    const toMark = mails.filter((m) => {
      if (m.read_at) return false;
      if (autoReadDoneRef.current.has(m.id)) return false;
      const slug = (m as ChannelMessage & { funnemail_group_slug?: string }).funnemail_group_slug;
      return slug ? autoSlugs.has(slug) : false;
    });
    if (toMark.length === 0) return;
    const ids = toMark.map((m) => m.id);
    ids.forEach((id) => autoReadDoneRef.current.set(id, now));
    void markFunnemailMessagesRead(ids).then(() => {
      qc.invalidateQueries({ queryKey: queryKeys.funnemailInbox.root });
    }).catch(() => { /* silent */ });
  }, [folders, mails, qc, user?.id]);

  // Filtri client-side guidati dalla sidebar globale.
  const filteredMails = React.useMemo<ChannelMessage[]>(() => {
    const search = g.filters.funnemailSearch.trim().toLowerCase();
    const view = g.filters.funnemailView;
    const base = mails.filter((m) => {
      const groupedMail = m as ChannelMessage & { funnemail_group_slug?: string };
      if (selectedFolder !== "all" && groupedMail.funnemail_group_slug !== selectedFolder) return false;
      if (search) {
        const hay = `${m.subject ?? ""} ${m.from_address ?? ""}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });
    if (view === "unread") return base.filter((m) => !m.read_at);
    if (view === "urgent" || view === "agenda" || view === "commercial") return base;
    return base;
  }, [mails, selectedFolder, g.filters.funnemailSearch, g.filters.funnemailView]);

  React.useEffect(() => {
    if (groupedQ.isLoading || mails.length === 0 || filteredMails.length > 0) return;
    const hasActiveFilter = selectedFolder !== "all" || g.filters.funnemailSearch.trim() || g.filters.funnemailView !== "all";
    if (!hasActiveFilter) return;
    g.batchUpdate({ funnemailFolder: "all", funnemailSearch: "", funnemailView: "all" });
    toast.message("Filtri resettati: nessun risultato con i filtri attivi");
  }, [filteredMails.length, g, groupedQ.isLoading, mails.length, selectedFolder]);

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
      qc.invalidateQueries({ queryKey: queryKeys.funnemailInbox.root });
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
    mutationFn: async (message: ChannelMessage) => invokeAi("funnemail-classify", {
      scope: "classify",
      context: { source: "useFunnemailInbox", route: "/v2/funnemail-inbox", mode: "reclassify" },
      body: {
        message_id: message.message_id_external ?? message.id,
        from_address: message.from_address ?? "",
        subject: message.subject ?? "",
        body_text: message.body_text ?? "",
        partner_id: message.partner_id,
        user_id: message.user_id,
        prior_classification: (message as ChannelMessage & { category?: string | null }).category ?? undefined,
        force: true,
      },
    }),
    onSuccess: () => {
      toast.success("Email riclassificata");
      qc.invalidateQueries({ queryKey: queryKeys.funnemailInbox.root });
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Errore riclassificazione");
    },
  });

  const reclassify = React.useCallback(
    (message: ChannelMessage) => reclassifyMutation.mutate(message),
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
    try {
      await markFunnemailMessagesRead(ids);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore aggiornamento email");
      return;
    }
    toast.success(`${ids.length} email segnate come lette`);
    qc.invalidateQueries({ queryKey: queryKeys.funnemailInbox.root });
    qc.invalidateQueries({ queryKey: queryKeys.channelMessages.root });
  }, [qc]);

  const bulkArchive = React.useCallback((msgs: ChannelMessage[]) => {
    if (msgs.length === 0) return;
    bulk.mutate(
      { messages: minimal(msgs), action: "archive" },
      { onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.funnemailInbox.root }) },
    );
  }, [bulk, minimal, qc]);

  const bulkDelete = React.useCallback((msgs: ChannelMessage[]) => {
    if (msgs.length === 0) return;
    bulk.mutate(
      { messages: minimal(msgs), action: "delete" },
      { onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.funnemailInbox.root }) },
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
      } catch {
        // continua sugli altri
      }
    }
    toast.success(`${ok} mittente${ok === 1 ? "" : "i"} assegnato/i a "${groupName}"`);
    qc.invalidateQueries({ queryKey: ["email-address-groups"] });
    qc.invalidateQueries({ queryKey: queryKeys.funnemailInbox.root });
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