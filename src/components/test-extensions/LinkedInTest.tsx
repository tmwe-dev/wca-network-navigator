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

// Area di TEST manuale: l'operatore guida il ritmo, non serve gating anti-throttle
// di produzione. Cooldown ridotti al minimo per "parti e vai" come WhatsApp test.
const LI_COOLDOWN_MS = 800;
const LI_DIAGNOSTIC_COOLDOWN_MS = 300;
const LI_FIXED_RECIPIENT_KEY = "li_test_fixed_recipient";

interface StoredLiTestRecipient {
  url?: string;
  savedAt?: string;
}

function isValidLinkedInTestUrl(raw: string): boolean {
  return /^https:\/\/(www\.)?linkedin\.com\/(in|messaging\/thread)\//i.test(raw.trim());
}

interface FoundThread {
  name: string;
  threadUrl?: string;
}

interface SyncQualitySummary {
  newMessages: number;
  rawCandidates: number;
  threadsAccepted: number;
  threadsDropped: Record<string, number>;
  messagesAccepted: number;
  messagesDropped: Record<string, number>;
  methods: Record<string, number>;
  avgConfidence: number;
  warnings: string[];
  at: number;
}

export function LinkedInTest() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [profileUrl, setProfileUrl] = useState("https://www.linkedin.com/in/");
  const [sendUrl, setSendUrl] = useState("");
  const [sendText, setSendText] = useState("Ciao, test da WCA Partner Connect 🚀");
  const [threadUrl, setThreadUrl] = useState("");
  const [lastKnownText, setLastKnownText] = useState("");
  const [foundThreads, setFoundThreads] = useState<FoundThread[]>([]);
  const [quality, setQuality] = useState<SyncQualitySummary | null>(null);
  // v3.9.50 — modalità composer (default safe background).
  const [composerMode, setComposerMode] = useState<"background_existing_composer" | "interactive_open_composer">(
    "background_existing_composer"
  );
  const actionTimesRef = useRef<number[]>([]);

  const log = useCallback((msg: string, type: LogEntry["type"] = "info") => {
    setLogs((prev) => [...prev, { ts: ts(), msg, type }]);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LI_FIXED_RECIPIENT_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as StoredLiTestRecipient;
      const fixedUrl = saved?.url?.trim();
      if (fixedUrl && isValidLinkedInTestUrl(fixedUrl)) {
        setSendUrl(fixedUrl);
        setProfileUrl(fixedUrl.includes("/in/") ? fixedUrl : "https://www.linkedin.com/in/");
        log(`📌 Destinatario FISSO LinkedIn: ${fixedUrl}. Non viene aggiornato dagli invii successivi.`, "info");
      }
    } catch { /* ignore */ }
  }, [log]);

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

  // P2.3 — Pannello qualità sync: ascolta `li-sync-completed`.
  useEffect(() => {
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent<SyncQualitySummary>).detail;
      if (detail && typeof detail === "object" && "rawCandidates" in detail) setQuality(detail);
    };
    window.addEventListener("li-sync-completed", handler as EventListener);
    return () => window.removeEventListener("li-sync-completed", handler as EventListener);
  }, []);

  const actionsLastHour = actionTimesRef.current.filter(t => Date.now() - t < 3600000).length;

  const resolveThreadTarget = useCallback(() => {
    const candidates = [threadUrl, sendUrl, profileUrl, lastKnownText]
      .map((value) => value.trim())
      .filter((value) => value && value !== "https://www.linkedin.com/in/");
    return candidates.find(isValidLinkedInTestUrl) || "";
  }, [lastKnownText, profileUrl, sendUrl, threadUrl]);

  const runWithCooldown = useCallback(async (fn: () => Promise<void>, cooldownMs: number = LI_COOLDOWN_MS) => {
    setRunning(true);
    actionTimesRef.current.push(Date.now());
    actionTimesRef.current = actionTimesRef.current.filter(t => Date.now() - t < 3600000);
    try { await fn(); } finally {
      log(`⏳ Cooldown ${cooldownMs / 1000}s...`, "info");
      setCooldown(Math.max(1, Math.round(cooldownMs / 1000)));
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

  const testProbeComposer = () => runWithCooldown(async () => {
    log("🔬 Probe composer LinkedIn (4s, focus-safe, nessun click su 'Messaggia')...");
    const r = await liMsg("probeComposer", { url: sendUrl.trim() || profileUrl.trim() }, 8000) as Record<string, unknown>;
    if (r?.success) {
      log(`✅ Composer LinkedIn aperto su tab ${r.tabId} (${String(r.tabUrl || "").slice(0, 80)})`, "ok");
    } else {
      const errStr = String(r?.error || JSON.stringify(r));
      log(`❌ Composer non aperto: ${errStr}`, "error");
      log("💡 Apri manualmente la chat LinkedIn col destinatario e lascia il box messaggio visibile, poi riprova.", "warn");
    }
  });

  const testSendMessage = () => runWithCooldown(async () => {
    if (!sendUrl.trim()) { log("⚠️ URL fisso LinkedIn mancante: inseriscilo una volta e premi 📌 Fissa test", "warn"); return; }
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
    const modeLabel = composerMode === "background_existing_composer"
      ? "background — usa SOLO composer già aperto (consigliato, fail veloce)"
      : "interactive — porta LinkedIn in primo piano e apre il composer";
    log(`📤 Invio messaggio LinkedIn (mode: ${modeLabel})...`);
    log(`  Destinatario: ${sendUrl}`, "info");
    log(`  Testo: "${sendText.slice(0, 80)}..."`, "info");
    // Background mode: probe ≤4s + invio. Interactive mode: navigate + click Messaggia + gate 30s + invio.
    const timeoutMs = composerMode === "background_existing_composer" ? 12000 : 45000;
    const r = await liMsg(
      "sendMessageWithMethod",
      { url: sendUrl, message: sendText, method: "physical_click", mode: composerMode },
      timeoutMs,
    );
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
      const e = String(r?.error || "");
      if (/composer_not_open_background_mode/i.test(e)) {
        log("💡 Background mode: apri manualmente la chat LinkedIn col destinatario, lascia il box messaggio visibile, poi riprova. Oppure passa a modalità Interactive.", "warn");
      } else if (/open_composer_failed_interactive/i.test(e)) {
        log("💡 Interactive mode: il bottone 'Messaggia' non è stato trovato. Verifica captcha/login challenge LinkedIn.", "warn");
      } else if (/composer_gate_failed_interactive/i.test(e)) {
        log("💡 Interactive mode: composer non montato entro 30s. Verifica che la pagina profilo sia raggiungibile e non bloccata.", "warn");
      } else if (/no_existing_linkedin_tab/i.test(e)) {
        log("💡 Apri almeno una tab LinkedIn (qualsiasi pagina) e riprova.", "warn");
      }
    }
  });

  // ── DIAGNOSTIC: 3 metodi di click isolati ──
  // Permette di capire quale meccanismo di click sul pulsante "Invia"
  // funziona meglio nel composer LinkedIn corrente, senza che la cascata
  // di fallback nasconda quale metodo ha effettivamente vinto.
  const testSendWithMethod = (method: "physical_click" | "form_submit" | "keyboard_shortcut" | "cdp_physical_click" | "cdp_ctrl_enter", emoji: string, label: string) => runWithCooldown(async () => {
    if (!sendUrl.trim()) { log("⚠️ URL fisso LinkedIn mancante: inseriscilo una volta e premi 📌 Fissa test", "warn"); return; }
    if (!sendText.trim()) { log("⚠️ Inserisci il testo del messaggio", "warn"); return; }
    log(`${emoji} Test metodo: ${label} (${method}) — mode=${composerMode}`);
    log(`  Destinatario: ${sendUrl}`, "info");
    const timeoutMs = composerMode === "background_existing_composer" ? 12000 : 45000;
    const r = await liMsg("sendMessageWithMethod", { url: sendUrl, message: sendText, method, mode: composerMode }, timeoutMs);
    if (r?.success) {
      log(`✅ ${label}: messaggio inviato! (method=${r.method || method})`, "ok");
    } else {
      const errStr = String(r?.error || JSON.stringify(r));
      const attempted = (r as Record<string, unknown>)?.attempted_method as string | undefined;
      log(`❌ ${label} fallito${attempted ? ` (attempted=${attempted})` : ""}: ${errStr}`, "error");
      if (/no_existing_linkedin_tab/i.test(errStr)) {
        log("💡 Apri almeno una tab LinkedIn (qualsiasi pagina) e riprova: l'estensione la userà in background.", "warn");
      } else if (/composer_not_open_background_mode/i.test(errStr)) {
        log("💡 Apri manualmente la chat LinkedIn col destinatario (background mode) o passa a Interactive.", "warn");
      } else if (/open_composer_failed_interactive|composer_gate_failed_interactive/i.test(errStr)) {
        log("💡 Il bottone Messaggia non è apparso sul profilo (forse non sei collegato o il profilo non accetta messaggi).", "warn");
      }
    }
  }, LI_DIAGNOSTIC_COOLDOWN_MS);

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

  // P0.5 — Diagnostic: leggi un singolo thread (Optimus → AX → structural).
  const testReadThread = () => runWithCooldown(async () => {
    const targetThreadUrl = resolveThreadTarget();
    if (!targetThreadUrl) { log("⚠️ Inserisci un URL LinkedIn valido oppure usa il destinatario fisso già salvato", "warn"); return; }
    if (!threadUrl.trim()) log(`📌 Uso URL LinkedIn già disponibile: ${targetThreadUrl}`, "info");
    log(`💬 Lettura thread: ${targetThreadUrl}`);
    const r = await liMsg("readLinkedInThread", { threadUrl: targetThreadUrl }, 60000);
    const messages = (r?.messages || []) as Array<Record<string, unknown>>;
    if (r?.success && messages.length) {
      log(`✅ ${messages.length} messaggi trovati (method=${r.method || "?"})`, "ok");
      const counts = { inbound: 0, outbound: 0, unknown: 0 };
      messages.forEach((m) => {
        const d = String(m.direction || "unknown") as keyof typeof counts;
        if (d in counts) counts[d]++;
      });
      log(`  📊 inbound=${counts.inbound} outbound=${counts.outbound} unknown=${counts.unknown}`, "info");
      messages.slice(-5).forEach((m) => {
        const arrow = m.direction === "outbound" ? "→" : m.direction === "inbound" ? "←" : "?";
        log(`  ${arrow} [${String(m.sender || "—").slice(0, 20)}] ${String(m.text || "").slice(0, 80)}`, "info");
      });
    } else {
      log(`⚠️ Nessun messaggio. Risposta: ${JSON.stringify(r, null, 2).slice(0, 400)}`, "warn");
    }
  });

  const testBackfillThread = () => runWithCooldown(async () => {
    const targetThreadUrl = resolveThreadTarget();
    if (!targetThreadUrl) { log("⚠️ Inserisci un URL LinkedIn valido oppure usa il destinatario fisso già salvato", "warn"); return; }
    const stopText = isValidLinkedInTestUrl(lastKnownText) ? "" : lastKnownText;
    if (!threadUrl.trim()) log(`📌 Uso URL LinkedIn già disponibile: ${targetThreadUrl}`, "info");
    log(`📜 Backfill thread (max 20 scroll): ${targetThreadUrl}`);
    if (stopText) log(`  Stop su testo: "${stopText.slice(0, 60)}"`, "info");
    const r = await liMsg("backfillLinkedInThread", { threadUrl: targetThreadUrl, lastKnownText: stopText, maxScrolls: 20 }, 180000);
    const messages = (r?.messages || []) as Array<Record<string, unknown>>;
    if (r?.success) {
      log(`✅ ${messages.length} messaggi totali · ${r.scrollCount || 0} scroll · foundLast=${r.foundLast ? "sì" : "no"} · method=${r.method || "?"}`, "ok");
      messages.slice(0, 3).forEach((m) => log(`  📩 [${String(m.sender || "—").slice(0, 20)}] ${String(m.text || "").slice(0, 80)}`, "info"));
      if (messages.length > 3) log(`  … (${messages.length - 3} altri messaggi)`, "info");
    } else {
      log(`❌ Backfill fallito: ${r?.error || JSON.stringify(r)}`, "error");
    }
  });

  const pinFixedRecipient = () => {
    const fixedUrl = sendUrl.trim();
    if (!isValidLinkedInTestUrl(fixedUrl)) {
      log("⛔ URL LinkedIn non valido: usa un profilo /in/... o un thread /messaging/thread/...", "error");
      return;
    }
    localStorage.setItem(LI_FIXED_RECIPIENT_KEY, JSON.stringify({ url: fixedUrl, savedAt: new Date().toISOString() } satisfies StoredLiTestRecipient));
    if (fixedUrl.includes("/in/")) setProfileUrl(fixedUrl);
    log(`📌 URL LinkedIn FISSO per i test: ${fixedUrl}. Non verrà cambiato dagli invii.`, "ok");
  };

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
        <p className="text-xs font-medium text-muted-foreground">💬 Test Lettura Thread (diagnostico — NON salva nulla)</p>
        {foundThreads.length > 0 && (
          <select
            value={threadUrl}
            onChange={(e) => setThreadUrl(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">— Seleziona thread dalla Inbox (popola URL automaticamente) —</option>
            {foundThreads.map((t, i) => (
              <option key={i} value={t.threadUrl || ""} disabled={!t.threadUrl}>
                {t.name}{t.threadUrl ? "" : " (threadUrl mancante dalla lettura inbox)"}
              </option>
            ))}
          </select>
        )}
        <div className="flex gap-2">
          <Input
            value={threadUrl}
            onChange={(e) => setThreadUrl(e.target.value)}
            placeholder="URL thread/profilo LinkedIn — se vuoto usa il destinatario fisso"
            className="flex-1 text-sm"
          />
          <Button
            onClick={testReadThread}
            disabled={running || !resolveThreadTarget()}
            size="sm"
            title={!resolveThreadTarget() ? "threadUrl mancante: seleziona un thread dalla Inbox o incolla un URL" : undefined}
          >
            💬 Leggi Thread
          </Button>
        </div>
        <div className="flex gap-2">
          <Input
            value={lastKnownText}
            onChange={(e) => setLastKnownText(e.target.value)}
            placeholder="(opzionale) testo dell'ultimo messaggio noto — il backfill si ferma quando lo trova"
            className="flex-1 text-sm"
          />
          <Button
            onClick={testBackfillThread}
            disabled={running || !resolveThreadTarget()}
            size="sm"
            variant="outline"
            title={!resolveThreadTarget() ? "threadUrl mancante: seleziona un thread dalla Inbox o incolla un URL" : undefined}
          >
            📜 Backfill Thread
          </Button>
        </div>
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
            placeholder="URL fisso test LinkedIn (profilo /in/... o thread /messaging/thread/...)"
            className="flex-1 text-sm"
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={pinFixedRecipient}
            title="Salva questo URL come destinatario fisso dei test LinkedIn"
          >
            📌 Fissa test
          </Button>
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
          <Button onClick={testSendMessage} disabled={running || !sendUrl.trim() || !sendText.trim()} size="sm" variant="default" title={!sendUrl.trim() ? "URL fisso mancante: inseriscilo e premi Fissa test" : "Invia al destinatario fisso LinkedIn"}>📤 Invia LI</Button>
        </div>
        <div className="flex flex-wrap gap-2 pt-1 border-t border-border/50 mt-1">
          <span className="text-[11px] text-muted-foreground self-center mr-1">🧪 Test isolati click invio:</span>
          <Button onClick={() => testSendWithMethod("physical_click", "🖱️", "Click fisico")} disabled={running} size="sm" variant="outline" title="pointerdown/mousedown/click con coordinate reali">🖱️ Click fisico</Button>
          <Button onClick={() => testSendWithMethod("form_submit", "📋", "Form submit")} disabled={running} size="sm" variant="outline" title="form.requestSubmit() sul .msg-form">📋 Form submit</Button>
          <Button onClick={() => testSendWithMethod("keyboard_shortcut", "⌨️", "Ctrl+Enter")} disabled={running} size="sm" variant="outline" title="Ctrl+Enter (Cmd+Enter su Mac)">⌨️ Ctrl+Enter</Button>
          <Button onClick={() => testSendWithMethod("cdp_physical_click", "🎯", "CDP click")} disabled={running} size="sm" variant="outline" title="Chrome DevTools Protocol: mousePressed/mouseReleased sul bottone Invia">🎯 CDP click</Button>
          <Button onClick={() => testSendWithMethod("cdp_ctrl_enter", "⌘", "CDP Ctrl+Enter")} disabled={running} size="sm" variant="outline" title="Chrome DevTools Protocol: Ctrl/Cmd+Enter nativo">⌘ CDP Ctrl+Enter</Button>
        </div>
      </div>
      <Terminal logs={logs} />
      {quality && (
        <div className="p-3 rounded-lg border border-border bg-muted/30 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <p className="font-medium text-muted-foreground">📊 Qualità ultima sync LinkedIn</p>
            <span className="text-muted-foreground">{new Date(quality.at).toLocaleTimeString()}</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div><span className="text-muted-foreground">Thread visti:</span> <b>{quality.rawCandidates}</b></div>
            <div><span className="text-muted-foreground">Thread accettati:</span> <b>{quality.threadsAccepted}</b></div>
            <div><span className="text-muted-foreground">Messaggi salvati:</span> <b>{quality.messagesAccepted}</b></div>
            <div><span className="text-muted-foreground">Confidence media:</span> <b>{(quality.avgConfidence * 100).toFixed(0)}%</b></div>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(quality.methods).filter(([, v]) => v > 0).map(([k, v]) => (
              <span key={k} className="px-2 py-0.5 rounded bg-primary/10 text-primary">{k}: {v}</span>
            ))}
          </div>
          {(Object.entries(quality.threadsDropped).some(([, v]) => v > 0) || Object.entries(quality.messagesDropped).some(([, v]) => v > 0)) && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(quality.threadsDropped).filter(([, v]) => v > 0).map(([k, v]) => (
                <span key={`t-${k}`} className="px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-500">thread/{k}: {v}</span>
              ))}
              {Object.entries(quality.messagesDropped).filter(([, v]) => v > 0).map(([k, v]) => (
                <span key={`m-${k}`} className="px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-500">msg/{k}: {v}</span>
              ))}
            </div>
          )}
          {quality.warnings.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {quality.warnings.map((w) => (
                <span key={w} className="px-2 py-0.5 rounded bg-orange-500/10 text-orange-500">⚠ {w}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
