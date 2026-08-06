/**
 * useEmailClassificationsRepo — accesso tipizzato al DAL `emailClassifications`.
 * Stesse firme, nessun cambio di semantica.
 */
import { useMemo } from "react";
import { findConversationContextsOrdered } from "@/data/emailClassifications";

const repo = { findConversationContextsOrdered } as const;

export type EmailClassificationsRepo = typeof repo;

export function useEmailClassificationsRepo(): EmailClassificationsRepo {
  return useMemo(() => repo, []);
}
