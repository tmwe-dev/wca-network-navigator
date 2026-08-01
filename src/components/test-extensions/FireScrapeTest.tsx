/**
 * FireScrapeTest — FireScrape extension testing tab
 */
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Terminal, type LogEntry, ts } from "./Terminal";
import { fsMsg } from "./extensionBridge";

export function FireScrapeTest() {
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
      const meta = r.metadata as Record<string, unknown> | undefined;
      const stats = r.stats as Record<string, unknown> | undefined;
      log(`✅ Scrape completato`, "ok");
      log(`  Titolo: ${meta?.title || "?"}`, "info");
      log(`  URL: ${meta?.url || "?"}`, "info");
      log(`  Parole: ${stats?.words || "?"} | Tempo lettura: ${stats?.readingTime || "?"}`, "info");
      log(`  Markdown preview: ${((r.markdown as string) || "").slice(0, 200)}...`, "info");
    } else {
      log(`❌ Fallito: ${r?.error || JSON.stringify(r)}`, "error");
    }
    setRunning(false);
  };

  const testScrapeUrl = async () => {
    setRunning(true);
    log(`🌐 Scrape URL (background tab): ${url}`);
    const r = await fsMsg("scrape", { url, skipCache: true }, 30000);
    if (r?.success) {
      const meta = r.metadata as Record<string, unknown> | undefined;
      const stats = r.stats as Record<string, unknown> | undefined;
      log(`✅ Scrape completato`, "ok");
      log(`  Titolo: ${meta?.title || "?"}`, "info");
      log(`  Parole: ${stats?.words || "?"}`, "info");
      log(`  Markdown (200ch): ${((r.markdown as string) || "").slice(0, 200)}`, "info");
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
      const data = (r.data || []) as Array<Record<string, unknown>>;
      log(`✅ ${r.count || data.length || 0} risultati`, "ok");
      for (const item of data) {
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
      log(`  Preview: ${JSON.stringify(r).slice(0, 500)}...`, "info");
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
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="URL da scrappare" className="flex-1" />
        <Button onClick={testScrapeUrl} disabled={running} size="sm">🌐 Scrape URL</Button>
      </div>
      <Terminal logs={logs} />
    </div>
  );
}
