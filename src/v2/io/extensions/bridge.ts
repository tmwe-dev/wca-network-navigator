/**
 * Bridge per comunicare con le estensioni Chrome installate.
 * Le estensioni iniettano un content script che ascolta window.postMessage
 * e risponde con i dati scrapati.
 */

export interface ExtensionRequest {
  source: "wca-app";
  target: "firescrape" | "claude-bridge" | "linkedin-scraper";
  action: string;
  payload: Record<string, unknown>;
  requestId: string;
}

export interface ExtensionResponse<T = unknown> {
  source: string;
  requestId: string;
  ok: boolean;
  data?: T;
  error?: string;
}

const TIMEOUT_MS = 30_000;

export async function callExtension<T = unknown>(
  target: ExtensionRequest["target"],
  action: string,
  payload: Record<string, unknown> = {},
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  return new Promise((resolve) => {
    const requestId = crypto.randomUUID();
    let timeoutId: ReturnType<typeof setTimeout>;

    const handler = (event: MessageEvent) => {
      const msg = event.data as ExtensionResponse<T> | undefined;
      if (!msg || msg.requestId !== requestId) return;
      if (msg.source !== target) return;
      window.removeEventListener("message", handler);
      clearTimeout(timeoutId);
      if (msg.ok && msg.data !== undefined) {
        resolve({ ok: true, data: msg.data });
      } else {
        resolve({ ok: false, error: msg.error ?? "Errore estensione" });
      }
    };

    window.addEventListener("message", handler);

    const request: ExtensionRequest = { source: "wca-app", target, action, payload, requestId };
    window.postMessage(request, "*");

    timeoutId = setTimeout(() => {
      window.removeEventListener("message", handler);
      resolve({
        ok: false,
        error: `Estensione ${target} non risponde (timeout ${TIMEOUT_MS}ms). Verifica che sia installata e attiva.`,
      });
    }, TIMEOUT_MS);
  });
}

/** Verifica se un'estensione è installata e attiva (handshake) */
export async function pingExtension(target: ExtensionRequest["target"]): Promise<boolean> {
  const res = await callExtension(target, "ping", {});
  return res.ok;
}
