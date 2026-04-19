/**
 * dbOperations.ts — Sender matching and DB save operations.
 * Extracted from check-inbox/index.ts (lines 361-389, 1291-1404).
 * Hotfix 2026-04-19: hardened UUID guards on source_id + partner_id.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type SupabaseClient = ReturnType<typeof createClient>;

// ━━━ Sender matching (domain fallback) ━━━

export interface SenderMatch {
  source_type: string;
  source_id: string | null;
  partner_id: string | null;
  name: string;
}

export async function matchSender(supabase: SupabaseClient, email: string): Promise<SenderMatch> {
  if (!email || email === "@" || !email.includes("@"))
    return { source_type: "unknown", source_id: null, partner_id: null, name: email || "sconosciuto" };

  const emailLower = email.toLowerCase();
  const domain = emailLower.split("@")[1];

  const { data: partner } = await supabase.from("partners").select("id, company_name").ilike("email", emailLower).limit(1).maybeSingle();
  if (partner) return { source_type: "partner", source_id: partner.id, partner_id: partner.id, name: partner.company_name };
  const { data: pc } = await supabase.from("partner_contacts").select("id, partner_id, name").ilike("email", emailLower).limit(1).maybeSingle();
  if (pc) return { source_type: "partner_contact", source_id: pc.id, partner_id: pc.partner_id, name: pc.name };
  const { data: ic } = await supabase.from("imported_contacts").select("id, company_name, name").ilike("email", emailLower).limit(1).maybeSingle();
  if (ic) return { source_type: "imported_contact", source_id: ic.id, partner_id: null, name: ic.name || ic.company_name };
  const { data: prospect } = await supabase.from("prospects").select("id, company_name").ilike("email", emailLower).limit(1).maybeSingle();
  if (prospect) return { source_type: "prospect", source_id: prospect.id, partner_id: null, name: prospect.company_name };

  if (domain) {
    const domainPattern = `%@${domain}`;
    const { data: dp } = await supabase.from("partners").select("id, company_name").ilike("email", domainPattern).limit(1).maybeSingle();
    if (dp) return { source_type: "partner", source_id: dp.id, partner_id: dp.id, name: dp.company_name };
    const { data: dpc } = await supabase.from("partner_contacts").select("id, partner_id, name").ilike("email", domainPattern).limit(1).maybeSingle();
    if (dpc) return { source_type: "partner_contact", source_id: dpc.id, partner_id: dpc.partner_id, name: dpc.name };
  }
  return { source_type: "unknown", source_id: null, partner_id: null, name: email };
}

// ━━━ Attachment record shape ━━━

export interface AttachmentRecord {
  cid?: string;
  contentId?: string | null;
  publicUrl?: string;
  filename: string;
  storagePath: string;
  contentType: string;
  size: number;
  isInline: boolean;
  isDataUri?: boolean;
  skipped?: boolean;
}

// ━━━ Save message + attachments + escalation ━━━

export interface SaveMessageParams {
  userId: string;
  operatorId: string | null;
  uid: number;
  uidvalidity: number | null;
  messageId: string;
  threadId: string;
  fromAddr: string;
  toAddr: string;
  ccAddresses: string;
  bccAddresses: string;
  subject: string;
  date: string;
  bodyText: string;
  bodyHtml: string;
  imapFlags: string;
  internalDate: string | null;
  rawStoragePath: string;
  rawHash: string;
  rfc822Size: number;
  referencesHeader: string | null;
  inReplyTo: string | null;
  parseWarnings: string[];
  senderName: string;
  match: SenderMatch;
  attachmentRecords: AttachmentRecord[];
}

export interface SaveResult {
  savedId: string | null;
  msgData: Record<string, unknown> | null;
  error: string | null;
}

export async function saveMessageToDb(
  supabase: SupabaseClient,
  params: SaveMessageParams,
): Promise<SaveResult> {
  let emailDate: string | null = null;
  if (params.date) {
    try {
      const parsed = new Date(params.date);
      if (!isNaN(parsed.getTime())) emailDate = parsed.toISOString();
    } catch { /* date parse failed — use null */ }
  }

  const parseStatus = params.parseWarnings.length > 0 ? "warning" : "ok";

  // Guard: source_id e partner_id devono essere UUID validi o null (colonne di tipo uuid).
  // Se source_type è "unknown", forziamo source_id=null perché non c'è entità corrispondente.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const safeSourceId =
    params.match.source_type !== "unknown" &&
    params.match.source_id &&
    UUID_RE.test(String(params.match.source_id))
      ? params.match.source_id
      : null;
  const safePartnerId =
    params.match.partner_id && UUID_RE.test(String(params.match.partner_id))
      ? params.match.partner_id
      : null;

  const msgData: Record<string, unknown> = {
    user_id: params.userId,
    operator_id: params.operatorId,
    channel: "email",
    direction: "inbound",
    source_type: params.match.source_type,
    source_id: safeSourceId,
    partner_id: safePartnerId,
    from_address: params.fromAddr,
    to_address: params.toAddr,
    cc_addresses: params.ccAddresses || null,
    bcc_addresses: params.bccAddresses || null,
    subject: params.subject,
    body_text: params.bodyText,
    body_html: params.bodyHtml,
    message_id_external: params.messageId,
    in_reply_to: params.inReplyTo,
    references_header: params.referencesHeader || null,
    thread_id: params.threadId,
    email_date: emailDate,
    raw_payload: { uid: params.uid, date: params.date, sender_name: params.match.name || params.senderName },
    raw_storage_path: params.rawStoragePath || null,
    raw_sha256: params.rawHash || null,
    raw_size_bytes: params.rfc822Size || null,
    imap_uid: params.uid,
    uidvalidity: params.uidvalidity,
    imap_flags: params.imapFlags || null,
    internal_date: params.internalDate || emailDate,
    parse_status: parseStatus,
    parse_warnings: params.parseWarnings.length > 0 ? params.parseWarnings : null,
  };

  const { data: savedMsg, error: saveErr } = await supabase
    .from("channel_messages")
    .upsert([msgData], { onConflict: "user_id,message_id_external" })
    .select("id")
    .single();

  if (saveErr) {
    return { savedId: null, msgData: null, error: saveErr.message };
  }

  // Save attachments
  if (savedMsg?.id && params.attachmentRecords.length > 0) {
    const attRows = params.attachmentRecords
      .filter(a => !a.skipped)
      .map(a => ({
        message_id: savedMsg.id,
        user_id: params.userId,
        filename: a.filename,
        storage_path: a.storagePath || a.publicUrl || "",
        content_type: a.contentType,
        size_bytes: a.size,
        content_id: a.cid || a.contentId || null,
        is_inline: a.isInline || false,
      }));

    if (attRows.length > 0) {
      const { error: attSaveErr } = await supabase
        .from("email_attachments")
        .upsert(attRows, { onConflict: "message_id,filename" });
      if (attSaveErr) {
        console.warn(`[check-inbox] UID ${params.uid}: attachment DB error:`, attSaveErr.message);
      }
    }
  }

  // Checkpoint
  await supabase.from("email_sync_state")
    .update({ last_uid: params.uid, last_sync_at: new Date().toISOString() })
    .eq("user_id", params.userId);

  // Auto-escalation (tassonomia 9 stati: new → first_touch_sent al primo inbound match)
  if (params.match.source_type === "imported_contact" && params.match.source_id && UUID_RE.test(String(params.match.source_id))) {
    await supabase.rpc("increment_contact_interaction", { p_contact_id: params.match.source_id });
    await supabase.from("imported_contacts")
      .update({ lead_status: "first_touch_sent" })
      .eq("id", params.match.source_id)
      .eq("lead_status", "new");
  }
  if ((params.match.source_type === "partner" || params.match.source_type === "partner_contact") && params.match.partner_id && UUID_RE.test(String(params.match.partner_id))) {
    const { data: partnerData } = await supabase.from("partners")
      .select("interaction_count, lead_status")
      .eq("id", params.match.partner_id)
      .single();
    if (partnerData) {
      const updates: Record<string, unknown> = {
        interaction_count: ((partnerData.interaction_count as number) || 0) + 1,
        last_interaction_at: new Date().toISOString(),
      };
      if (partnerData.lead_status === "new") {
        updates.lead_status = "first_touch_sent";
      }
      await supabase.from("partners")
        .update(updates)
        .eq("id", params.match.partner_id);
    }
  }

  return { savedId: savedMsg.id, msgData: { ...msgData, id: savedMsg.id }, error: null };
}
