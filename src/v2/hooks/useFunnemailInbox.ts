/**
 * useFunnemailInbox — stato e query del client Funnemail.
 *
 * Tutta la logica del client di posta vive qui. La pagina è solo presentazione.
 */
import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
  mailsLoading: boolean;
  selectedMessageId: string | null;
  setSelectedMessageId: (id: string | null) => void;
  selectedMail: FunnemailMailRow | null;
  overrideFolder: (messageId: string, newSlug: string) => void;
}

const DEFAULT_FOLDER = "rfq";
const PAGE_SIZE = 50;

export function useFunnemailInbox(): UseFunnemailInboxResult {
  const qc = useQueryClient();
  const [selectedFolder, setSelectedFolder] = React.useState<string>(DEFAULT_FOLDER);
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
  const selectedMail = React.useMemo<FunnemailMailRow | null>(
    () => mails.find((m) => m.message_id === selectedMessageId) ?? null,
    [mails, selectedMessageId],
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

  return {
    folders,
    foldersLoading: foldersQ.isLoading,
    counts: countsQ.data ?? {},
    selectedFolder,
    setSelectedFolder,
    selectedFolderLabel,
    mails,
    mailsLoading: mailsQ.isLoading,
    selectedMessageId,
    setSelectedMessageId,
    selectedMail,
    overrideFolder,
  };
}