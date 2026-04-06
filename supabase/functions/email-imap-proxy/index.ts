const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.split("/").pop();

  try {
    const body = req.method === "POST" ? await req.json() : {};

    switch (path) {
      case "verify":
        return await handleVerify(body);
      case "test":
        return await handleTest(body);
      case "fetch":
        return await handleFetch(body);
      case "send":
        return await handleSend(body);
      default:
        return jsonResponse({ error: "Endpoint non trovato" }, 404);
    }
  } catch (err) {
    console.error("[email-imap-proxy] Error:", err);
    return jsonResponse({ error: err.message || "Errore interno" }, 500);
  }
});

/* ── Verify: check if IMAP server is reachable ────────────────── */

async function handleVerify(body: { host: string; port: number; tls: boolean }) {
  const { host, port = 993, tls = true } = body;
  if (!host) return jsonResponse({ error: "host richiesto" }, 400);

  try {
    const conn = tls
      ? await Deno.connectTls({ hostname: host, port })
      : await Deno.connect({ hostname: host, port });

    // Read greeting
    const buf = new Uint8Array(1024);
    const n = await conn.read(buf);
    const greeting = new TextDecoder().decode(buf.subarray(0, n || 0));
    conn.close();

    const reachable = greeting.includes("OK") || greeting.includes("IMAP") || greeting.includes("*");
    return jsonResponse({ reachable, greeting: greeting.slice(0, 200) });
  } catch (err) {
    return jsonResponse({ reachable: false, error: err.message });
  }
}

/* ── Test: login + get folder info ────────────────────────────── */

async function handleTest(body: {
  email: string;
  password: string;
  host: string;
  port: number;
  tls: boolean;
}) {
  const { email, password, host, port = 993, tls = true } = body;
  if (!email || !password || !host) {
    return jsonResponse({ error: "email, password e host richiesti" }, 400);
  }

  const imap = await connectImap(host, port, tls);
  try {
    await imapLogin(imap, email, password);
    const folders = await imapListFolders(imap);
    
    // Select INBOX to get message count
    const inboxInfo = await imapSelect(imap, "INBOX");
    
    await imapLogout(imap);
    return jsonResponse({
      success: true,
      folders: folders.join(", "),
      totalMessages: inboxInfo.exists,
    });
  } catch (err) {
    try { imap.close(); } catch {}
    return jsonResponse({ success: false, error: err.message }, 401);
  }
}

/* ── Fetch: download new emails ───────────────────────────────── */

async function handleFetch(body: {
  email: string;
  password: string;
  host: string;
  port: number;
  tls: boolean;
  lastUid: number;
  batchSize: number;
}) {
  const { email, password, host, port = 993, tls = true, lastUid = 0, batchSize = 50 } = body;
  if (!email || !password || !host) {
    return jsonResponse({ error: "email, password e host richiesti" }, 400);
  }

  const imap = await connectImap(host, port, tls);
  try {
    await imapLogin(imap, email, password);
    const inboxInfo = await imapSelect(imap, "INBOX");

    // Fetch UIDs greater than lastUid
    const uidRange = lastUid > 0 ? `${lastUid + 1}:*` : `1:${batchSize}`;
    const uids = await imapSearchUids(imap, uidRange, lastUid);

    // Limit to batchSize
    const targetUids = uids.slice(0, batchSize);

    const emails: Array<{
      uid: number;
      subject: string;
      from: string;
      date: string;
      raw: string;
    }> = [];

    for (const uid of targetUids) {
      try {
        const raw = await imapFetchMessage(imap, uid);
        const headers = parseHeaders(raw);
        emails.push({
          uid,
          subject: headers.subject || "",
          from: headers.from || "",
          date: headers.date || "",
          raw,
        });
      } catch (err) {
        console.error(`[email-imap-proxy] Failed to fetch UID ${uid}:`, err.message);
      }
    }

    const highestUid = targetUids.length > 0 ? Math.max(...targetUids) : lastUid;

    await imapLogout(imap);
    return jsonResponse({
      emails,
      highestUid,
      totalInbox: inboxInfo.exists,
      fetched: emails.length,
    });
  } catch (err) {
    try { imap.close(); } catch {}
    return jsonResponse({ error: err.message }, 500);
  }
}

/* ══════════════════════════════════════════════════════════════════
   IMAP Protocol Implementation (minimal, raw TCP)
   ══════════════════════════════════════════════════════════════════ */

interface ImapConn {
  conn: Deno.TlsConn | Deno.TcpConn;
  reader: ReadableStreamDefaultReader<Uint8Array>;
  tag: number;
  buffer: string;
  close: () => void;
}

async function connectImap(host: string, port: number, tls: boolean): Promise<ImapConn> {
  const conn = tls
    ? await Deno.connectTls({ hostname: host, port })
    : await Deno.connect({ hostname: host, port });

  const reader = conn.readable.getReader();
  const imap: ImapConn = { conn, reader, tag: 0, buffer: "", close: () => conn.close() };

  // Read greeting
  await readResponse(imap);
  return imap;
}

async function readResponse(imap: ImapConn): Promise<string> {
  const decoder = new TextDecoder();
  let result = imap.buffer;
  imap.buffer = "";

  const timeout = 30000;
  const start = Date.now();

  while (true) {
    // Check if we have a complete tagged response
    const tagPattern = `A${imap.tag} `;
    const okPattern = "* OK";
    
    if (result.includes("\r\n")) {
      const lines = result.split("\r\n");
      const lastComplete = lines.slice(0, -1).join("\r\n");
      
      // Check for tagged response completion
      for (const line of lines) {
        if (line.startsWith(tagPattern) || (imap.tag === 0 && line.startsWith("*"))) {
          imap.buffer = lines.slice(lines.indexOf(line) + 1).filter(l => l).join("\r\n");
          return result;
        }
      }
    }

    if (Date.now() - start > timeout) {
      throw new Error("IMAP timeout");
    }

    const { value, done } = await imap.reader.read();
    if (done) throw new Error("Connection closed");
    result += decoder.decode(value);
  }
}

async function sendCommand(imap: ImapConn, command: string): Promise<string> {
  imap.tag++;
  const tag = `A${imap.tag}`;
  const encoder = new TextEncoder();
  
  const writer = (imap.conn as any).writable?.getWriter?.();
  if (writer) {
    await writer.write(encoder.encode(`${tag} ${command}\r\n`));
    writer.releaseLock();
  } else {
    // Fallback for older Deno versions
    await (imap.conn as any).write(encoder.encode(`${tag} ${command}\r\n`));
  }

  // Read until we get our tagged response
  const decoder = new TextDecoder();
  let result = imap.buffer;
  imap.buffer = "";
  const timeout = 60000;
  const start = Date.now();

  while (true) {
    if (result.includes(`${tag} OK`) || result.includes(`${tag} NO`) || result.includes(`${tag} BAD`)) {
      return result;
    }

    if (Date.now() - start > timeout) {
      throw new Error(`IMAP timeout waiting for ${tag}`);
    }

    const { value, done } = await imap.reader.read();
    if (done) throw new Error("Connection closed");
    result += decoder.decode(value);
  }
}

async function imapLogin(imap: ImapConn, email: string, password: string): Promise<void> {
  // Escape password for IMAP literal
  const escapedPass = password.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const res = await sendCommand(imap, `LOGIN "${email}" "${escapedPass}"`);
  if (!res.includes("OK")) {
    throw new Error("Autenticazione fallita — verifica le credenziali");
  }
}

async function imapListFolders(imap: ImapConn): Promise<string[]> {
  const res = await sendCommand(imap, 'LIST "" "*"');
  const folders: string[] = [];
  for (const line of res.split("\r\n")) {
    const match = line.match(/\* LIST .+ "(.+)"$/);
    if (match) folders.push(match[1]);
  }
  return folders.length ? folders : ["INBOX"];
}

async function imapSelect(imap: ImapConn, folder: string): Promise<{ exists: number }> {
  const res = await sendCommand(imap, `SELECT "${folder}"`);
  const existsMatch = res.match(/\* (\d+) EXISTS/);
  return { exists: existsMatch ? parseInt(existsMatch[1]) : 0 };
}

async function imapSearchUids(imap: ImapConn, range: string, lastUid: number): Promise<number[]> {
  let res: string;
  if (lastUid > 0) {
    res = await sendCommand(imap, `UID SEARCH UID ${range}`);
  } else {
    res = await sendCommand(imap, "UID SEARCH ALL");
  }

  const uids: number[] = [];
  for (const line of res.split("\r\n")) {
    if (line.startsWith("* SEARCH")) {
      const nums = line.replace("* SEARCH", "").trim().split(/\s+/);
      for (const n of nums) {
        const uid = parseInt(n);
        if (!isNaN(uid) && uid > lastUid) uids.push(uid);
      }
    }
  }
  return uids.sort((a, b) => a - b);
}

async function imapFetchMessage(imap: ImapConn, uid: number): Promise<string> {
  const res = await sendCommand(imap, `UID FETCH ${uid} (BODY[])`);
  // Extract the message body between the literal header and the closing paren
  const literalMatch = res.match(/\{(\d+)\}\r\n/);
  if (literalMatch) {
    const start = res.indexOf(literalMatch[0]) + literalMatch[0].length;
    const length = parseInt(literalMatch[1]);
    return res.substring(start, start + length);
  }
  return res;
}

async function imapLogout(imap: ImapConn): Promise<void> {
  try {
    await sendCommand(imap, "LOGOUT");
  } catch {}
  try { imap.close(); } catch {}
}

/* ── Header parser ────────────────────────────────────────────── */

function parseHeaders(raw: string): Record<string, string> {
  const headerEnd = raw.indexOf("\r\n\r\n");
  const headerSection = headerEnd > 0 ? raw.substring(0, headerEnd) : raw.substring(0, 2000);
  
  const headers: Record<string, string> = {};
  const lines = headerSection.split("\r\n");
  let currentKey = "";

  for (const line of lines) {
    if (line.startsWith(" ") || line.startsWith("\t")) {
      // Continuation
      if (currentKey) headers[currentKey] += " " + line.trim();
    } else {
      const colonIdx = line.indexOf(":");
      if (colonIdx > 0) {
        currentKey = line.substring(0, colonIdx).toLowerCase().trim();
        headers[currentKey] = line.substring(colonIdx + 1).trim();
      }
    }
  }

  // Decode MIME encoded words
  for (const key of Object.keys(headers)) {
    headers[key] = decodeMimeWords(headers[key]);
  }

  return headers;
}

function decodeMimeWords(str: string): string {
  return str.replace(/=\?([^?]+)\?([BbQq])\?([^?]+)\?=/g, (_match, charset, encoding, text) => {
    try {
      if (encoding.toUpperCase() === "B") {
        const bytes = Uint8Array.from(atob(text), c => c.charCodeAt(0));
        return new TextDecoder(charset).decode(bytes);
      } else {
        const decoded = text.replace(/_/g, " ").replace(/=([0-9A-Fa-f]{2})/g, 
          (_: string, hex: string) => String.fromCharCode(parseInt(hex, 16)));
        return decoded;
      }
    } catch {
      return text;
    }
  });
}

/* ── Response helper ──────────────────────────────────────────── */

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
