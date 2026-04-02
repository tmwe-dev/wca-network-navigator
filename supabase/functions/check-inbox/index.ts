import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ImapFlow } from "npm:imapflow@1.0.164";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function parseEmailAddress(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  return match ? match[1].toLowerCase() : raw.trim().toLowerCase();
}

async function matchSender(supabase: any, email: string) {
  const emailLower = email.toLowerCase();

  const { data: partner } = await supabase
    .from("partners").select("id, company_name")
    .ilike("email", emailLower).limit(1).maybeSingle();
  if (partner) return { source_type: "partner", source_id: partner.id, partner_id: partner.id, name: partner.company_name };

  const { data: pc } = await supabase
    .from("partner_contacts").select("id, partner_id, name")
    .ilike("email", emailLower).limit(1).maybeSingle();
  if (pc) return { source_type: "partner_contact", source_id: pc.id, partner_id: pc.partner_id, name: pc.name };

  const { data: ic } = await supabase
    .from("imported_contacts").select("id, company_name, name")
    .ilike("email", emailLower).limit(1).maybeSingle();
  if (ic) return { source_type: "imported_contact", source_id: ic.id, partner_id: null, name: ic.name || ic.company_name };

  const { data: prospect } = await supabase
    .from("prospects").select("id, company_name")
    .ilike("email", emailLower).limit(1).maybeSingle();
  if (prospect) return { source_type: "prospect", source_id: prospect.id, partner_id: null, name: prospect.company_name };

  return { source_type: "unknown", source_id: null, partner_id: null, name: email };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const imapHost = Deno.env.get("IMAP_HOST") || "imaps.aruba.it";
    const imapUser = Deno.env.get("IMAP_USER");
    const imapPass = Deno.env.get("IMAP_PASSWORD");

    if (!imapUser || !imapPass) {
      return new Response(JSON.stringify({ error: "Credenziali IMAP non configurate" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sync state
    let { data: syncState } = await supabase
      .from("email_sync_state").select("*")
      .eq("user_id", userId).maybeSingle();

    if (!syncState) {
      const { data: newState } = await supabase
        .from("email_sync_state")
        .insert({ user_id: userId, imap_host: imapHost, imap_user: imapUser, last_uid: 0 })
        .select().single();
      syncState = newState;
    }

    const lastUid = syncState?.last_uid || 0;

    // Connect via ImapFlow (handles TLS properly, accepts all valid certs)
    console.log(`[check-inbox] Connecting to ${imapHost}:993 via ImapFlow...`);
    const client = new ImapFlow({
      host: imapHost,
      port: 993,
      secure: true,
      auth: { user: imapUser, pass: imapPass },
      tls: { rejectUnauthorized: false },
      logger: false,
    });

    await client.connect();
    console.log("[check-inbox] Connected and logged in");

    try {
      const lock = await client.getMailboxLock("INBOX");
      try {
        // Search for new messages
        const searchQuery = lastUid > 0 ? { uid: `${lastUid + 1}:*` } : "1:*";
        const uids: number[] = [];

        try {
          for await (const msg of client.fetch(searchQuery, { uid: true })) {
            if (msg.uid > lastUid) uids.push(msg.uid);
          }
        } catch (_) {
          // No messages found
        }

        console.log(`[check-inbox] Found ${uids.length} new messages (UIDs > ${lastUid})`);

        const toFetch = uids.sort((a, b) => a - b).slice(0, 50);
        const messages: any[] = [];
        let maxUid = lastUid;

        for (const uid of toFetch) {
          try {
            const msg = await client.fetchOne(`${uid}`, {
              uid: true,
              envelope: true,
              source: true,
            }, { uid: true });

            const envelope = msg.envelope;
            const fromEmail = envelope?.from?.[0]?.address?.toLowerCase() || "";
            const toEmail = envelope?.to?.[0]?.address?.toLowerCase() || "";
            const subject = envelope?.subject || "(nessun oggetto)";
            const messageId = envelope?.messageId || `uid_${uid}_${Date.now()}`;
            const inReplyTo = envelope?.inReplyTo || null;
            const date = envelope?.date?.toISOString() || "";

            // Extract body text from source
            let bodyText = "";
            if (msg.source) {
              const sourceStr = msg.source.toString();
              // Simple body extraction: split on double newline (header/body separator)
              const bodyStart = sourceStr.indexOf("\r\n\r\n");
              if (bodyStart > -1) {
                bodyText = sourceStr.slice(bodyStart + 4).trim().slice(0, 50000);
              }
            }

            const match = await matchSender(supabase, fromEmail);

            messages.push({
              user_id: userId,
              channel: "email",
              direction: "inbound",
              source_type: match.source_type,
              source_id: match.source_id,
              partner_id: match.partner_id,
              from_address: fromEmail,
              to_address: toEmail,
              subject,
              body_text: bodyText,
              message_id_external: messageId,
              in_reply_to: inReplyTo,
              raw_payload: { uid, date, sender_name: match.name, from: envelope?.from, to: envelope?.to },
            });
            if (uid > maxUid) maxUid = uid;
          } catch (fetchErr) {
            console.error(`[check-inbox] Error fetching UID ${uid}:`, fetchErr.message);
          }
        }

        // Save messages
        if (messages.length > 0) {
          const { error: upsertError } = await supabase
            .from("channel_messages")
            .upsert(messages, { onConflict: "message_id_external" });

          if (upsertError) {
            console.error("[check-inbox] Upsert error:", upsertError);
            throw new Error("Errore salvataggio messaggi: " + upsertError.message);
          }

          await supabase.from("email_sync_state")
            .update({ last_uid: maxUid, last_sync_at: new Date().toISOString() })
            .eq("user_id", userId);

          for (const msg of messages) {
            if (msg.source_type === "imported_contact" && msg.source_id) {
              await supabase.rpc("increment_contact_interaction", { p_contact_id: msg.source_id });
            }
          }
        }

        lock.release();

        const matched = messages.filter(m => m.source_type !== "unknown").length;
        return new Response(JSON.stringify({
          success: true,
          total: messages.length,
          matched,
          unmatched: messages.length - matched,
          last_uid: maxUid,
          messages: messages.map(m => ({
            from: m.from_address, subject: m.subject,
            source_type: m.source_type, sender_name: m.raw_payload?.sender_name,
            date: m.raw_payload?.date,
          })),
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

      } catch (err) {
        lock.release();
        throw err;
      }
    } finally {
      await client.logout().catch(() => {});
    }

  } catch (err) {
    console.error("[check-inbox] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
