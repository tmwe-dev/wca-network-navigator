import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";

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

const liMsg = (action: string, payload = {}, timeout = 30000) =>
  sendToExtension("from-webapp-li", "from-extension-li", action, payload, timeout);

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

  const log = useCallback((msg: string, type: LogEntry["type"] = "info") => {
    setLogs((prev) => [...prev, { ts: ts(), msg, type }]);
  }, []);

  const testPing = async () => {
    setRunning(true);
    log("🔌 Ping estensione WhatsApp...");
    const r = await waMsg("ping", {}, 5000);
    if (r?.success) log(`✅ Estensione attiva (v${r.version || "?"})`, "ok");
    else log(`❌ Non raggiungibile: ${r?.error || JSON.stringify(r)}`, "error");
    setRunning(false);
  };

  const testSession = async () => {
    setRunning(true);
    log("🔑 Verifica sessione WhatsApp Web...");
    const r = await waMsg("verifySession", {}, 30000);
    log(`Risultato: ${JSON.stringify(r, null, 2)}`, r?.authenticated ? "ok" : "warn");
    setRunning(false);
  };

  const testReadUnread = async () => {
    setRunning(true);
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
      log("Possibili cause:", "warn");
      log("  1. WhatsApp Web non è aperto/loggato", "warn");
      log("  2. I selettori CSS sono cambiati", "warn");
      log("  3. La sidebar non è ancora renderizzata", "warn");
    }

    setRunning(false);
  };

  const testRawDom = async () => {
    setRunning(true);
    log("🔍 Test DOM diretto — cerco selettori sulla pagina WA...");
    
    // Ask the extension to execute a diagnostic script
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
    log(`🌐 Navigazione + scrape: ${url}`);
    // Navigate first
    const nav = await fsMsg("agent-action", { step: { action: "navigate", url } }, 20000);
    if (!nav?.success) {
      log(`❌ Navigazione fallita: ${nav?.error || JSON.stringify(nav)}`, "error");
      setRunning(false);
      return;
    }
    log("✅ Pagina caricata, attendo render...", "ok");
    await new Promise(r => setTimeout(r, 2500));
    
    const r = await fsMsg("scrape", { skipCache: true }, 20000);
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
function LinkedInTest() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [profileUrl, setProfileUrl] = useState("https://www.linkedin.com/in/");

  const log = useCallback((msg: string, type: LogEntry["type"] = "info") => {
    setLogs((prev) => [...prev, { ts: ts(), msg, type }]);
  }, []);

  const testPing = async () => {
    setRunning(true);
    log("🔌 Ping estensione LinkedIn...");
    const r = await liMsg("ping", {}, 5000);
    if (r?.success) log(`✅ Estensione attiva (v${r.version || "?"})`, "ok");
    else log(`❌ Non raggiungibile: ${r?.error || JSON.stringify(r)}`, "error");
    setRunning(false);
  };

  const testSession = async () => {
    setRunning(true);
    log("🔑 Verifica sessione LinkedIn...");
    const r = await liMsg("verifySession", {}, 30000);
    log(`Risultato: ${JSON.stringify(r, null, 2)}`, r?.authenticated ? "ok" : "warn");
    setRunning(false);
  };

  const testSyncCookie = async () => {
    setRunning(true);
    log("🍪 Sync cookie li_at...");
    const r = await liMsg("syncCookie", {}, 15000);
    log(`Risultato: ${JSON.stringify(r, null, 2)}`, r?.success ? "ok" : "error");
    setRunning(false);
  };

  const testAutoLogin = async () => {
    setRunning(true);
    log("🔐 Auto-login LinkedIn...");
    const r = await liMsg("autoLogin", {}, 60000);
    log(`Risultato: ${JSON.stringify(r, null, 2)}`, r?.success ? "ok" : "error");
    setRunning(false);
  };

  const testExtractProfile = async () => {
    if (!profileUrl || profileUrl === "https://www.linkedin.com/in/") {
      log("⚠️ Inserisci un URL profilo valido", "warn");
      return;
    }
    setRunning(true);
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
    setRunning(false);
  };

  const testSearchProfile = async () => {
    setRunning(true);
    const query = "Mario Rossi CEO";
    log(`🔎 Ricerca profilo: "${query}"`);
    const r = await liMsg("searchProfile", { query }, 30000);
    log(`Risultato: ${JSON.stringify(r, null, 2).slice(0, 1000)}`, r?.success ? "ok" : "error");
    setRunning(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button onClick={testPing} disabled={running} size="sm">🔌 Ping</Button>
        <Button onClick={testSession} disabled={running} size="sm">🔑 Sessione</Button>
        <Button onClick={testSyncCookie} disabled={running} size="sm">🍪 Sync Cookie</Button>
        <Button onClick={testAutoLogin} disabled={running} size="sm">🔐 Auto-Login</Button>
        <Button onClick={testSearchProfile} disabled={running} size="sm">🔎 Search</Button>
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

      <Terminal logs={logs} />
    </div>
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
    </div>
  );
}
  return (
    <div className="min-h-screen bg-background text-foreground p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">🧪 Test Estensioni — WhatsApp + FireScrape</h1>
      <p className="text-muted-foreground text-sm mb-6">
        Test diretto via postMessage. Nessun codice dell'app — solo comunicazione raw con le estensioni.
      </p>

      <Tabs defaultValue="whatsapp" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="whatsapp">💬 WhatsApp</TabsTrigger>
          <TabsTrigger value="firescrape">🔥 FireScrape</TabsTrigger>
        </TabsList>

        <TabsContent value="whatsapp">
          <WhatsAppTest />
        </TabsContent>

        <TabsContent value="firescrape">
          <FireScrapeTest />
        </TabsContent>
      </Tabs>
    </div>
  );
}
