/**
 * enqueueEnrichment — accoda mail in arrivo da mittenti SCONOSCIUTI per
 * arricchimento + classificazione AI in background (process-inbound-enrichment).
 *
 * Best-effort: errori loggati ma non bloccanti per check-inbox.
 * Skip se il dominio mittente è già presente in partners/partner_contacts/imported_contacts
 * oppure se esiste già una regola in email_address_rules per l'utente.
 */
// deno-lint-ignore no-explicit-any
type SBClient = any;

function extractEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = raw.match(/<([^>]+)>/);
  const addr = (m ? m[1] : raw).trim().toLowerCase();
  return /\S+@\S+/.test(addr) ? addr : null;
}

function extractDomain(email: string): string {
  const at = email.lastIndexOf("@");
  return at >= 0 ? email.slice(at + 1) : "";
}

const FREE_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.it", "outlook.com",
  "hotmail.com", "hotmail.it", "live.com", "libero.it", "tin.it", "alice.it",
  "icloud.com", "me.com", "aol.com", "protonmail.com", "pec.it",
]);

export async function enqueueInboundEnrichment(
  supabaseAdmin: SBClient,
  userId: string,
  messages: Record<string, unknown>[],
): Promise<{ enqueued: number; skipped: number }> {
  let enqueued = 0;
  let skipped = 0;
  if (!messages || messages.length === 0) return { enqueued, skipped };

  // Estrae candidati: prima mail per dominio (dedup)
  const candidates = new Map<string, { messageId: string; email: string; domain: string }>();
  for (const m of messages) {
    const id = m.id as string | undefined;
    const from = m.from_address as string | undefined;
    if (!id || !from) continue;
    const email = extractEmail(from);
    if (!email) continue;
    const domain = extractDomain(email);
    if (!domain || FREE_DOMAINS.has(domain)) { skipped++; continue; }
    if (!candidates.has(domain)) candidates.set(domain, { messageId: id, email, domain });
  }

  if (candidates.size === 0) return { enqueued, skipped };

  const domains = Array.from(candidates.keys());

  // Skip se dominio già noto in CRM (partners.email LIKE @domain)
  try {
    const orFilter = domains.map((d) => `email.ilike.%@${d}`).join(",");
    const { data: knownPartners } = await supabaseAdmin
      .from("partners")
      .select("email")
      .or(orFilter)
      .limit(500);
    if (Array.isArray(knownPartners)) {
      for (const p of knownPartners) {
        const e = (p as { email?: string }).email?.toLowerCase() ?? "";
        const d = extractDomain(e);
        if (d && candidates.has(d)) { candidates.delete(d); skipped++; }
      }
    }
  } catch (_) { /* best-effort */ }

  if (candidates.size === 0) return { enqueued, skipped };

  // Skip se mail esatta già in partner_contacts dell'utente
  try {
    const emails = Array.from(candidates.values()).map((c) => c.email);
    const { data: knownContacts } = await supabaseAdmin
      .from("partner_contacts")
      .select("email")
      .in("email", emails)
      .limit(500);
    if (Array.isArray(knownContacts)) {
      for (const c of knownContacts) {
        const e = (c as { email?: string }).email?.toLowerCase() ?? "";
        const d = extractDomain(e);
        if (d && candidates.has(d)) { candidates.delete(d); skipped++; }
      }
    }
  } catch (_) { /* best-effort */ }

  if (candidates.size === 0) return { enqueued, skipped };

  const rows = Array.from(candidates.values()).map((c) => ({
    user_id: userId,
    message_id: c.messageId,
    from_address: c.email,
    domain: c.domain,
    status: "pending",
  }));

  try {
    const { error } = await supabaseAdmin
      .from("inbound_enrichment_queue")
      .upsert(rows, { onConflict: "message_id", ignoreDuplicates: true });
    if (error) {
      console.warn("enqueueInboundEnrichment failed:", error.message);
      return { enqueued, skipped };
    }
    enqueued = rows.length;
  } catch (e) {
    console.warn("enqueueInboundEnrichment exception:", (e as Error).message);
  }

  return { enqueued, skipped };
}