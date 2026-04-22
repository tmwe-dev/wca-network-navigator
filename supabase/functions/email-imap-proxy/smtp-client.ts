export async function handleSend(body: {
  email: string;
  password: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecurity: string;
  to: string;
  cc?: string;
  subject: string;
  body: string;
}): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  const {
    email,
    password,
    smtpHost,
    smtpPort = 587,
    smtpSecurity = "starttls",
    to,
    cc,
    subject,
    body: emailBody,
  } = body;

  if (!email || !password || !smtpHost || !to) {
    return {
      success: false,
      error: "email, password, smtpHost e to richiesti",
    };
  }

  try {
    const useSSL = smtpSecurity === "ssl" || smtpPort === 465;
    const conn = useSSL
      ? await Deno.connectTls({ hostname: smtpHost, port: smtpPort })
      : await Deno.connect({ hostname: smtpHost, port: smtpPort });

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    async function readSmtp(): Promise<string> {
      const buf = new Uint8Array(4096);
      const n = await conn.read(buf);
      return decoder.decode(buf.subarray(0, n || 0));
    }

    async function writeSmtp(data: string): Promise<void> {
      await conn.write(encoder.encode(data + "\r\n"));
    }

    const greeting = await readSmtp();
    if (!greeting.startsWith("220"))
      throw new Error("SMTP greeting failed: " + greeting.slice(0, 100));

    await writeSmtp(`EHLO ${smtpHost}`);
    const ehloRes = await readSmtp();

    if (smtpSecurity === "starttls" && ehloRes.includes("STARTTLS")) {
      await writeSmtp("STARTTLS");
      const starttlsRes = await readSmtp();
      if (!starttlsRes.startsWith("220"))
        throw new Error("STARTTLS failed");
    }

    await writeSmtp("AUTH LOGIN");
    const authRes = await readSmtp();
    if (!authRes.startsWith("334"))
      throw new Error(
        "AUTH LOGIN non supportato: " + authRes.slice(0, 100)
      );

    await writeSmtp(btoa(email));
    const userRes = await readSmtp();
    if (!userRes.startsWith("334"))
      throw new Error("Username rifiutato");

    await writeSmtp(btoa(password));
    const passRes = await readSmtp();
    if (!passRes.startsWith("235"))
      throw new Error(
        "Autenticazione SMTP fallita — verifica le credenziali"
      );

    await writeSmtp(`MAIL FROM:<${email}>`);
    const mailRes = await readSmtp();
    if (!mailRes.startsWith("250"))
      throw new Error("MAIL FROM rifiutato: " + mailRes.slice(0, 100));

    const recipients = [to];
    if (cc)
      recipients.push(
        ...cc
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      );

    for (const rcpt of recipients) {
      await writeSmtp(`RCPT TO:<${rcpt}>`);
      const rcptRes = await readSmtp();
      if (!rcptRes.startsWith("250"))
        throw new Error(
          `Destinatario rifiutato (${rcpt}): ` +
            rcptRes.slice(0, 100)
        );
    }

    await writeSmtp("DATA");
    const dataRes = await readSmtp();
    if (!dataRes.startsWith("354"))
      throw new Error("DATA rifiutato");

    const messageId = `<${Date.now()}.${Math.random()
      .toString(36)
      .slice(2)}@${smtpHost}>`;
    const date = new Date().toUTCString();
    let message = `From: ${email}\r\n`;
    message += `To: ${to}\r\n`;
    if (cc) message += `Cc: ${cc}\r\n`;
    message += `Subject: ${subject || "(senza oggetto)"}\r\n`;
    message += `Date: ${date}\r\n`;
    message += `Message-ID: ${messageId}\r\n`;
    message += `MIME-Version: 1.0\r\n`;
    message += `Content-Type: text/plain; charset=UTF-8\r\n`;
    message += `Content-Transfer-Encoding: 8bit\r\n`;
    message += `\r\n`;
    message += emailBody.replace(/^\./gm, "..");
    message += `\r\n.\r\n`;

    await conn.write(encoder.encode(message));
    const sendRes = await readSmtp();
    if (!sendRes.startsWith("250"))
      throw new Error("Invio fallito: " + sendRes.slice(0, 100));

    await writeSmtp("QUIT");
    try {
      await readSmtp();
    } catch {
      // Ignore
    }
    try {
      conn.close();
    } catch {
      // Ignore
    }

    return { success: true, messageId };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
