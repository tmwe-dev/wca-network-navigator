/**
 * DAL — backfill IMAP per regole email_address_rules.
 *
 * Applica auto_action a messaggi STORICI già presenti sul server di posta.
 * Operazione MANUALE (lanciata da UI), sequenziale per address.
 */
import { invokeEdge } from "@/lib/api/invokeEdge";

export interface BackfillAddressReport {
  address: string;
  matched: number;
  applied: number;
  error?: string;
}

export interface BackfillReport {
  addresses_processed: number;
  messages_matched: number;
  messages_applied: number;
  errors: Array<{ address: string; error: string }>;
  reports: BackfillAddressReport[];
  truncated: boolean;
  dry_run: boolean;
}

export async function backfillForAddress(
  userId: string,
  address: string,
  dryRun = false,
  operatorId?: string,
): Promise<BackfillReport> {
  return invokeEdge<BackfillReport>("backfill-email-rules", {
    body: { user_id: userId, operator_id: operatorId, scope: "address", target: address, dry_run: dryRun },
    context: "backfillForAddress",
  });
}

export async function backfillForGroup(
  userId: string,
  groupName: string,
  dryRun = false,
  operatorId?: string,
): Promise<BackfillReport> {
  return invokeEdge<BackfillReport>("backfill-email-rules", {
    body: { user_id: userId, operator_id: operatorId, scope: "group", target: groupName, dry_run: dryRun },
    context: "backfillForGroup",
  });
}