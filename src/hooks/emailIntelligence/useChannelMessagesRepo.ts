/**
 * useChannelMessagesRepo — accesso tipizzato al DAL `channelMessages` per la UI
 * Email Intelligence. Stesse firme, nessun cambio di semantica.
 */
import { useMemo } from "react";
import {
  countChannelMessagesFromSender,
  fetchChannelMessageIdsFromSender,
  softDeleteChannelMessageById,
  archiveChannelMessageById,
  markChannelMessageIsReadFlag,
  moveChannelMessageToFolder,
  findChannelMessagesForExport,
  findSenderEmailsPage,
} from "@/data/channelMessages";

const repo = {
  countChannelMessagesFromSender,
  fetchChannelMessageIdsFromSender,
  softDeleteChannelMessageById,
  archiveChannelMessageById,
  markChannelMessageIsReadFlag,
  moveChannelMessageToFolder,
  findChannelMessagesForExport,
  findSenderEmailsPage,
} as const;

export type ChannelMessagesRepo = typeof repo;

export function useChannelMessagesRepo(): ChannelMessagesRepo {
  return useMemo(() => repo, []);
}