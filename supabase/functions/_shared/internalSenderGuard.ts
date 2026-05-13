/**
 * internalSenderGuard.ts — Guardia "sender interno / self-partner".
 *
 * Quando un messaggio inbound proviene dallo stesso dominio del proprietario
 * (es. collega → collega all'interno di tmwe.it) oppure è agganciato a un
 * partner che corrisponde alla mailbox del proprietario, NON deve attivare
 * la pipeline post-classificazione (no activities, no pending action, no
 * reminder). Le mail restano comunque scaricate e leggibili in Funnemail.
 *
 * Ritorna un motivo per logging quando il guard scatta, oppure null.
 */

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

export type InternalGuardReason = "internal_sender" | "self_partner" | null;

function emailDomain(addr: string | null | undefined): string | null {
  if (!addr) return null;
  const at = addr.lastIndexOf("@");
  if (at < 0) return null;
  return addr.slice(at + 1).trim().toLowerCase() || null;
}

/**
 * Restituisce il set dei domini delle mailbox attive del proprietario.
 * Cache in-memory per processo (edge function vive pochi secondi, va bene).
 */
const domainCache = new Map<string, { at: number; domains: Set<string> }>();
const DOMAIN_TTL_MS = 60_000;

async function loadOwnerDomains(
  supabase: SupabaseClient,
  userId: string,
): Promise<Set<string>> {
  const cached = domainCache.get(userId);
  if (cached && Date.now() - cached.at < DOMAIN_TTL_MS) return cached.domains;

  const domains = new Set<string>();
  try {
    const { data } = await supabase
      .from("email_mailboxes")
      .select("email_address")
      .eq("user_id", userId);
    for (const row of (data ?? []) as Array<{ email_address: string | null }>) {
      const d = emailDomain(row.email_address);
      if (d) domains.add(d);
    }
  } catch (_e) { /* fail-open */ }

  domainCache.set(userId, { at: Date.now(), domains });
  return domains;
}

/**
 * Verifica se il sender è interno al dominio del proprietario, oppure se il
 * partner agganciato è la "self company" (mailbox del proprietario tra i
 * partner_contacts o nel partner.email).
 */
export async function checkInternalOrSelf(
  supabase: SupabaseClient,
  userId: string,
  senderEmail: string,
  partnerId?: string | null,
): Promise<InternalGuardReason> {
  const ownerDomains = await loadOwnerDomains(supabase, userId);
  const senderDomain = emailDomain(senderEmail);
  if (senderDomain && ownerDomains.has(senderDomain)) return "internal_sender";

  if (partnerId) {
    try {
      const { data: p } = await supabase
        .from("partners")
        .select("email")
        .eq("id", partnerId)
        .maybeSingle();
      const partnerDomain = emailDomain((p as { email?: string | null } | null)?.email ?? null);
      if (partnerDomain && ownerDomains.has(partnerDomain)) return "self_partner";

      const { data: contacts } = await supabase
        .from("partner_contacts")
        .select("email")
        .eq("partner_id", partnerId)
        .limit(20);
      for (const c of (contacts ?? []) as Array<{ email: string | null }>) {
        const d = emailDomain(c.email);
        if (d && ownerDomains.has(d)) return "self_partner";
      }
    } catch (_e) { /* fail-open */ }
  }

  return null;
}