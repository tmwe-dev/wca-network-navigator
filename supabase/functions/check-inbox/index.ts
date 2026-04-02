import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/* ── Actalis CA certs for imaps.aruba.it ── */
const ACTALIS_INTERMEDIATE_CA = `-----BEGIN CERTIFICATE-----
MIIHdTCCBV2gAwIBAgIQXDs/N638KP4Pz9Or+D+FUTANBgkqhkiG9w0BAQsFADBr
MQswCQYDVQQGEwJJVDEOMAwGA1UEBwwFTWlsYW4xIzAhBgNVBAoMGkFjdGFsaXMg
Uy5wLkEuLzAzMzU4NTIwOTY3MScwJQYDVQQDDB5BY3RhbGlzIEF1dGhlbnRpY2F0
aW9uIFJvb3QgQ0EwHhcNMjAwNzA2MDcyMDU1WhcNMzAwOTIyMTEyMjAyWjCBiTEL
MAkGA1UEBhMCSVQxEDAOBgNVBAgMB0JlcmdhbW8xGTAXBgNVBAcMEFBvbnRlIFNh
biBQaWV0cm8xFzAVBgNVBAoMDkFjdGFsaXMgUy5wLkEuMTQwMgYDVQQDDCtBY3Rh
bGlzIE9yZ2FuaXphdGlvbiBWYWxpZGF0ZWQgU2VydmVyIENBIEczMIICIjANBgkq
hkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAs73Ch+t2owm3ayTkyqy0OPuCTiybxTyS
4cU4y0t2RGSwCNjLh/rcutO0yoriZxVtPrNMcIRQ544BQhHFt/ypW7e+t8wWKrHa
r3BkKwSUbqNwpDWP1bXs7IJTVhHXWGAm7Ak1FhrrBmtXk8QtdzTzDDuxfFBK7sCL
N0Jdqoqb1V1z3wsWqAvr4KlSCFW05Nh4baWm/kXOmb8U+XR6kUmuoVvia3iBhotR
TzAHTO9SWWkgjTcir/nhBvyL2RoqkgYyP/k50bznaVOGFnFWzfl0XnrM/salfCBh
O0/1vNaoU8elR6AtbdCFAupgQy95GuFIRVS8n/cF0QupfPjUl+kGSLzvGAc+6oNE
alpAhKIS/+P0uODzRrS9Eq0WX1iSj6KHtQMNN4ZKsS4nsuvYCahnAc0QwQyoduAW
iU/ynhU9WTIEe1VIoEDE79NPOI2/80RqbZqdpAKUaf0FvuqVXhEcjiJJu+d0w9YN
b7gurd6xkaSXemW/fP4idBiNkd8aCVAdshGQYn6yh+na0Lu5IG88Z2kSIFcXDtwy
zjcxkW86pwkO6GekEomVBNKcv0Cey2Smf8uhpZk15TSCeyFDrZBWH9OsDst/Tnhz
pN156Huw3M3RRdEegt33fcyPykgt0HThxrEv9DwOzhs6lCQ5RNQJO7ZvZF1ZiqgT
FOJ6vs1xMqECAwEAAaOCAfQwggHwMA8GA1UdEwEB/wQFMAMBAf8wHwYDVR0jBBgw
FoAUUtiIOsifeGbtifN7OHCUyQICNtAwQQYIKwYBBQUHAQEENTAzMDEGCCsGAQUF
BzABhiVodHRwOi8vb2NzcDA1LmFjdGFsaXMuaXQvVkEvQVVUSC1ST09UMEUGA1Ud
IAQ+MDwwOgYEVR0gADAyMDAGCCsGAQUFBwIBFiRodHRwczovL3d3dy5hY3RhbGlz
Lml0L2FyZWEtZG93bmxvYWQwHQYDVR0lBBYwFAYIKwYBBQUHAwIGCCsGAQUFBwMB
MIHjBgNVHR8EgdswgdgwgZaggZOggZCGgY1sZGFwOi8vbGRhcDA1LmFjdGFsaXMu
aXQvY24lM2RBY3RhbGlzJTIwQXV0aGVudGljYXRpb24lMjBSb290JTIwQ0EsbyUz
ZEFjdGFsaXMlMjBTLnAuQS4lMmYwMzM1ODUyMDk2NyxjJTNkSVQ/Y2VydGlmaWNh
dGVSZXZvY2F0aW9uTGlzdDtiaW5hcnkwPaA7oDmGN2h0dHA6Ly9jcmwwNS5hY3Rh
bGlzLml0L1JlcG9zaXRvcnkvQVVUSC1ST09UL2dldExhc3RDUkwwHQYDVR0OBBYE
FJ+KsbXxsd6C9Cd8vojN3qlDgaNLMA4GA1UdDwEB/wQEAwIBBjANBgkqhkiG9w0B
AQsFAAOCAgEAJbygMnKJ5M6byr5Ectq05ODqwNMtky8TEF3O55g6RHhxblf6OegZ
4ui4+ElHNOIXjycbeuUGuFA4LScCC9fnI1Rnn8TI2Q7OP5YWifEfnrdp99t/tJzQ
hfdi7ZTdRRZZGV9x+grfR/RtjT2C3Lt9X4lcbuSxTea3PHAwwi0A3bYRR1L5ciPm
eAnYtG9kpat8/RuC22oxiZZ5FdjU6wrRWkASRLiIwNcFIYfvpUbMWElaCUhqaB2y
YvWF8o02pnaYb4bvTCg4cVabVnojUuuXH81LeQhhsSXLwcdwSdew0NL4zCiNCn2Q
iDZpz2biCWDggibmWxsUUF6AbqMHnwsdS8vsKXiFQJHeAdNAhA+kwpqYAdhUiCdj
RTUdtRNUucLvZEN1OAvVYyog9xYCfhtkqgXQROMANP+Z/+yaZahaP/Vgak/V00se
Hdh7F+B6h5HVdwdh+17E2jl+aMTfyvBFcg2H/9Qjyl4TY8NW/6v0DPK52sVt8a35
I+7xLGLPohAl4z6pEf2OxgjMNfXXCXS33smRgz1dLQFo8UpAb3rf84zkXaqEI6Qi
2P+5pibVFQigRbn4RcE+K2a/nm2M/o+WZTSio+E+YXacnNk71VcO82biOof+jBKT
iC3Xi7rAlypmme+QFBw9F1J89ig3smV/HaN8tO0lfTpvm7Zvzd5TkMs=
-----END CERTIFICATE-----`;

const ACTALIS_ROOT_CA = `-----BEGIN CERTIFICATE-----
MIIFuzCCA6OgAwIBAgIIVwoRl0LE48wwDQYJKoZIhvcNAQELBQAwazELMAkGA1UE
BhMCSVQxDjAMBgNVBAcMBU1pbGFuMSMwIQYDVQQKDBpBY3RhbGlzIFMucC5BLi8w
MzM1ODUyMDk2NzEnMCUGA1UEAwweQWN0YWxpcyBBdXRoZW50aWNhdGlvbiBSb290
IENBMB4XDTExMDkyMjExMjIwMloXDTMwMDkyMjExMjIwMlowazELMAkGA1UEBhMC
SVQxDjAMBgNVBAcMBU1pbGFuMSMwIQYDVQQKDBpBY3RhbGlzIFMucC5BLi8wMzM1
ODUyMDk2NzEnMCUGA1UEAwweQWN0YWxpcyBBdXRoZW50aWNhdGlvbiBSb290IENB
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAp8bEpSmkLO/lGMWwUKNv
UTufClrJwkg4CsIcoBh/kbWHuUA/3R1oHwiD1S0eiKD4j1aPbZkCkpAW1V8IbInX
4ay8IMKx4INRimlNAJZaby/ARH6jDuSRzVju3PvHHkVH3Se5CAGfpiEd9UEtL0z9
KK3giq0itFZljoZUj5NDKd45RnijMCO6zfB9E1fAXdKDa0hMxKufgFpbOr3JpyI/
gCczWw63igxdBzcIy2zSekciRDXFzMwujt0q7bd9Zg1fYVEiVRvjRuPjPdA1Yprb
rxTIW6HMiRvhMCb8oJsfgadHHwTrozmSBp+Z07/T6k9QnBn+locePGX2oxgkg4YQ
51Q+qDp2JE+BIcXjDwL4k5RHILv+1A7TaLndxHqEguNTVHnd25zS8gebLra8Pu2F
be8lEfKXGkJh90qX6IuxEAf6ZYGyojnP9zz/GPvG8VqLWeICrHuS0E4UT1lF9gxe
KF+w6D9Fz8+vm2/7hNN3WpVvrJSEnu68wEqPSpP4RCHiMUVhUE4Q2OM1fEwZtN4F
v6MGn8i1zeQf1xcGDXqVdFUNaBr8EBtiZJ1t4JWgw5QHVw0U5r0F+7if5t+L4sbn
fpb2U8WANFAoWPASUHEXMLrmeGO89LKtmyuy/uE5jF66CyCU3nuDuP/jVo23Eek7
jPKxwV2dpAtMK9myGPW1n0sCAwEAAaNjMGEwHQYDVR0OBBYEFFLYiDrIn3hm7Ynz
ezhwlMkCAjbQMA8GA1UdEwEB/wQFMAMBAf8wHwYDVR0jBBgwFoAUUtiIOsifeGbt
ifN7OHCUyQICNtAwDgYDVR0PAQH/BAQDAgEGMA0GCSqGSIb3DQEBCwUAA4ICAQAL
e3KHwGCmSUyIWOYdiPcUZEim2FgKDk8TNd81HdTtBjHIgT5q1d07GjLukD0R0i70
jsNjLiNmsGe+b7bAEzlgqqI0JZN1Ut6nna0Oh4lScWoWPBkdg/iaKWW+9D+a2fDz
WochcYBNy+A4mz+7+uAwTc+G02UQGRjRlwKxK3JCaKygvU5a2hi/a5iB0P2avl4V
SM0RFbnAKVy06Ij3Pjaut2L9HmLecHgQHEhb2rykOLpn7VU+Xlff1ANATIGk0k9j
pwlCCRT8AKnCgHNPLsBA2RF7SOp6AsDT6ygBJlh0wcBzIm2Tlf05fbsq4/aC4yyX
X04fkZT6/iyj2HYauE2yOE+b+h1IYHkm4vP9qdCa6HCPSXrW5b0KDtst842/6+Ok
fcvHlXHo2qN8xcL4dJIEG4aspCJTQLas/kx2z/uUMsA1n3Y/buWQbqCmJqK4LL7R
K4X9p2jIugErsWx0Hbhzlefut8cl8ABMALJ+tguLHPPAUJ4lueAI3jZm/zel0btU
ZCzJJ7VLkn5l/9Mt4blOvH+kQSGQQXemOR/qnuOf0GZvBeyqdn6/axag67XH/JJU
LysRJyU3eExRarDzzFhdFPFqSBX/wge2sY0PjlxQRrM9vwGYT7JZVEc+NHt4bVaT
LnPqZih4zR0Uv6CPLy64Lo7yFIrM6bV8+2ydDKXhlg==
-----END CERTIFICATE-----`;

/* ── Minimal IMAP over TLS ── */
async function imapConnect(host: string, port: number) {
  const conn = await Deno.connectTls({
    hostname: host,
    port,
    caCerts: [ACTALIS_INTERMEDIATE_CA, ACTALIS_ROOT_CA],
  });

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let tag = 0;
  const buf = new Uint8Array(65536);

  async function readUntilComplete(): Promise<string> {
    let result = "";
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      const n = await conn.read(buf);
      if (n === null) break;
      result += decoder.decode(buf.subarray(0, n));
      if (/^A\d+ (OK|NO|BAD)/m.test(result) || (result.startsWith("* OK") && tag === 0)) {
        return result;
      }
    }
    return result;
  }

  async function command(cmd: string): Promise<string> {
    tag++;
    const line = `A${tag} ${cmd}\r\n`;
    await conn.write(encoder.encode(line));
    return await readUntilComplete();
  }

  const greeting = await readUntilComplete();
  if (!greeting.includes("OK")) throw new Error("IMAP greeting failed: " + greeting.slice(0, 200));

  return {
    command,
    close: () => { try { conn.close(); } catch (_) {} },
  };
}

function parseEmailAddress(raw: string): string {
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
  const { data: partner } = await supabase.from("partners").select("id, company_name").ilike("email", emailLower).limit(1).maybeSingle();
  if (partner) return { source_type: "partner", source_id: partner.id, partner_id: partner.id, name: partner.company_name };
  const { data: pc } = await supabase.from("partner_contacts").select("id, partner_id, name").ilike("email", emailLower).limit(1).maybeSingle();
  if (pc) return { source_type: "partner_contact", source_id: pc.id, partner_id: pc.partner_id, name: pc.name };
  const { data: ic } = await supabase.from("imported_contacts").select("id, company_name, name").ilike("email", emailLower).limit(1).maybeSingle();
  if (ic) return { source_type: "imported_contact", source_id: ic.id, partner_id: null, name: ic.name || ic.company_name };
  const { data: prospect } = await supabase.from("prospects").select("id, company_name").ilike("email", emailLower).limit(1).maybeSingle();
  if (prospect) return { source_type: "prospect", source_id: prospect.id, partner_id: null, name: prospect.company_name };
  return { source_type: "unknown", source_id: null, partner_id: null, name: email };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const authClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userError } = await authClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = userData.user.id;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const imapHost = Deno.env.get("IMAP_HOST") || "imaps.aruba.it";
    const imapUser = Deno.env.get("IMAP_USER");
    const imapPass = Deno.env.get("IMAP_PASSWORD");
    if (!imapUser || !imapPass) {
      return new Response(JSON.stringify({ error: "Credenziali IMAP non configurate" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let { data: syncState } = await supabase.from("email_sync_state").select("*").eq("user_id", userId).maybeSingle();
    if (!syncState) {
      const { data: ns } = await supabase.from("email_sync_state").insert({ user_id: userId, imap_host: imapHost, imap_user: imapUser, last_uid: 0 }).select().single();
      syncState = ns;
    }
    const lastUid = syncState?.last_uid || 0;

    console.log(`[check-inbox] Connecting to ${imapHost}:993...`);
    const imap = await imapConnect(imapHost, 993);

    try {
      const loginRes = await imap.command(`LOGIN "${imapUser}" "${imapPass}"`);
      if (loginRes.includes("NO") || loginRes.includes("BAD")) throw new Error("IMAP login failed: " + loginRes.slice(0, 200));
      console.log("[check-inbox] Login OK");

      await imap.command("SELECT INBOX");
      const searchCmd = lastUid > 0 ? `UID SEARCH UID ${lastUid + 1}:*` : "UID SEARCH ALL";
      const searchRes = await imap.command(searchCmd);
      const searchLine = searchRes.split("\r\n").find(l => l.startsWith("* SEARCH"));
      const uids: number[] = [];
      if (searchLine) {
        for (const p of searchLine.replace("* SEARCH", "").trim().split(/\s+/)) {
          const n = parseInt(p, 10);
          if (!isNaN(n) && n > lastUid) uids.push(n);
        }
      }
      console.log(`[check-inbox] Found ${uids.length} new messages`);

      const toFetch = uids.sort((a, b) => a - b).slice(0, 50);
      const messages: any[] = [];
      let maxUid = lastUid;

      for (const uid of toFetch) {
        try {
          const fetchRes = await imap.command(`UID FETCH ${uid} (BODY[HEADER] BODY[TEXT])`);
          const headerMatch = fetchRes.match(/BODY\[HEADER\]\s*\{(\d+)\}\r\n([\s\S]*?)(?=\s*BODY\[TEXT\])/);
          const bodyMatch = fetchRes.match(/BODY\[TEXT\]\s*\{(\d+)\}\r\n([\s\S]*?)(?=\s*\)|\s*A\d+)/);
          const headers = parseHeaders(headerMatch ? headerMatch[2] : "");
          const bodyRaw = bodyMatch ? bodyMatch[2] : "";
          const fromEmail = parseEmailAddress(headers["from"] || "");
          const toEmail = parseEmailAddress(headers["to"] || "");
          const subject = headers["subject"] || "(nessun oggetto)";
          const messageId = headers["message-id"] || `uid_${uid}_${Date.now()}`;
          const match = await matchSender(supabase, fromEmail);

          messages.push({
            user_id: userId, channel: "email", direction: "inbound",
            source_type: match.source_type, source_id: match.source_id, partner_id: match.partner_id,
            from_address: fromEmail, to_address: toEmail, subject,
            body_text: bodyRaw.trim().slice(0, 50000),
            message_id_external: messageId,
            in_reply_to: headers["in-reply-to"] || null,
            raw_payload: { uid, headers, date: headers["date"] || "", sender_name: match.name },
          });
          if (uid > maxUid) maxUid = uid;
        } catch (e) { console.error(`[check-inbox] UID ${uid}:`, e.message); }
      }

      await imap.command("LOGOUT").catch(() => {});
      imap.close();

      if (messages.length > 0) {
        const { error: ue } = await supabase.from("channel_messages").upsert(messages, { onConflict: "message_id_external" });
        if (ue) throw new Error("Errore salvataggio: " + ue.message);
        await supabase.from("email_sync_state").update({ last_uid: maxUid, last_sync_at: new Date().toISOString() }).eq("user_id", userId);
        for (const msg of messages) {
          if (msg.source_type === "imported_contact" && msg.source_id) {
            await supabase.rpc("increment_contact_interaction", { p_contact_id: msg.source_id });
          }
        }
      }

      const matched = messages.filter(m => m.source_type !== "unknown").length;
      return new Response(JSON.stringify({
        success: true, total: messages.length, matched, unmatched: messages.length - matched, last_uid: maxUid,
        messages: messages.map(m => ({ from: m.from_address, subject: m.subject, source_type: m.source_type, sender_name: m.raw_payload?.sender_name, date: m.raw_payload?.date })),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } catch (imapErr) { imap.close(); throw imapErr; }
  } catch (err) {
    console.error("[check-inbox] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
