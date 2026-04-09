import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { WHATSAPP_EXTENSION_REQUIRED_VERSION } from "@/lib/whatsappExtensionZip";

type LogEntry = { ts: string; msg: string; type: "info" | "ok" | "warn" | "error" };

function ts() {
  return new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/** Generic postMessage bridge for any extension */
function sendToExtension(
  direction: string,
  responseDirection: string,
  action: string,
  payload: Record<string, any> = {},
  timeoutMs = 30000
): Promise<any> {
  return new Promise((resolve) => {
    const requestId = `test_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const timer = setTimeout(() => {
      window.removeEventListener("message", handler);
      resolve({ success: false, error: `Timeout ${timeoutMs / 1000}s` });
    }, timeoutMs);

    function handler(e: MessageEvent) {
      if (e.source !== window) return;
      if (e.data?.direction !== responseDirection) return;
      if (e.data?.requestId !== requestId) return;
      clearTimeout(timer);
      window.removeEventListener("message", handler);
      resolve(e.data.response || e.data);
    }

    window.addEventListener("message", handler);
    window.postMessage({ direction, action, requestId, ...payload }, window.location.origin);
  });
}

const waMsg = (action: string, payload = {}, timeout = 60000) =>
  sendToExtension("from-webapp-wa", "from-extension-wa", action, payload, timeout);

const fsMsg = (action: string, payload = {}, timeout = 30000) =>
  sendToExtension("from-webapp-fs", "from-extension-fs", action, payload, timeout);

// Ensure LinkedIn extension has Supabase config before any action
let liConfigSent = false;
function ensureLiConfig() {
  if (liConfigSent) return;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return;
  liConfigSent = true;
  window.postMessage({
    direction: "from-webapp-li",
    action: "setConfig",
    requestId: `li_setConfig_${Date.now()}`,
    supabaseUrl: url,
    supabaseAnonKey: key,
  }, window.location.origin);
}

const liMsg = (action: string, payload = {}, timeout = 30000) => {
  ensureLiConfig();
  return sendToExtension("from-webapp-li", "from-extension-li", action, payload, timeout);
};

// ━━━━━━━━━━━━ Terminal Component ━━━━━━━━━━━━
function Terminal({ logs }: { logs: LogEntry[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const colorMap = {
    info: "text-muted-foreground",
    ok: "text-green-400",
    warn: "text-yellow-400",
    error: "text-red-400",
  };

  return (
    <ScrollArea className="h-[400px] rounded-lg border border-border bg-card p-4 font-mono text-xs">
      {logs.length === 0 && (
        <p className="text-muted-foreground">Premi un pulsante per iniziare...</p>
      )}
      {logs.map((l, i) => (
        <div key={i} className={colorMap[l.type]}>
          <span className="text-muted-foreground/60">[{l.ts}]</span> {l.msg}
        </div>
      ))}
      <div ref={bottomRef} />
    </ScrollArea>
  );
}

// ━━━━━━━━━━━━ WhatsApp Tab ━━━━━━━━━━━━
function WhatsAppTest() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [sendContact, setSendContact] = useState("");
  const [sendText, setSendText] = useState("Test da WCA Partner Connect 🚀");
  const [foundContacts, setFoundContacts] = useState<Array<{ contact: string; time?: string }>>([]);

  const log = useCallback((msg: string, type: LogEntry["type"] = "info") => {
    setLogs((prev) => [...prev, { ts: ts(), msg, type }]);
  }, []);

  const isExpectedWaVersion = (version?: string) => version === WHATSAPP_EXTENSION_REQUIRED_VERSION;

  const ensureCurrentWaExtension = async () => {
    const ping = await waMsg("ping", {}, 5000);

    if (!ping?.success) {
      log(`❌ Estensione WhatsApp non raggiungibile: ${ping?.error || JSON.stringify(ping)}`, "error");
      return null;
    }

    const version = ping.version || "?";
    if (!isExpectedWaVersion(version)) {
      log(`⚠️ Estensione WhatsApp obsoleta rilevata (v${version}). Serve la v${WHATSAPP_EXTENSION_REQUIRED_VERSION}.`, "error");
      log("Riscarica /whatsapp-extension.zip, ricarica l'estensione in chrome://extensions e ripeti il test.", "warn");
      return { ...ping, outdated: true };
    }

    return ping;
  };

  const testPing = async () => {
    setRunning(true);
    log("🔌 Ping estensione WhatsApp...");
    const r = await waMsg("ping", {}, 5000);
    if (r?.success) {
      const version = r.version || "?";
      if (isExpectedWaVersion(version)) log(`✅ Estensione attiva (v${version})`, "ok");
      else log(`⚠️ Estensione attiva ma obsoleta (v${version}) — richiesta v${WHATSAPP_EXTENSION_REQUIRED_VERSION}`, "error");
    } else log(`❌ Non raggiungibile: ${r?.error || JSON.stringify(r)}`, "error");
    setRunning(false);
  };

  const testSession = async () => {
    setRunning(true);
    const ping = await ensureCurrentWaExtension();
    if (!ping || ping.outdated) {
      setRunning(false);
      return;
    }
    log("🔑 Verifica sessione WhatsApp Web...");
    const r = await waMsg("verifySession", {}, 30000);
    log(`Risultato: ${JSON.stringify(r, null, 2)}`, r?.authenticated ? "ok" : "warn");
    setRunning(false);
  };

  const testReadUnread = async () => {
    setRunning(true);
    const ping = await ensureCurrentWaExtension();
    if (!ping || ping.outdated) {
      setRunning(false);
      return;
    }
    log("📨 Lettura messaggi (readUnread)...");
    const r = await waMsg("readUnread", {}, 60000);
    
    if (!r?.success) {
      log(`❌ Fallito: ${r?.error || JSON.stringify(r)}`, "error");
      setRunning(false);
      return;
    }

    log(`✅ Metodo: ${r.method || "?"} | Scansionati: ${r.scanned || "?"}`, "ok");
    const msgs = r.messages || [];
    log(`📬 Messaggi trovati: ${msgs.length}`);

    for (const m of msgs) {
      const verify = m.isVerify ? " 🔄VERIFY" : "";
      const unread = m.unreadCount > 0 ? ` (${m.unreadCount} non letti)` : "";
      log(`  👤 ${m.contact}${unread}${verify} — "${(m.lastMessage || "").slice(0, 80)}" — ⏰ ${m.time || "?"}`, 
        m.unreadCount > 0 ? "ok" : "info");
    }

    if (msgs.length === 0) {
      log("⚠️ ZERO messaggi — il selettore DOM non trova le chat!", "error");
    } else {
      setFoundContacts(msgs.map((m: any) => ({ contact: m.contact, time: m.time })));
    }

    setRunning(false);
  };

  const testSendMessage = async () => {
    if (!sendContact.trim()) {
      log("⚠️ Inserisci il nome del contatto WhatsApp", "warn");
      return;
    }
    if (!sendText.trim()) {
      log("⚠️ Inserisci il testo del messaggio", "warn");
      return;
    }
    setRunning(true);
    const ping = await ensureCurrentWaExtension();
    if (!ping || ping.outdated) {
      setRunning(false);
      return;
    }
    log(`📤 Invio WhatsApp a "${sendContact}": "${sendText.slice(0, 60)}..."`);
    const r = await waMsg("sendWhatsApp", { phone: sendContact, text: sendText }, 60000);
    if (r?.success) {
      log(`✅ Messaggio inviato con successo!`, "ok");
      log(`Risposta: ${JSON.stringify(r, null, 2).slice(0, 500)}`, "info");
    } else {
      log(`❌ Invio fallito: ${r?.error || JSON.stringify(r)}`, "error");
    }
    setRunning(false);
  };

  const testRawDom = async () => {
    setRunning(true);
    const ping = await ensureCurrentWaExtension();
    if (!ping || ping.outdated) {
      setRunning(false);
      return;
    }
    log("🔍 Test DOM diretto — cerco selettori sulla pagina WA...");
    const r = await sendToExtension("from-webapp-wa", "from-extension-wa", "diagnosticDom", {}, 30000);
    log(`Risposta: ${JSON.stringify(r, null, 2).slice(0, 2000)}`, r?.success ? "ok" : "error");
    setRunning(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button onClick={testPing} disabled={running} size="sm">🔌 Ping</Button>
        <Button onClick={testSession} disabled={running} size="sm">🔑 Sessione</Button>
        <Button onClick={testReadUnread} disabled={running} size="sm">📨 Leggi Messaggi</Button>
        <Button onClick={testRawDom} disabled={running} size="sm" variant="outline">🔍 Diagnostica DOM</Button>
        <Button onClick={() => setLogs([])} size="sm" variant="ghost">🗑️ Pulisci</Button>
      </div>

      <div className="flex gap-2">
        {foundContacts.length > 0 ? (
          <select
            value={sendContact}
            onChange={(e) => setSendContact(e.target.value)}
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">— Seleziona contatto —</option>
            {foundContacts.map((c, i) => (
              <option key={i} value={c.contact}>{c.contact}{c.time ? ` (${c.time})` : ""}</option>
            ))}
          </select>
        ) : (
          <Input
            value={sendContact}
            onChange={(e) => setSendContact(e.target.value)}
            placeholder="Nome contatto (prima fai 📨 Leggi Messaggi)"
            className="flex-1"
          />
        )}
      </div>
      <div className="flex gap-2">
        <Input
          value={sendText}
          onChange={(e) => setSendText(e.target.value)}
          placeholder="Testo del messaggio"
          className="flex-1"
        />
        <Button onClick={testSendMessage} disabled={running} size="sm" variant="default">📤 Invia WA</Button>
      </div>

      <Terminal logs={logs} />
    </div>
  );
}

// ━━━━━━━━━━━━ FireScrape Tab ━━━━━━━━━━━━
function FireScrapeTest() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [url, setUrl] = useState("https://www.example.com");

  const log = useCallback((msg: string, type: LogEntry["type"] = "info") => {
    setLogs((prev) => [...prev, { ts: ts(), msg, type }]);
  }, []);

  const testPing = async () => {
    setRunning(true);
    log("🔌 Ping FireScrape...");
    const r = await fsMsg("ping", {}, 5000);
    if (r?.success) log(`✅ FireScrape attivo (v${r.version || "?"}, engine: ${r.engine || "?"})`, "ok");
    else log(`❌ Non raggiungibile: ${r?.error || JSON.stringify(r)}`, "error");
    setRunning(false);
  };

  const testScrapeActive = async () => {
    setRunning(true);
    log("📄 Scrape tab attivo...");
    const r = await fsMsg("scrape", { skipCache: true }, 20000);
    if (r?.success) {
      log(`✅ Scrape completato`, "ok");
      log(`  Titolo: ${r.metadata?.title || "?"}`, "info");
      log(`  URL: ${r.metadata?.url || "?"}`, "info");
      log(`  Parole: ${r.stats?.words || "?"} | Tempo lettura: ${r.stats?.readingTime || "?"}`, "info");
      log(`  Markdown preview: ${(r.markdown || "").slice(0, 200)}...`, "info");
    } else {
      log(`❌ Fallito: ${r?.error || JSON.stringify(r)}`, "error");
    }
    setRunning(false);
  };

  const testScrapeUrl = async () => {
    setRunning(true);
    log(`🌐 Scrape URL (background tab): ${url}`);
    // Use scrape with url param — FireScrape opens a background tab automatically
    const r = await fsMsg("scrape", { url, skipCache: true }, 30000);
    if (r?.success) {
      log(`✅ Scrape completato`, "ok");
      log(`  Titolo: ${r.metadata?.title || "?"}`, "info");
      log(`  Parole: ${r.stats?.words || "?"}`, "info");
      log(`  Markdown (200ch): ${(r.markdown || "").slice(0, 200)}`, "info");
    } else {
      log(`❌ Scrape fallito: ${r?.error || JSON.stringify(r)}`, "error");
    }
    setRunning(false);
  };

  const testGoogleSearch = async () => {
    setRunning(true);
    const query = "test search lovable";
    log(`🔎 Google Search: "${query}"`);
    const r = await fsMsg("google-search", { query, limit: 3, skipCache: true }, 30000);
    if (r?.success) {
      log(`✅ ${r.count || r.data?.length || 0} risultati`, "ok");
      for (const item of (r.data || [])) {
        log(`  🔗 ${item.title} — ${item.url}`, "info");
      }
    } else {
      log(`❌ Fallito: ${r?.error || JSON.stringify(r)}`, "error");
    }
    setRunning(false);
  };

  const testSnapshot = async () => {
    setRunning(true);
    log("📸 Snapshot DOM...");
    const r = await fsMsg("agent-snapshot", {}, 10000);
    if (r?.success) {
      log(`✅ Snapshot ricevuto (${JSON.stringify(r).length} chars)`, "ok");
      // Show a preview of the structure
      const preview = JSON.stringify(r).slice(0, 500);
      log(`  Preview: ${preview}...`, "info");
    } else {
      log(`❌ Fallito: ${r?.error || JSON.stringify(r)}`, "error");
    }
    setRunning(false);
  };

  const testCacheStats = async () => {
    setRunning(true);
    log("📊 Cache stats...");
    const r = await fsMsg("cache-stats", {}, 5000);
    log(`Risultato: ${JSON.stringify(r, null, 2)}`, r?.success ? "ok" : "error");
    setRunning(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button onClick={testPing} disabled={running} size="sm">🔌 Ping</Button>
        <Button onClick={testScrapeActive} disabled={running} size="sm">📄 Scrape Tab Attivo</Button>
        <Button onClick={testSnapshot} disabled={running} size="sm">📸 Snapshot</Button>
        <Button onClick={testGoogleSearch} disabled={running} size="sm">🔎 Google Search</Button>
        <Button onClick={testCacheStats} disabled={running} size="sm" variant="outline">📊 Cache</Button>
        <Button onClick={() => setLogs([])} size="sm" variant="ghost">🗑️ Pulisci</Button>
      </div>

      <div className="flex gap-2">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="URL da scrappare"
          className="flex-1"
        />
        <Button onClick={testScrapeUrl} disabled={running} size="sm">🌐 Scrape URL</Button>
      </div>

      <Terminal logs={logs} />
    </div>
  );
}

// ━━━━━━━━━━━━ LinkedIn Tab ━━━━━━━━━━━━
const LI_COOLDOWN_MS = 5000;

function LinkedInTest() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [profileUrl, setProfileUrl] = useState("https://www.linkedin.com/in/");
  const [sendUrl, setSendUrl] = useState("");
  const [sendText, setSendText] = useState("Ciao, test da WCA Partner Connect 🚀");
  const [foundThreads, setFoundThreads] = useState<Array<{ name: string; threadUrl?: string }>>([]);
  const actionTimesRef = useRef<number[]>([]);

  const log = useCallback((msg: string, type: LogEntry["type"] = "info") => {
    setLogs((prev) => [...prev, { ts: ts(), msg, type }]);
  }, []);

  const actionsLastHour = actionTimesRef.current.filter(t => Date.now() - t < 3600000).length;

  const runWithCooldown = useCallback(async (fn: () => Promise<void>) => {
    setRunning(true);
    actionTimesRef.current.push(Date.now());
    // prune old entries
    actionTimesRef.current = actionTimesRef.current.filter(t => Date.now() - t < 3600000);
    try {
      await fn();
    } finally {
      log(`⏳ Cooldown ${LI_COOLDOWN_MS / 1000}s...`, "info");
      setCooldown(LI_COOLDOWN_MS / 1000);
      const interval = setInterval(() => {
        setCooldown(prev => {
          if (prev <= 1) { clearInterval(interval); setRunning(false); return 0; }
          return prev - 1;
        });
      }, 1000);
    }
  }, [log]);

  const testPing = () => runWithCooldown(async () => {
    log("🔌 Ping estensione LinkedIn...");
    const r = await liMsg("ping", {}, 5000);
    if (r?.success) log(`✅ Estensione attiva (v${r.version || "?"})`, "ok");
    else log(`❌ Non raggiungibile: ${r?.error || JSON.stringify(r)}`, "error");
  });

  const testSession = () => runWithCooldown(async () => {
    log("🔑 Verifica sessione LinkedIn...");
    const r = await liMsg("verifySession", {}, 30000);
    log(`Risultato: ${JSON.stringify(r, null, 2)}`, r?.authenticated ? "ok" : "warn");
  });

  const testSyncCookie = () => runWithCooldown(async () => {
    log("🍪 Sync cookie li_at...");
    const r = await liMsg("syncCookie", {}, 15000);
    log(`Risultato: ${JSON.stringify(r, null, 2)}`, r?.success ? "ok" : "error");
  });

  const testAutoLogin = () => runWithCooldown(async () => {
    log("🔐 Auto-login LinkedIn...");
    const r = await liMsg("autoLogin", {}, 60000);
    log(`Risultato: ${JSON.stringify(r, null, 2)}`, r?.success ? "ok" : "error");
  });

  const testExtractProfile = () => runWithCooldown(async () => {
    if (!profileUrl || profileUrl === "https://www.linkedin.com/in/") {
      log("⚠️ Inserisci un URL profilo valido", "warn");
      return;
    }
    log(`👤 Estrazione profilo: ${profileUrl}`);
    const r = await liMsg("extractProfile", { url: profileUrl }, 30000);
    if (r?.success && r?.profile) {
      log(`✅ Profilo trovato`, "ok");
      log(`  Nome: ${r.profile.name || "?"}`, "info");
      log(`  Headline: ${r.profile.headline || "?"}`, "info");
      log(`  Location: ${r.profile.location || "?"}`, "info");
      log(`  URL: ${r.profile.profileUrl || "?"}`, "info");
    } else {
      log(`❌ Fallito: ${r?.error || JSON.stringify(r)}`, "error");
    }
  });

  const testSearchProfile = () => runWithCooldown(async () => {
    const query = "Mario Rossi CEO";
    log(`🔎 Ricerca profilo: "${query}"`);
    const r = await liMsg("searchProfile", { query }, 30000);
    log(`Risultato: ${JSON.stringify(r, null, 2).slice(0, 1000)}`, r?.success ? "ok" : "error");
  });

  const testReadInbox = () => runWithCooldown(async () => {
    log("📨 Lettura inbox LinkedIn (30s timeout)...");
    const r = await liMsg("readLinkedInInbox", {}, 35000);
    if (r?.success && r?.threads?.length) {
      log(`✅ Trovati ${r.threads.length} thread`, "ok");
      r.threads.forEach((t: any) => log(`  • ${t.name}: ${t.lastMessage?.slice(0, 60) || "—"} ${t.unread ? "🔴" : ""}`, "info"));
      setFoundThreads(r.threads.map((t: any) => ({ name: t.name, threadUrl: t.threadUrl })));
    } else {
      log(`⚠️ Nessun thread trovato. Risposta: ${JSON.stringify(r, null, 2).slice(0, 500)}`, "warn");
    }
  });

  const testSendMessage = () => runWithCooldown(async () => {
    if (!sendUrl.trim()) {
      log("⚠️ Inserisci l'URL del profilo LinkedIn del destinatario", "warn");
      return;
    }
    if (!sendText.trim()) {
      log("⚠️ Inserisci il testo del messaggio", "warn");
      return;
    }
    log(`📤 Invio messaggio LinkedIn...`);
    log(`  Destinatario: ${sendUrl}`, "info");
    log(`  Testo: "${sendText.slice(0, 80)}..."`, "info");
    const r = await liMsg("sendMessage", { url: sendUrl, message: sendText }, 30000);
    if (r?.success) {
      log(`✅ Messaggio inviato con successo!`, "ok");
      log(`Risposta: ${JSON.stringify(r, null, 2).slice(0, 500)}`, "info");
    } else {
      log(`❌ Invio fallito: ${r?.error || JSON.stringify(r)}`, "error");
      if (r?.error?.includes("timeout")) {
        log("💡 Suggerimento: assicurati che il tab LinkedIn sia attivo e visibile", "warn");
      }
    }
  });

  const testDiagnosticDom = () => runWithCooldown(async () => {
    log("🔬 Diagnostica DOM LinkedIn Messaging...");
    const r = await liMsg("diagnosticLinkedInDom", {}, 35000);
    if (r?.success) {
      log(`📍 URL: ${r.url}`, "info");
      log(`📄 Title: ${r.title}`, "info");
      log(`📏 Body length: ${r.bodyLength} chars`, "info");
      if (r.selectorResults) {
        log(`🎯 Selettori trovati:`, "info");
        Object.entries(r.selectorResults).forEach(([sel, count]) => {
          const c = count as number;
          log(`  ${c > 0 ? "✅" : "❌"} ${sel}: ${c}`, c > 0 ? "ok" : "info");
        });
      }
      if (r.messagingLinks?.length) {
        log(`🔗 Link messaging: ${r.messagingLinks.length}`, "ok");
        r.messagingLinks.forEach((l: string) => log(`  ${l}`, "info"));
      }
      if (r.liClasses?.length) {
        log(`📋 Classi <li> (prime 15):`, "info");
        r.liClasses.slice(0, 15).forEach((c: string) => log(`  ${c}`, "info"));
      }
    } else {
      log(`❌ Diagnostica fallita: ${r?.error || JSON.stringify(r)}`, "error");
    }
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button onClick={testPing} disabled={running} size="sm">🔌 Ping</Button>
        <Button onClick={testSession} disabled={running} size="sm">🔑 Sessione</Button>
        <Button onClick={testSyncCookie} disabled={running} size="sm">🍪 Sync Cookie</Button>
        <Button onClick={testAutoLogin} disabled={running} size="sm">🔐 Auto-Login</Button>
        <Button onClick={testSearchProfile} disabled={running} size="sm">🔎 Search</Button>
        <Button onClick={testReadInbox} disabled={running} size="sm">📨 Leggi Inbox</Button>
        <Button onClick={testDiagnosticDom} disabled={running} size="sm">🔬 Diagnostica DOM</Button>
        <Button onClick={() => setLogs([])} size="sm" variant="ghost">🗑️ Pulisci</Button>
      </div>

      <div className="flex gap-2">
        <Input
          value={profileUrl}
          onChange={(e) => setProfileUrl(e.target.value)}
          placeholder="https://www.linkedin.com/in/nome-profilo"
          className="flex-1"
        />
        <Button onClick={testExtractProfile} disabled={running} size="sm">👤 Estrai Profilo</Button>
      </div>

      <div className="p-3 rounded-lg border border-border bg-muted/30 space-y-2">
        <p className="text-xs font-medium text-muted-foreground">📤 Test Invio Messaggio LinkedIn</p>
        {foundThreads.length > 0 ? (
          <select
            value={sendUrl}
            onChange={(e) => setSendUrl(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">— Seleziona contatto —</option>
            {foundThreads.map((t, i) => (
              <option key={i} value={t.threadUrl || ""}>{t.name}{t.threadUrl ? "" : " (no URL)"}</option>
            ))}
          </select>
        ) : (
          <Input
            value={sendUrl}
            onChange={(e) => setSendUrl(e.target.value)}
            placeholder="URL profilo (prima fai 📨 Leggi Inbox)"
            className="text-sm"
          />
        )}
        <div className="flex gap-2">
          <Input
            value={sendText}
            onChange={(e) => setSendText(e.target.value)}
            placeholder="Testo del messaggio"
            className="flex-1 text-sm"
          />
          <Button onClick={testSendMessage} disabled={running} size="sm" variant="default">📤 Invia LI</Button>
        </div>
      </div>

      <Terminal logs={logs} />
    </div>
  );
}

// ━━━━━━━━━━━━ Reusable Content ━━━━━━━━━━━━
export function TestExtensionsContent() {
  return (
    <Tabs defaultValue="whatsapp" className="w-full">
      <TabsList className="mb-4">
        <TabsTrigger value="whatsapp">💬 WhatsApp</TabsTrigger>
        <TabsTrigger value="linkedin">💼 LinkedIn</TabsTrigger>
        <TabsTrigger value="firescrape">🔥 FireScrape</TabsTrigger>
      </TabsList>

      <TabsContent value="whatsapp">
        <WhatsAppTest />
      </TabsContent>

      <TabsContent value="linkedin">
        <LinkedInTest />
      </TabsContent>

      <TabsContent value="firescrape">
        <FireScrapeTest />
      </TabsContent>
    </Tabs>
  );
}

// ━━━━━━━━━━━━ Main Page ━━━━━━━━━━━━
export default function TestExtensions() {
  return (
    <div className="min-h-screen bg-background text-foreground p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">🧪 Test Estensioni — WhatsApp + LinkedIn + FireScrape</h1>
      <p className="text-muted-foreground text-sm mb-6">
        Test diretto via postMessage. Nessun codice dell'app — solo comunicazione raw con le estensioni.
      </p>
      <TestExtensionsContent />
    </div>
  );
}
