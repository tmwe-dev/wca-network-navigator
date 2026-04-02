import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/* ── Minimal IMAP over TLS (Node compat for untrusted certs) ── */
async function imapConnect(host: string, port: number) {
  const tls = await import("node:tls");

  const conn = await new Promise<import("node:tls").TLSSocket>((resolve, reject) => {
    const sock = tls.connect({ host, port, rejectUnauthorized: false }, () => resolve(sock));
    sock.once("error", reject);
  });

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let tag = 0;

  function readUntilComplete(): Promise<string> {
    return new Promise((resolve, reject) => {
      let result = "";
      const timeout = setTimeout(() => resolve(result), 10000);
      const onData = (chunk: Buffer) => {
        result += decoder.decode(chunk);
        if (/^A\d+ (OK|NO|BAD)/m.test(result) || (result.startsWith("* OK") && tag === 0)) {
          clearTimeout(timeout);
          conn.removeListener("data", onData);
          resolve(result);
        }
      };
      conn.on("data", onData);
      conn.once("error", (err: Error) => { clearTimeout(timeout); reject(err); });
    });
  }

  async function command(cmd: string): Promise<string> {
    tag++;
    const tagStr = `A${tag}`;
    const line = `${tagStr} ${cmd}\r\n`;
    conn.write(encoder.encode(line));
    return await readUntilComplete();
  }

  // Read greeting
  const greeting = await readUntilComplete();
  if (!greeting.includes("OK")) throw new Error("IMAP greeting failed: " + greeting.slice(0, 200));

  return { command, close: () => conn.destroy(), greeting };
}

function parseEmailAddress(raw: string): string {
  // Extract email from "Name <email>" or plain "email"
  const match = raw.match(/<([^>]+)>/);
  return match ? match[1].toLowerCase() : raw.trim().toLowerCase();
}

function parseHeaders(raw: string): Record<string, string> {
  const headers: Record<string, string> = {};
  const lines = raw.split(/\r?\n/);
  let currentKey = "";
  for (const line of lines) {
    if (/^\s/.test(line) && currentKey) {
      headers[currentKey] += " " + line.trim();
    } else {
      const idx = line.indexOf(":");
      if (idx > 0) {
        currentKey = line.slice(0, idx).toLowerCase().trim();
        headers[currentKey] = line.slice(idx + 1).trim();
      }
    }
  }
  return headers;
}

async function matchSender(supabase: any, email: string) {
  const emailLower = email.toLowerCase();

  // Check partners
  const { data: partner } = await supabase
    .from("partners")
    .select("id, company_name")
    .ilike("email", emailLower)
    .limit(1)
    .maybeSingle();
  if (partner) return { source_type: "partner", source_id: partner.id, partner_id: partner.id, name: partner.company_name };

  // Check partner_contacts
  const { data: pc } = await supabase
    .from("partner_contacts")
    .select("id, partner_id, name")
    .ilike("email", emailLower)
    .limit(1)
    .maybeSingle();
  if (pc) return { source_type: "partner_contact", source_id: pc.id, partner_id: pc.partner_id, name: pc.name };

  // Check imported_contacts
  const { data: ic } = await supabase
    .from("imported_contacts")
    .select("id, company_name, name")
    .ilike("email", emailLower)
    .limit(1)
    .maybeSingle();
  if (ic) return { source_type: "imported_contact", source_id: ic.id, partner_id: null, name: ic.name || ic.company_name };

  // Check prospects
  const { data: prospect } = await supabase
    .from("prospects")
    .select("id, company_name")
    .ilike("email", emailLower)
    .limit(1)
    .maybeSingle();
  if (prospect) return { source_type: "prospect", source_id: prospect.id, partner_id: null, name: prospect.company_name };

  return { source_type: "unknown", source_id: null, partner_id: null, name: email };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth ──
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

    // ── Get IMAP credentials ──
    const imapHost = Deno.env.get("IMAP_HOST") || "imaps.aruba.it";
    const imapUser = Deno.env.get("IMAP_USER");
    const imapPass = Deno.env.get("IMAP_PASSWORD");

    if (!imapUser || !imapPass) {
      return new Response(JSON.stringify({ error: "Credenziali IMAP non configurate" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Get last UID ──
    let { data: syncState } = await supabase
      .from("email_sync_state")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (!syncState) {
      const { data: newState } = await supabase
        .from("email_sync_state")
        .insert({ user_id: userId, imap_host: imapHost, imap_user: imapUser, last_uid: 0 })
        .select()
        .single();
      syncState = newState;
    }

    const lastUid = syncState?.last_uid || 0;

    // ── Connect IMAP ──
    console.log(`[check-inbox] Connecting to ${imapHost}:993...`);
    const imap = await imapConnect(imapHost, 993);

    try {
      // Login
      const loginRes = await imap.command(`LOGIN "${imapUser}" "${imapPass}"`);
      if (loginRes.includes("NO") || loginRes.includes("BAD")) {
        throw new Error("IMAP login failed: " + loginRes.slice(0, 200));
      }
      console.log("[check-inbox] Login OK");

      // Select INBOX
      const selectRes = await imap.command("SELECT INBOX");
      console.log("[check-inbox] INBOX selected");

      // Search for messages with UID > lastUid
      const searchCmd = lastUid > 0 ? `UID SEARCH UID ${lastUid + 1}:*` : "UID SEARCH ALL";
      const searchRes = await imap.command(searchCmd);

      // Parse UIDs from "* SEARCH uid1 uid2 uid3"
      const searchLine = searchRes.split("\r\n").find(l => l.startsWith("* SEARCH"));
      const uids: number[] = [];
      if (searchLine) {
        const parts = searchLine.replace("* SEARCH", "").trim().split(/\s+/);
        for (const p of parts) {
          const n = parseInt(p, 10);
          if (!isNaN(n) && n > lastUid) uids.push(n);
        }
      }

      console.log(`[check-inbox] Found ${uids.length} new messages (UIDs > ${lastUid})`);

      // Limit to 50 messages per sync
      const toFetch = uids.sort((a, b) => a - b).slice(0, 50);
      const messages: any[] = [];
      let maxUid = lastUid;

      for (const uid of toFetch) {
        try {
          // Fetch headers + body
          const fetchRes = await imap.command(`UID FETCH ${uid} (BODY[HEADER] BODY[TEXT])`);

          // Split header/body
          const headerMatch = fetchRes.match(/BODY\[HEADER\]\s*\{(\d+)\}\r\n([\s\S]*?)(?=\s*BODY\[TEXT\])/);
          const bodyMatch = fetchRes.match(/BODY\[TEXT\]\s*\{(\d+)\}\r\n([\s\S]*?)(?=\s*\)|\s*A\d+)/);

          const headerRaw = headerMatch ? headerMatch[2] : "";
          const bodyRaw = bodyMatch ? bodyMatch[2] : "";
          const headers = parseHeaders(headerRaw);

          const fromEmail = parseEmailAddress(headers["from"] || "");
          const toEmail = parseEmailAddress(headers["to"] || "");
          const subject = headers["subject"] || "(nessun oggetto)";
          const messageId = headers["message-id"] || "";
          const inReplyTo = headers["in-reply-to"] || "";
          const date = headers["date"] || "";

          // Match sender
          const match = await matchSender(supabase, fromEmail);

          const msg = {
            user_id: userId,
            channel: "email",
            direction: "inbound",
            source_type: match.source_type,
            source_id: match.source_id,
            partner_id: match.partner_id,
            from_address: fromEmail,
            to_address: toEmail,
            subject,
            body_text: bodyRaw.trim().slice(0, 50000),
            message_id_external: messageId,
            in_reply_to: inReplyTo || null,
            raw_payload: { uid, headers, date, sender_name: match.name },
          };

          messages.push(msg);
          if (uid > maxUid) maxUid = uid;
        } catch (fetchErr) {
          console.error(`[check-inbox] Error fetching UID ${uid}:`, fetchErr.message);
        }
      }

      // Logout
      await imap.command("LOGOUT").catch(() => {});
      imap.close();

      // ── Save messages ──
      if (messages.length > 0) {
        const { error: insertErr } = await supabase
          .from("channel_messages")
          .insert(messages);
        if (insertErr) {
          console.error("[check-inbox] Insert error:", insertErr);
          throw new Error("Errore nel salvataggio dei messaggi: " + insertErr.message);
        }

        // Update last_uid
        await supabase
          .from("email_sync_state")
          .update({ last_uid: maxUid, last_sync_at: new Date().toISOString() })
          .eq("user_id", userId);

        // Update interaction counts for matched contacts
        for (const msg of messages) {
          if (msg.partner_id) {
            await supabase
              .from("partners")
              .update({
                last_interaction_at: new Date().toISOString(),
                interaction_count: supabase.rpc ? undefined : undefined,
              })
              .eq("id", msg.partner_id);
          }
        }
      }

      const matched = messages.filter(m => m.source_type !== "unknown").length;
      const unmatched = messages.length - matched;

      return new Response(JSON.stringify({
        success: true,
        total: messages.length,
        matched,
        unmatched,
        last_uid: maxUid,
        messages: messages.map(m => ({
          from: m.from_address,
          subject: m.subject,
          source_type: m.source_type,
          sender_name: m.raw_payload?.sender_name,
          date: m.raw_payload?.date,
        })),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } catch (imapErr) {
      try { imap.close(); } catch (_) {}
      throw imapErr;
    }

  } catch (err) {
    console.error("[check-inbox] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
