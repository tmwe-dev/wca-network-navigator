export function parseHeaders(raw: string): Record<string, string> {
  const headerEnd = raw.indexOf("\r\n\r\n");
  const headerSection =
    headerEnd > 0 ? raw.substring(0, headerEnd) : raw.substring(0, 2000);

  const headers: Record<string, string> = {};
  const lines = headerSection.split("\r\n");
  let currentKey = "";

  for (const line of lines) {
    if (line.startsWith(" ") || line.startsWith("\t")) {
      if (currentKey) headers[currentKey] += " " + line.trim();
    } else {
      const colonIdx = line.indexOf(":");
      if (colonIdx > 0) {
        currentKey = line.substring(0, colonIdx).toLowerCase().trim();
        headers[currentKey] = line.substring(colonIdx + 1).trim();
      }
    }
  }

  for (const key of Object.keys(headers)) {
    headers[key] = decodeMimeWords(headers[key]);
  }

  return headers;
}

function decodeMimeWords(str: string): string {
  return str.replace(
    /=\?([^?]+)\?([BbQq])\?([^?]+)\?=/g,
    (_match, charset, encoding, text) => {
      try {
        if (encoding.toUpperCase() === "B") {
          const bytes = Uint8Array.from(atob(text), (c) =>
            c.charCodeAt(0)
          );
          return new TextDecoder(charset).decode(bytes);
        } else {
          const decoded = text
            .replace(/_/g, " ")
            .replace(/=([0-9A-Fa-f]{2})/g, (_: string, hex: string) =>
              String.fromCharCode(parseInt(hex, 16))
            );
          return decoded;
        }
      } catch {
        return text;
      }
    }
  );
}
