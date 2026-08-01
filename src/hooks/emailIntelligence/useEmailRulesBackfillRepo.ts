/**
 * useEmailRulesBackfillRepo — accesso tipizzato al DAL `emailRulesBackfill`.
 * Stesse firme, nessun cambio di semantica.
 */
import { useMemo } from "react";
import { backfillForAddress, backfillForGroup } from "@/data/emailRulesBackfill";

export type { BackfillReport } from "@/data/emailRulesBackfill";

const repo = { backfillForAddress, backfillForGroup } as const;

export type EmailRulesBackfillRepo = typeof repo;

export function useEmailRulesBackfillRepo(): EmailRulesBackfillRepo {
  return useMemo(() => repo, []);
}