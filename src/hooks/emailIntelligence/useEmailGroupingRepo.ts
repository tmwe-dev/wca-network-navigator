/**
 * useEmailGroupingRepo — accesso tipizzato al DAL `emailGrouping` per la UI
 * Email Intelligence. Stesse firme, nessun cambio di semantica.
 */
import { useMemo } from "react";
import {
  fetchSenderGroupsOrdered,
  updateSenderGroupAutoAction,
  deleteSenderGroup,
  fetchOperatorIdForUser,
} from "@/data/emailGrouping";

const repo = {
  fetchSenderGroupsOrdered,
  updateSenderGroupAutoAction,
  deleteSenderGroup,
  fetchOperatorIdForUser,
} as const;

export type EmailGroupingRepo = typeof repo;

export function useEmailGroupingRepo(): EmailGroupingRepo {
  return useMemo(() => repo, []);
}
