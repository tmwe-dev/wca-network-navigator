import type { ImapConn } from "./imap-connection.ts";
import { sendCommand } from "./imap-connection.ts";

export async function imapLogin(
  imap: ImapConn,
  email: string,
  password: string
): Promise<void> {
  const escapedPass = password.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const res = await sendCommand(imap, `LOGIN "${email}" "${escapedPass}"`);
  if (!res.includes("OK")) {
    throw new Error(
      "Autenticazione fallita — verifica le credenziali"
    );
  }
}

export async function imapListFolders(imap: ImapConn): Promise<string[]> {
  const res = await sendCommand(imap, 'LIST "" "*"');
  const folders: string[] = [];
  for (const line of res.split("\r\n")) {
    const match = line.match(/\* LIST .+ "(.+)"$/);
    if (match) folders.push(match[1]);
  }
  return folders.length ? folders : ["INBOX"];
}

export async function imapSelect(
  imap: ImapConn,
  folder: string
): Promise<{ exists: number }> {
  const res = await sendCommand(imap, `SELECT "${folder}"`);
  const existsMatch = res.match(/\* (\d+) EXISTS/);
  return { exists: existsMatch ? parseInt(existsMatch[1]) : 0 };
}

export async function imapSearchUids(
  imap: ImapConn,
  range: string,
  lastUid: number
): Promise<number[]> {
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

export async function imapFetchMessage(
  imap: ImapConn,
  uid: number
): Promise<string> {
  const res = await sendCommand(imap, `UID FETCH ${uid} (BODY[])`);
  const literalMatch = res.match(/\{(\d+)\}\r\n/);
  if (literalMatch) {
    const start = res.indexOf(literalMatch[0]) + literalMatch[0].length;
    const length = parseInt(literalMatch[1]);
    return res.substring(start, start + length);
  }
  return res;
}

export async function imapLogout(imap: ImapConn): Promise<void> {
  try {
    await sendCommand(imap, "LOGOUT");
  } catch {
    // Ignore logout errors
  }
  try {
    imap.close();
  } catch {
    // Ignore close errors
  }
}
