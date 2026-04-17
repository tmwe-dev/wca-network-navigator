/**
 * LinkedInTest — LinkedIn extension testing tab
 */
import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Terminal, type LogEntry, ts } from "./Terminal";
import { liMsg } from "./extensionBridge";
import { subscribeOptimusEvents } from "@/hooks/useOptimusBridgeListener";

const LI_COOLDOWN_MS = 5000;

interface FoundThread {
  name: string;
  threadUrl?: string;
}

export function LinkedInTest() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [profileUrl, setProfileUrl] = useState("https://www.linkedin.com/in/");
  const [sendUrl, setSendUrl] = useState("");
  const [sendText, setSendText] = useState("Ciao, test da WCA Partner Connect 🚀");
  const [foundThreads, setFoundThreads] = useState<FoundThread[]>([]);
  const actionTimesRef = useRef<number[]>([]);

  const log = useCallback((msg: string, type: LogEntry["type"] = "info") => {
    setLogs((prev) => [...prev, { ts: ts(), msg, type }]);
  }, []);

  const actionsLastHour = actionTimesRef.current.filter(t => Date.now() - t < 3600000).length;

  const runWithCooldown = useCallback(async (fn: () => Promise<void>) => {
    setRunning(true);
    actionTimesRef.current.push(Date.now());
    actionTimesRef.current = actionTimesRef.current.filter(t => Date.now() - t < 3600000);
    try { await fn(); } finally {
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
    if (!profileUrl || profileUrl === "https://www.linkedin.com/in/") { log("⚠️ Inserisci un URL profilo valido", "warn"); return; }
    log(`👤 Estrazione profilo: ${profileUrl}`);
    const r = await liMsg("extractProfile", { url: profileUrl }, 30000);
    const profile = r?.profile as Record<string, unknown> | undefined;
    if (r?.success && profile) {
      log(`✅ Profilo trovato`, "ok");
      log(`  Nome: ${profile.name || "?"}`, "info");
      log(`  Headline: ${profile.headline || "?"}`, "info");
      log(`  Location: ${profile.location || "?"}`, "info");
      log(`  URL: ${profile.profileUrl || "?"}`, "info");
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
    const threads = (r?.threads || []) as Array<Record<string, unknown>>;
    if (r?.success && threads.length) {
      log(`✅ Trovati ${threads.length} thread`, "ok");
      threads.forEach((t) => log(`  • ${t.name}: ${((t.lastMessage as string) || "").slice(0, 60) || "—"} ${t.unread ? "🔴" : ""}`, "info"));
      setFoundThreads(threads.map((t) => ({ name: t.name as string, threadUrl: t.threadUrl as string | undefined })));
    } else {
      log(`⚠️ Nessun thread trovato. Risposta: ${JSON.stringify(r, null, 2).slice(0, 500)}`, "warn");
    }
  });

  const testSendMessage = () => runWithCooldown(async () => {
    if (!sendUrl.trim()) { log("⚠️ Inserisci l'URL del profilo LinkedIn del destinatario", "warn"); return; }
    if (!sendText.trim()) { log("⚠️ Inserisci il testo del messaggio", "warn"); return; }
    log(`📤 Invio messaggio LinkedIn...`);
    log(`  Destinatario: ${sendUrl}`, "info");
    log(`  Testo: "${sendText.slice(0, 80)}..."`, "info");
    const r = await liMsg("sendMessage", { url: sendUrl, message: sendText }, 30000);
    if (r?.success) {
      log(`✅ Messaggio inviato con successo!`, "ok");
      log(`Risposta: ${JSON.stringify(r, null, 2).slice(0, 500)}`, "info");
    } else {
      log(`❌ Invio fallito: ${r?.error || JSON.stringify(r)}`, "error");
      if (String(r?.error || "").includes("timeout")) {
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
      const selResults = r.selectorResults as Record<string, number> | undefined;
      if (selResults) {
        log(`🎯 Selettori trovati:`, "info");
        Object.entries(selResults).forEach(([sel, count]) => {
          log(`  ${count > 0 ? "✅" : "❌"} ${sel}: ${count}`, count > 0 ? "ok" : "info");
        });
      }
      const msgLinks = (r.messagingLinks || []) as string[];
      if (msgLinks.length) {
        log(`🔗 Link messaging: ${msgLinks.length}`, "ok");
        msgLinks.forEach((l) => log(`  ${l}`, "info"));
      }
      const liClasses = (r.liClasses || []) as string[];
      if (liClasses.length) {
        log(`📋 Classi <li> (prime 15):`, "info");
        liClasses.slice(0, 15).forEach((c) => log(`  ${c}`, "info"));
      }
    } else {
      log(`❌ Diagnostica fallita: ${r?.error || JSON.stringify(r)}`, "error");
    }
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
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
        <div className="flex items-center gap-2 ml-auto">
          {cooldown > 0 && <span className="text-xs font-mono text-yellow-500 animate-pulse">⏳ {cooldown}s</span>}
          <span className={`text-xs font-mono px-2 py-0.5 rounded ${actionsLastHour > 15 ? "bg-red-500/20 text-red-400" : actionsLastHour > 8 ? "bg-yellow-500/20 text-yellow-400" : "bg-green-500/20 text-green-400"}`}>
            LI: {actionsLastHour}/h
          </span>
        </div>
      </div>

      <div className="flex gap-2">
        <Input value={profileUrl} onChange={(e) => setProfileUrl(e.target.value)} placeholder="https://www.linkedin.com/in/nome-profilo" className="flex-1" />
        <Button onClick={testExtractProfile} disabled={running} size="sm">👤 Estrai Profilo</Button>
      </div>

      <div className="p-3 rounded-lg border border-border bg-muted/30 space-y-2">
        <p className="text-xs font-medium text-muted-foreground">📤 Test Invio Messaggio LinkedIn</p>
        {foundThreads.length > 0 ? (
          <select value={sendUrl} onChange={(e) => setSendUrl(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="">— Seleziona contatto —</option>
            {foundThreads.map((t, i) => (<option key={i} value={t.threadUrl || ""}>{t.name}{t.threadUrl ? "" : " (no URL)"}</option>))}
          </select>
        ) : (
          <Input value={sendUrl} onChange={(e) => setSendUrl(e.target.value)} placeholder="URL profilo (prima fai 📨 Leggi Inbox)" className="text-sm" />
        )}
        <div className="flex gap-2">
          <Input value={sendText} onChange={(e) => setSendText(e.target.value)} placeholder="Testo del messaggio" className="flex-1 text-sm" />
          <Button onClick={testSendMessage} disabled={running} size="sm" variant="default">📤 Invia LI</Button>
        </div>
      </div>
      <Terminal logs={logs} />
    </div>
  );
}
