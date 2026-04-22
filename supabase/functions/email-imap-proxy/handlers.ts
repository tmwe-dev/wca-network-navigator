import { jsonResponse } from "./response.ts";
import {
  connectImap,
  imapLogin,
  imapListFolders,
  imapSelect,
  imapSearchUids,
  imapFetchMessage,
  imapLogout,
} from "./imap-operations.ts";
import { parseHeaders } from "./email-parser.ts";
import { handleSend } from "./smtp-client.ts";

export async function handleVerify(body: {
  host: string;
  port: number;
  tls: boolean;
}): Promise<Response> {
  const { host, port = 993, tls = true } = body;
  if (!host) return jsonResponse({ error: "host richiesto" }, 400);

  try {
    const conn = tls
      ? await Deno.connectTls({ hostname: host, port })
      : await Deno.connect({ hostname: host, port });

    const buf = new Uint8Array(1024);
    const n = await conn.read(buf);
    const greeting = new TextDecoder().decode(buf.subarray(0, n || 0));
    conn.close();

    const reachable =
      greeting.includes("OK") ||
      greeting.includes("IMAP") ||
      greeting.includes("*");
    return jsonResponse({
      reachable,
      greeting: greeting.slice(0, 200),
    });
  } catch (err) {
    return jsonResponse({
      reachable: false,
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
}

export async function handleTest(body: {
  email: string;
  password: string;
  host: string;
  port: number;
  tls: boolean;
}): Promise<Response> {
  const { email, password, host, port = 993, tls = true } = body;
  if (!email || !password || !host) {
    return jsonResponse(
      { error: "email, password e host richiesti" },
      400
    );
  }

  const imap = await connectImap(host, port, tls);
  try {
    await imapLogin(imap, email, password);
    const folders = await imapListFolders(imap);

    const inboxInfo = await imapSelect(imap, "INBOX");

    await imapLogout(imap);
    return jsonResponse({
      success: true,
      folders: folders.join(", "),
      totalMessages: inboxInfo.exists,
    });
  } catch (err) {
    try {
      imap.close();
    } catch {
      // Ignore
    }
    return jsonResponse(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      401
    );
  }
}

export async function handleFetch(body: {
  email: string;
  password: string;
  host: string;
  port: number;
  tls: boolean;
  lastUid: number;
  batchSize: number;
}): Promise<Response> {
  const {
    email,
    password,
    host,
    port = 993,
    tls = true,
    lastUid = 0,
    batchSize = 50,
  } = body;
  if (!email || !password || !host) {
    return jsonResponse(
      { error: "email, password e host richiesti" },
      400
    );
  }

  const imap = await connectImap(host, port, tls);
  try {
    await imapLogin(imap, email, password);
    const inboxInfo = await imapSelect(imap, "INBOX");

    const uidRange = lastUid > 0 ? `${lastUid + 1}:*` : `1:${batchSize}`;
    const uids = await imapSearchUids(imap, uidRange, lastUid);

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
        console.error(
          `[email-imap-proxy] Failed to fetch UID ${uid}:`,
          err instanceof Error ? err.message : "Unknown error"
        );
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
    try {
      imap.close();
    } catch {
      // Ignore
    }
    return jsonResponse(
      { error: err instanceof Error ? err.message : "Unknown error" },
      500
    );
  }
}

export async function handleSendEmail(body: {
  email: string;
  password: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecurity: string;
  to: string;
  cc?: string;
  subject: string;
  body: string;
}): Promise<Response> {
  const result = await handleSend(body);

  if (result.success) {
    return jsonResponse({ success: true, messageId: result.messageId });
  } else {
    return jsonResponse(
      { success: false, error: result.error },
      500
    );
  }
}
