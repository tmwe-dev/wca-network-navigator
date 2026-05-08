/**
 * LinkedInTest — LinkedIn extension testing tab
 */
import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Terminal, type LogEntry, ts } from "./Terminal";
import { liMsg } from "./extensionBridge";
import { LINKEDIN_EXTENSION_REQUIRED_VERSION } from "@/lib/whatsappExtensionZip";
import { subscribeOptimusEvents } from "@/hooks/useOptimusBridgeListener";
import { SyncGuardIndicator } from "@/v2/ui/atoms/SyncGuardIndicator";
import { tryAcquire, throttle, SyncGuardBusyError } from "@/lib/syncGuard";

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

  // Stream Optimus events into the LinkedIn terminal
  useEffect(() => {
    return subscribeOptimusEvents((e) => {
      if (e.channel !== "linkedin") return;
      if (e.kind === "cache-hit") {
        log(`🤖 Optimus: piano cache (v${e.planVersion}) · ${e.pageType}`, "ok");
      } else if (e.kind === "ai-fresh") {
        log(`🤖 Optimus: nuovo piano AI generato in ${e.latencyMs}ms · confidence ${(e.confidence * 100).toFixed(0)}% · v${e.planVersion}`, "info");
      } else if (e.kind === "stale") {
        log(`⚠️ Optimus: AI non risponde, uso ultimo piano cache (stale) · ${e.pageType}`, "warn");
      } else if (e.kind === "error") {
        log(`❌ Optimus: ${e.error}`, "error");
      }
    });
  }, [log]);

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
    let r = await liMsg("verifySession", {}, 60000);
    if (!r?.success && /timeout/i.test(String(r?.error || ""))) {
      log("⏳ Timeout, attendo 3s e riprovo...", "warn");
      await new Promise((res) => setTimeout(res, 3000));
      r = await liMsg("verifySession", {}, 60000);
    }
    const reason = String((r as Record<string, unknown>)?.reason || "");
    if (r?.authenticated) {
      log(`✅ Sessione attiva (${reason || "ok"})`, "ok");
    } else if (reason === "auth_required") {
      log("🔐 Devi loggarti su linkedin.com nella tab dell'estensione, poi riprova.", "warn");
    } else if (reason === "checkpoint") {
      log("🛡️ LinkedIn richiede verifica/captcha — completala nella tab e riprova.", "warn");
    } else if (reason === "loading") {
      log("⏳ LinkedIn ancora in caricamento — riprova fra qualche secondo.", "warn");
    } else if (reason === "no_cookie") {
      log("🍪 Nessun cookie li_at trovato — fai login su linkedin.com.", "warn");
    } else {
      log(`⚠️ Sessione non confermata: ${JSON.stringify(r, null, 2)}`, "warn");
    }
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

    // Inline Optimus summary
    const opt = r?.optimus as { cached?: boolean; planVersion?: number; confidence?: number; latencyMs?: number; dropped?: number } | undefined;
    if (opt) {
      const tag = opt.cached ? "cache" : "AI fresh";
      const conf = typeof opt.confidence === "number" ? `${(opt.confidence * 100).toFixed(0)}%` : "n/d";
      const lat = opt.latencyMs ? `${opt.latencyMs}ms` : "—";
      const dropped = typeof opt.dropped === "number" && opt.dropped > 0 ? ` · ${opt.dropped} scartati (dati insufficienti)` : "";
      log(`🤖 Optimus: piano [${tag}] · confidence ${conf} · ${threads.length} estratti in ${lat}${dropped}`, opt.cached ? "ok" : "info");
    } else if (r?.method && String(r.method).startsWith("legacy")) {
      log(`⚠️ Optimus non disponibile, fallback ${r.method}`, "warn");
    }

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
    // Pre-flight: verifica versione estensione installata
    try {
      const pong = await liMsg("ping", {}, 4000) as { success?: boolean; version?: string };
      const installed = pong?.version || "?";
      const required = LINKEDIN_EXTENSION_REQUIRED_VERSION;
      if (installed !== required) {
        log(`⚠️ Estensione installata: v${installed} — richiesta v${required}. Rimuovi la vecchia da chrome://extensions e ricarica lo zip aggiornato.`, "warn");
      } else {
        log(`🔧 Estensione installata: v${installed} (OK)`, "info");
      }
    } catch {
      log(`⚠️ Ping estensione fallito — installata?`, "warn");
    }
    log(`📤 Invio messaggio LinkedIn...`);
    log(`  Destinatario: ${sendUrl}`, "info");
    log(`  Testo: "${sendText.slice(0, 80)}..."`, "info");
    const r = await liMsg("sendMessage", { url: sendUrl, message: sendText }, 90000);
    if (r?.success) {
      log(`✅ Messaggio inviato con successo!`, "ok");
      log(`Risposta: ${JSON.stringify(r, null, 2).slice(0, 500)}`, "info");
    } else {
      const errStr = String(r?.error || JSON.stringify(r));
      // Estrai eventuale probe diagnostico
      const probeMatch = errStr.match(/__probe__=(\{.*\})$/);
      if (probeMatch) {
        log(`❌ Invio fallito: ${errStr.slice(0, errStr.indexOf("__probe__")).trim()}`, "error");
        try {
          const probe = JSON.parse(probeMatch[1]) as Record<string, unknown>;
          log(`🔬 DOM probe:`, "info");
          log(`  • URL: ${probe.href}`, "info");
          log(`  • contenteditable: ${probe.contenteditable} | role=textbox: ${probe.roleTextbox}`, "info");
          log(`  • msg-overlay: ${probe.msgOverlay} | dialog aperti: ${probe.dialogs} | <main>: ${probe.hasMain}`, "info");
          if (probe.dialogText) log(`  • Dialog text: "${String(probe.dialogText).slice(0, 120)}"`, "info");
          if (Array.isArray(probe.dialogButtons) && probe.dialogButtons.length) {
            log(`  • Dialog buttons: ${(probe.dialogButtons as string[]).join(" | ")}`, "info");
          }
        } catch { /* ignora parse */ }
      } else {
        log(`❌ Invio fallito: ${errStr}`, "error");
      }
      if (String(r?.error || "").includes("timeout")) {
        log("💡 Suggerimento: assicurati che il tab LinkedIn sia attivo e visibile", "warn");
      }
    }
  });

  // ── DIAGNOSTIC: 3 metodi di click isolati ──
  // Permette di capire quale meccanismo di click sul pulsante "Invia"
  // funziona meglio nel composer LinkedIn corrente, senza che la cascata
  // di fallback nasconda quale metodo ha effettivamente vinto.
  const testSendWithMethod = (method: "physical_click" | "form_submit" | "keyboard_shortcut", emoji: string, label: string) => runWithCooldown(async () => {
    if (!sendUrl.trim()) { log("⚠️ Inserisci l'URL del profilo LinkedIn del destinatario", "warn"); return; }
    if (!sendText.trim()) { log("⚠️ Inserisci il testo del messaggio", "warn"); return; }
    log(`${emoji} Test metodo: ${label} (${method})`);
    log(`  Destinatario: ${sendUrl}`, "info");
    const r = await liMsg("sendMessageWithMethod", { url: sendUrl, message: sendText, method }, 90000);
    if (r?.success) {
      log(`✅ ${label}: messaggio inviato! (method=${r.method || method})`, "ok");
    } else {
      const errStr = String(r?.error || JSON.stringify(r));
      const attempted = (r as Record<string, unknown>)?.attempted_method as string | undefined;
      log(`❌ ${label} fallito${attempted ? ` (attempted=${attempted})` : ""}: ${errStr}`, "error");
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

  // ── Verifica Controllo Tempi: dimostra il poliziotto in azione ──
  const testGuardSequence = () => runWithCooldown(async () => {
    log("🛡️ Avvio verifica Controllo Tempi (mutex + cooldown reali)...");
    let guard;
    try {
      guard = tryAcquire("linkedin", "Test Controllo Tempi");
    } catch (e) {
      if (e instanceof SyncGuardBusyError) {
        window.dispatchEvent(new CustomEvent("sync-guard-blocked", { detail: { channel: "linkedin" } }));
        log(`⛔ Mutex già occupato: ${e.message}`, "error");
        return;
      }
      throw e;
    }
    try {
      log("→ throttle('ping'): osserva il badge passare in 'Pausa Xs'", "info");
      await throttle("linkedin", "ping", "Demo: ping");
      log("→ throttle('open'): apertura simulata thread", "info");
      await throttle("linkedin", "open", "Demo: apri thread");
      log("→ throttle('read'): lettura simulata", "info");
      await throttle("linkedin", "read", "Demo: leggi");
      log("→ throttle('betweenThreads'): pausa lunga tra thread", "info");
      await throttle("linkedin", "betweenThreads", "Demo: pausa thread");
      log("✅ Sequenza completata. Tutto serializzato, nessuna sovrapposizione.", "ok");
    } finally {
      guard.release();
    }
  });

  const testGuardConcurrent = () => runWithCooldown(async () => {
    log("🚦 Verifica blocco concorrenza: tento 2 acquire in parallelo...", "info");
    let g1;
    try {
      g1 = tryAcquire("linkedin", "Concorrenza A");
    } catch (e) {
      log(`❌ Già occupato: ${(e as Error).message}`, "error");
      return;
    }
    try {
      try {
        tryAcquire("linkedin", "Concorrenza B");
        log("❌ ERRORE: il secondo acquire è passato (mutex rotto!)", "error");
      } catch (e) {
        if (e instanceof SyncGuardBusyError) {
          window.dispatchEvent(new CustomEvent("sync-guard-blocked", { detail: { channel: "linkedin" } }));
          log(`✅ Bloccato come previsto: ${e.message}`, "ok");
        }
      }
      await throttle("linkedin", "read", "Concorrenza: rilascio");
    } finally {
      g1.release();
      log("🔓 Mutex rilasciato.", "ok");
    }
  });

  const testRemapSendDom = () => runWithCooldown(async () => {
    log("🔧 Rimappa DOM invio: l'AI sta studiando LinkedIn Messaging + Profile...");
    const r = await liMsg("remapSendDom", {}, 90000);
    if (r?.success) {
      log(`✅ Mappa LinkedIn aggiornata`, "ok");
      const mf = (r.messagingFields as string[]) || [];
      const pf = (r.profileFields as string[]) || [];
      log(`  • messaging fields: ${mf.length ? mf.join(", ") : "—"}`, mf.length ? "info" : "warn");
      log(`  • profile fields: ${pf.length ? pf.join(", ") : "—"}`, pf.length ? "info" : "warn");
      log("Riprova ora l'invio: il sistema userà i nuovi schemi appresi.", "ok");
    } else {
      log(`❌ Rimappatura fallita: ${r?.error || JSON.stringify(r)}`, "error");
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
          <Button onClick={testRemapSendDom} disabled={running} size="sm" variant="outline" title="L'AI rilegge il DOM e salva schemi freschi per l'invio. Usalo se l'invio fallisce dopo un aggiornamento di LinkedIn.">🔧 Rimappa DOM invio</Button>
          <Button onClick={testGuardSequence} disabled={running} size="sm" variant="secondary">🛡️ Verifica Controllo</Button>
          <Button onClick={testGuardConcurrent} disabled={running} size="sm" variant="secondary">🚦 Test Concorrenza</Button>
          <Button onClick={() => setLogs([])} size="sm" variant="ghost">🗑️ Pulisci</Button>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <SyncGuardIndicator channel="linkedin" />
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
        {foundThreads.length > 0 && (
          <select value={sendUrl} onChange={(e) => setSendUrl(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="">— Seleziona contatto dalla rubrica (o incolla URL sotto) —</option>
            {foundThreads.map((t, i) => (<option key={i} value={t.threadUrl || ""}>{t.name}{t.threadUrl ? "" : " (no URL)"}</option>))}
          </select>
        )}
        <div className="flex gap-2">
          <Input
            value={sendUrl}
            onChange={(e) => setSendUrl(e.target.value)}
            placeholder="Incolla URL profilo LinkedIn (es. https://www.linkedin.com/in/...)"
            className="flex-1 text-sm"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              if (profileUrl && profileUrl !== "https://www.linkedin.com/in/") {
                setSendUrl(profileUrl);
                log(`📥 URL copiato dal campo "Estrai Profilo": ${profileUrl}`, "info");
              } else {
                log("⚠️ Inserisci prima un URL nel campo 'Estrai Profilo' qui sopra", "warn");
              }
            }}
            title="Copia l'URL dal campo Estrai Profilo qui sopra"
          >
            ⬆️ Usa URL sopra
          </Button>
        </div>
        <div className="flex gap-2">
          <Input value={sendText} onChange={(e) => setSendText(e.target.value)} placeholder="Testo del messaggio" className="flex-1 text-sm" />
          <Button onClick={testSendMessage} disabled={running} size="sm" variant="default">📤 Invia LI</Button>
        </div>
        <div className="flex flex-wrap gap-2 pt-1 border-t border-border/50 mt-1">
          <span className="text-[11px] text-muted-foreground self-center mr-1">🧪 Test isolati click invio:</span>
          <Button onClick={() => testSendWithMethod("physical_click", "🖱️", "Click fisico")} disabled={running} size="sm" variant="outline" title="pointerdown/mousedown/click con coordinate reali">🖱️ Click fisico</Button>
          <Button onClick={() => testSendWithMethod("form_submit", "📋", "Form submit")} disabled={running} size="sm" variant="outline" title="form.requestSubmit() sul .msg-form">📋 Form submit</Button>
          <Button onClick={() => testSendWithMethod("keyboard_shortcut", "⌨️", "Ctrl+Enter")} disabled={running} size="sm" variant="outline" title="Ctrl+Enter (Cmd+Enter su Mac)">⌨️ Ctrl+Enter</Button>
        </div>
      </div>
      <Terminal logs={logs} />
    </div>
  );
}
