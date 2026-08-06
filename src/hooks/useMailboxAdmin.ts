/**
 * useMailboxAdmin — passthrough di dominio verso il DAL mailboxes.
 * Isola i componenti dall'import diretto di @/data (regola layer).
 */
export {
  listSharedMailboxes,
  listOperatorMailboxAccess,
  setOperatorMailboxAccess,
  upsertSharedMailbox,
  deleteSharedMailbox,
} from "@/data/mailboxes";
export type { SharedMailbox, SharedMailboxUpsert, AccessibleMailbox } from "@/data/mailboxes";
