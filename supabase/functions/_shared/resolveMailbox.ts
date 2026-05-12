/**
 * resolveMailbox — risolve le credenziali IMAP/SMTP per una mailbox.
 *
 * Strategia:
 *  - mailbox_id NULL/undefined  → casella personale dell'operatore (ENV legacy IMAP_*).
 *  - mailbox_id valorizzato     → cerca in shared_mailboxes, poi mappa lo slug
 *    a ENV secrets dedicati (es. booking → IMAP_PASSWORD_BOOKING / SMTP_PASSWORD_BOOKING).
 *
 * NON tocca check-inbox / email-imap-proxy / mark-imap-seen finché non viene
 * esplicitamente collegato. È un helper passivo.
 *
 * Mai loggare la password. Mai esporla nelle response.
 */

export interface ResolvedMailbox {
  mailbox_id: string | null;          // null = personale
  slug: string;                       // 'personal' | 'booking' | 'amministrazione' | ...
  email: string;
  imap_host: string;
  imap_port: number;
  imap_user: string;
  imap_password: string;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_password: string;
  reply_to: string | null;
}

/** Mappa slug della casella condivisa → nomi ENV per password IMAP/SMTP. */
const ENV_PASSWORD_MAP: Record<string, { imap: string; smtp: string }> = {
  booking: { imap: "IMAP_PASSWORD_BOOKING", smtp: "SMTP_PASSWORD_BOOKING" },
  // Aggiungere qui altri slug → secrets, es:
  // amministrazione: { imap: "IMAP_PASSWORD_ADMIN", smtp: "SMTP_PASSWORD_ADMIN" },
};

function envOrThrow(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`resolveMailbox: missing env ${name}`);
  return v;
}

/** Casella personale (env legacy: IMAP_HOST/IMAP_USER/IMAP_PASSWORD). */
export function resolvePersonalMailbox(): ResolvedMailbox {
  const imapHost = envOrThrow("IMAP_HOST");
  const imapUser = envOrThrow("IMAP_USER");
  const imapPassword = envOrThrow("IMAP_PASSWORD");
  const smtpHost = Deno.env.get("SMTP_HOST") ?? imapHost.replace(/^imap/i, "smtp");
  const smtpUser = Deno.env.get("SMTP_USER") ?? imapUser;
  const smtpPassword = Deno.env.get("SMTP_PASSWORD") ?? imapPassword;
  return {
    mailbox_id: null,
    slug: "personal",
    email: imapUser,
    imap_host: imapHost,
    imap_port: Number(Deno.env.get("IMAP_PORT") ?? 993),
    imap_user: imapUser,
    imap_password: imapPassword,
    smtp_host: smtpHost,
    smtp_port: Number(Deno.env.get("SMTP_PORT") ?? 465),
    smtp_user: smtpUser,
    smtp_password: smtpPassword,
    reply_to: null,
  };
}

interface SharedMailboxRow {
  id: string;
  slug: string;
  email: string;
  imap_host: string | null;
  imap_port: number | null;
  imap_user: string | null;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_user: string | null;
  reply_to: string | null;
  is_active: boolean;
}

interface SupabaseLike {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: unknown) => {
        is: (col: string, val: unknown) => {
          maybeSingle: () => Promise<{ data: SharedMailboxRow | null; error: unknown }>;
        };
      };
    };
  };
}

/**
 * Risolve una shared mailbox per id. Throwa se inattiva, non trovata, o senza
 * mapping ENV per la password.
 */
export async function resolveSharedMailbox(
  supabase: SupabaseLike,
  mailboxId: string,
): Promise<ResolvedMailbox> {
  const { data, error } = await supabase
    .from("shared_mailboxes")
    .select("id, slug, email, imap_host, imap_port, imap_user, smtp_host, smtp_port, smtp_user, reply_to, is_active")
    .eq("id", mailboxId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(`resolveSharedMailbox: ${(error as { message?: string }).message ?? "query failed"}`);
  if (!data) throw new Error(`resolveSharedMailbox: mailbox ${mailboxId} not found`);
  if (!data.is_active) throw new Error(`resolveSharedMailbox: mailbox ${data.slug} inactive`);

  const envMap = ENV_PASSWORD_MAP[data.slug];
  if (!envMap) throw new Error(`resolveSharedMailbox: no ENV password mapping for slug "${data.slug}"`);

  const imap_password = envOrThrow(envMap.imap);
  const smtp_password = envOrThrow(envMap.smtp);

  if (!data.imap_host || !data.imap_user || !data.smtp_host || !data.smtp_user) {
    throw new Error(`resolveSharedMailbox: incomplete config for slug "${data.slug}" (host/user missing)`);
  }

  return {
    mailbox_id: data.id,
    slug: data.slug,
    email: data.email,
    imap_host: data.imap_host,
    imap_port: data.imap_port ?? 993,
    imap_user: data.imap_user,
    imap_password,
    smtp_host: data.smtp_host,
    smtp_port: data.smtp_port ?? 465,
    smtp_user: data.smtp_user,
    smtp_password,
    reply_to: data.reply_to,
  };
}

/** Entry point unico: id null/undefined → personale; altrimenti shared. */
export async function resolveMailbox(
  supabase: SupabaseLike,
  mailboxId: string | null | undefined,
): Promise<ResolvedMailbox> {
  if (!mailboxId) return resolvePersonalMailbox();
  return await resolveSharedMailbox(supabase, mailboxId);
}