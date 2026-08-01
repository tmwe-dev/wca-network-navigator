/**
 * mailboxAccessGuard.ts — Server-side guard per shared mailbox.
 *
 * Audit P0.3 (2026-05-13): send-email accettava `x-mailbox-id` arbitrario
 * senza verificare che l'utente fosse autorizzato (operator_mailbox_access).
 * Bypass RBAC: chiunque autenticato poteva inviare da qualsiasi casella.
 *
 * Questo helper deve essere chiamato PRIMA di `resolveSharedMailbox`.
 * Usa il client autenticato col JWT dell'utente (RLS attiva) — gli admin
 * passano via `is_operator_admin()`, gli operatori normali via la policy
 * `oma_select_own_or_admin` su `operator_mailbox_access`.
 */

interface AuthClientLike {
  rpc: (
    name: string,
    params?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: unknown }>;
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: unknown) => {
        limit: (n: number) => {
          maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
        };
      };
    };
  };
}

export class MailboxAccessDenied extends Error {
  constructor(mailboxId: string) {
    super(`Mailbox access denied for ${mailboxId}`);
    this.name = "MailboxAccessDenied";
  }
}

/**
 * Lancia `MailboxAccessDenied` se l'utente (identificato dal JWT in
 * `authClient`) non ha accesso alla shared mailbox.
 *
 * - Admin (`is_operator_admin()` = true) → sempre OK.
 * - Altrimenti: deve esistere una riga in `operator_mailbox_access`
 *   visibile via RLS (`oma_select_own_or_admin`) per quel mailbox.
 */
export async function assertMailboxAccessible(
  authClient: AuthClientLike,
  mailboxId: string,
): Promise<void> {
  // 1) Admin shortcut — RPC security-definer, RLS-safe.
  const adminRes = await authClient.rpc("is_operator_admin");
  if (!adminRes.error && adminRes.data === true) return;

  // 2) Operatore normale: verifica visibilità riga via RLS.
  const { data, error } = await authClient
    .from("operator_mailbox_access")
    .select("id")
    .eq("shared_mailbox_id", mailboxId)
    .limit(1)
    .maybeSingle();

  if (error) {
    // In caso di errore RLS/query, deny by default.
    throw new MailboxAccessDenied(mailboxId);
  }
  if (!data) throw new MailboxAccessDenied(mailboxId);
}