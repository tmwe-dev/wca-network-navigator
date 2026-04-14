/**
 * LinkedIn Messaging Bridge
 * Dual-strategy: uses FireScrape (primary) for reading inbox/threads,
 * falls back to LinkedIn extension for sending messages.
 * Ultra-conservative: long timeouts, no aggressive polling.
 */
import { useState, useCallback, useEffect, useRef } from "react";
import { createLogger } from "@/lib/log";

const log = createLogger("useLinkedInMessagingBridge");

type BridgeResponse = {
  success: boolean;
  error?: string;
  threads?: Array<{ name: string; lastMessage: string; unread: boolean; threadUrl: string }>;
  messages?: Array<{ text: string; sender: string; timestamp: string; direction: string }>;
  [key: string]: unknown;
};

// ── Ensure LinkedIn extension has Supabase config ──
let liMsgConfigSent = false;
function ensureLiMsgConfig() {
  if (liMsgConfigSent) return;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return;
  liMsgConfigSent = true;
  log.debug("→ sending setConfig to LinkedIn extension");
  window.postMessage({
    direction: "from-webapp-li",
    action: "setConfig",
    requestId: `li_setConfig_${Date.now()}`,
    supabaseUrl: url,
    supabaseAnonKey: key,
  }, window.location.origin);
}

// ── LinkedIn extension bridge (for ping, send, verify) ──
function sendToLinkedInExt(action: string, data: Record<string, unknown> = {}, timeoutMs = 15000): Promise<BridgeResponse> {
  ensureLiMsgConfig();
  return new Promise((resolve) => {
    const requestId = `li_msg_${crypto.randomUUID()}`;
    const timer = setTimeout(() => {
      window.removeEventListener("message", handler);
      resolve({ success: false, error: "timeout" });
    }, timeoutMs);

    const handler = (e: MessageEvent) => {
      if (e.source !== window) return;
      const d = e.data;
      if (!d || d.direction !== "from-extension-li") return;
      if (d.requestId !== requestId) return;
      clearTimeout(timer);
      window.removeEventListener("message", handler);
      resolve(d.response || { success: false, error: "empty response" });
    };
    window.addEventListener("message", handler);
    window.postMessage({ direction: "from-webapp-li", action, requestId, ...data }, window.location.origin);
  });
}

// ── FireScrape bridge (for reading pages) ──
function sendToFireScrape(action: string, data: Record<string, unknown> = {}, timeoutMs = 30000): Promise<unknown> {
  return new Promise((resolve) => {
    const requestId = `fs_li_${crypto.randomUUID()}`;
    const timer = setTimeout(() => {
      window.removeEventListener("message", handler);
      resolve({ success: false, error: "timeout" });
    }, timeoutMs);

    const handler = (e: MessageEvent) => {
      if (e.source !== window) return;
      const d = e.data;
      if (!d || d.direction !== "from-extension-fs") return;
      if (d.requestId !== requestId) return;
      clearTimeout(timer);
      window.removeEventListener("message", handler);
      resolve(d.response || d);
    };
    window.addEventListener("message", handler);
    window.postMessage({ direction: "from-webapp-fs", action, requestId, ...data }, window.location.origin);
  });
}

// ── Check if FireScrape is available ──
async function checkFireScrape(): Promise<boolean> {
  try {
    const r = await sendToFireScrape("ping", {}, 4000);
    return r?.success === true;
  } catch (e) {
    log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) });
    return false;
  }
}

// ── Parse LinkedIn inbox markdown into threads ──
function parseInboxMarkdown(markdown: string): BridgeResponse["threads"] {
  const threads: NonNullable<BridgeResponse["threads"]> = [];
  if (!markdown) return threads;

  const lines = markdown.split("\n");
  let currentName = "";
  let currentPreview = "";
  let currentUrl = "";
  let currentUnread = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Detect thread URL from markdown links
    const threadLinkMatch = line.match(/\[.*?\]\((https:\/\/www\.linkedin\.com\/messaging\/thread\/[^\)]+)\)/);
    if (threadLinkMatch) {
      currentUrl = threadLinkMatch[1];
    }

    // Detect contact name - usually appears as a standalone line with just a name (no special chars)
    // After an image reference like ![Name](...) the next meaningful line is often the name
    const imgMatch = line.match(/^!\[([^\]]+)\]/);
    if (imgMatch) {
      const candidateName = imgMatch[1];
      // LinkedIn names from alt text of profile photos
      if (candidateName && candidateName.length > 2 && candidateName.length < 60 && !/^http/i.test(candidateName)) {
        // Save previous thread if we have one
        if (currentName && (currentPreview || currentUrl)) {
          threads.push({ name: currentName, lastMessage: currentPreview, unread: currentUnread, threadUrl: currentUrl });
        }
        currentName = candidateName;
        currentPreview = "";
        currentUrl = "";
        currentUnread = false;
      }
      continue;
    }

    // Detect "Stato: online/disponibile" - indicates a status line, skip
    if (/^Stato:/i.test(line)) continue;

    // Detect date patterns like "28 mar 28 mar" — skip
    if (/^\d{1,2}\s+(gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic)\s+\d{1,2}/i.test(line)) continue;

    // Detect "Sponsorizzata" marker
    if (/^Sponsorizzata$/i.test(line)) continue;

    // Detect "Da leggere" or unread indicators
    if (/da leggere|unread/i.test(line)) {
      currentUnread = true;
      continue;
    }

    // Detect message preview - lines that start with name: or "Tu:" or contain actual message text
    const previewMatch = line.match(/^(?:(\w+):\s+)?(.{10,})/);
    if (previewMatch && currentName && !currentPreview) {
      // Skip navigation/UI lines
      if (/^Cerca|^Scrivi|^Posta|^Lavoro|^Tutti|^Elenco|^Avviso|^Carica|Premi il tasto|Conversazione attiva|dettagli della conversazione/i.test(line)) continue;
      if (/^Messaggistica$/i.test(line)) continue;
      // This is likely the message preview
      currentPreview = line;
    }

    // Detect thread URLs in href format
    const hrefMatch = line.match(/https:\/\/www\.linkedin\.com\/messaging\/thread\/[^\s\)\"]+/);
    if (hrefMatch && !currentUrl) {
      currentUrl = hrefMatch[0];
    }
  }

  // Don't forget the last thread
  if (currentName && (currentPreview || currentUrl)) {
    threads.push({ name: currentName, lastMessage: currentPreview, unread: currentUnread, threadUrl: currentUrl });
  }

  return threads;
}

// ── Parse LinkedIn thread markdown into messages ──
function parseThreadMarkdown(markdown: string, contactName: string): NonNullable<BridgeResponse["messages"]> {
  const messages: NonNullable<BridgeResponse["messages"]> = [];
  if (!markdown) return messages;

  const lines = markdown.split("\n");
  let currentSender = "";
  let currentText = "";
  let currentTimestamp = new Date().toISOString();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Skip UI elements
    if (/^Cerca|^Scrivi|^Messaggistica|^Posta|^Elenco|Premi il tasto/i.test(trimmed)) continue;

    // Detect sender line — usually "Name:" or standalone name
    const senderMatch = trimmed.match(/^(Tu|You|[A-Z][a-zà-ú]+ ?[A-Za-zà-ú]*):\s*(.*)/);
    if (senderMatch) {
      // Save previous message
      if (currentText) {
        const direction = /^(Tu|You)$/i.test(currentSender) ? "outbound" : "inbound";
        messages.push({ text: currentText, sender: currentSender || contactName, timestamp: currentTimestamp, direction });
      }
      currentSender = senderMatch[1];
      currentText = senderMatch[2] || "";
      continue;
    }

    // Detect time/date
    const timeMatch = trimmed.match(/^\d{1,2}:\d{2}|^\d{1,2}\s+(gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic)/i);
    if (timeMatch) {
      currentTimestamp = trimmed;
      continue;
    }

    // Accumulate text
    if (currentSender || currentText) {
      currentText += (currentText ? " " : "") + trimmed;
    }
  }

  // Last message
  if (currentText) {
    const direction = /^(Tu|You)$/i.test(currentSender) ? "outbound" : "inbound";
    messages.push({ text: currentText, sender: currentSender || contactName, timestamp: currentTimestamp, direction });
  }

  return messages;
}

export function useLinkedInMessagingBridge() {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isFireScrapeAvailable, setIsFireScrapeAvailable] = useState(false);
  const heartbeatRef = useRef<ReturnType<typeof setInterval>>();

  // Heartbeat — check both extensions every 15s
  useEffect(() => {
    const check = async () => {
      const [liRes, fsOk] = await Promise.all([
        sendToLinkedInExt("ping", {}, 4000),
        checkFireScrape(),
      ]);
      setIsAvailable(liRes.success === true);
      setIsFireScrapeAvailable(fsOk);
    };
    check();
    heartbeatRef.current = setInterval(check, 15000);
    return () => clearInterval(heartbeatRef.current);
  }, []);

  // Listen for spontaneous readiness signals
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.source !== window) return;
      const d = e.data;
      if (d?.direction === "from-extension-li") {
        if (d.action === "contentScriptReady") setIsAvailable(true);
        if (d.action === "extensionDead") setIsAvailable(false);
        if (d.action === "ping" && d.response?.success) setIsAvailable(true);
      }
      if (d?.direction === "from-extension-fs") {
        if (d.action === "ping" && d?.success) setIsFireScrapeAvailable(true);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // ── READ INBOX: Direct call to LinkedIn extension (same as test page) ──
  const readInbox = useCallback(async (): Promise<BridgeResponse> => {
    log.debug("reading inbox via extension");
    const result = await sendToLinkedInExt("readLinkedInInbox", {}, 35000);
    log.debug("readInbox result", { preview: JSON.stringify(result).slice(0, 500) });
    return { ...result, source: "linkedin-ext" };
  }, []);

  // ── READ THREAD: Direct call to LinkedIn extension (same as test page) ──
  const readThread = useCallback(async (threadUrl: string): Promise<BridgeResponse> => {
    log.debug("reading thread via extension", { threadUrl });
    const result = await sendToLinkedInExt("readLinkedInThread", { threadUrl }, 30000);
    log.debug("readThread result", { preview: JSON.stringify(result).slice(0, 500) });
    return { ...result, source: "linkedin-ext" };
  }, []);

  // ── SEND MESSAGE: Always via LinkedIn extension ──
  const sendMessage = useCallback(async (profileUrl: string, text: string): Promise<BridgeResponse> => {
    return sendToLinkedInExt("sendMessage", { url: profileUrl, message: text }, 20000);
  }, []);

  // ── DIAGNOSTIC: via LinkedIn extension ──
  const diagnosticDom = useCallback(async (): Promise<BridgeResponse> => {
    return sendToLinkedInExt("diagnosticLinkedInDom", {}, 30000);
  }, []);

  return { isAvailable, isFireScrapeAvailable, readInbox, readThread, sendMessage, diagnosticDom };
}
