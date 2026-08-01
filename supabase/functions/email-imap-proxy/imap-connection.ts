export interface ImapConn {
  conn: Deno.TlsConn | Deno.TcpConn;
  reader: ReadableStreamDefaultReader<Uint8Array>;
  tag: number;
  buffer: string;
  close: () => void;
}

export async function connectImap(
  host: string,
  port: number,
  tls: boolean
): Promise<ImapConn> {
  const conn = tls
    ? await Deno.connectTls({ hostname: host, port })
    : await Deno.connect({ hostname: host, port });

  const reader = conn.readable.getReader();
  const imap: ImapConn = {
    conn,
    reader,
    tag: 0,
    buffer: "",
    close: () => conn.close(),
  };

  await readResponse(imap);
  return imap;
}

export async function readResponse(imap: ImapConn): Promise<string> {
  const decoder = new TextDecoder();
  let result = imap.buffer;
  imap.buffer = "";

  const timeout = 30000;
  const start = Date.now();

  while (true) {
    const tagPattern = `A${imap.tag} `;

    if (result.includes("\r\n")) {
      const lines = result.split("\r\n");

      for (const line of lines) {
        if (
          line.startsWith(tagPattern) ||
          (imap.tag === 0 && line.startsWith("*"))
        ) {
          imap.buffer = lines
            .slice(lines.indexOf(line) + 1)
            .filter((l) => l)
            .join("\r\n");
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

export async function sendCommand(
  imap: ImapConn,
  command: string
): Promise<string> {
  imap.tag++;
  const tag = `A${imap.tag}`;
  const encoder = new TextEncoder();

  const writer = (
    imap.conn as unknown as {
      writable?: { getWriter?: () => WritableStreamDefaultWriter };
    }
  ).writable?.getWriter?.();

  if (writer) {
    await writer.write(encoder.encode(`${tag} ${command}\r\n`));
    writer.releaseLock();
  } else {
    await (
      imap.conn as unknown as { write: (data: Uint8Array) => Promise<void> }
    ).write(encoder.encode(`${tag} ${command}\r\n`));
  }

  const decoder = new TextDecoder();
  let result = imap.buffer;
  imap.buffer = "";
  const timeout = 60000;
  const start = Date.now();

  while (true) {
    if (
      result.includes(`${tag} OK`) ||
      result.includes(`${tag} NO`) ||
      result.includes(`${tag} BAD`)
    ) {
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
