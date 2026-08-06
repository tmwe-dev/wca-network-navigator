/**
 * useSenderManagementRepo — accesso tipizzato al DAL `senderManagement`.
 * Stesse firme, nessun cambio di semantica.
 */
import { useMemo } from "react";
import { createSenderGroup } from "@/data/senderManagement";

const repo = { createSenderGroup } as const;

export type SenderManagementRepo = typeof repo;

export function useSenderManagementRepo(): SenderManagementRepo {
  return useMemo(() => repo, []);
}
