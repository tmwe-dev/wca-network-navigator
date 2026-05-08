/**
 * WhatsAppTest — WhatsApp extension testing tab
 */
import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Terminal, type LogEntry, ts } from "./Terminal";
import { waMsg, sendToExtension } from "./extensionBridge";
import { WHATSAPP_EXTENSION_REQUIRED_VERSION } from "@/lib/whatsappExtensionZip";
import { subscribeOptimusEvents } from "@/hooks/useOptimusBridgeListener";
import { SyncGuardIndicator } from "@/v2/ui/atoms/SyncGuardIndicator";
import { tryAcquire, throttle, SyncGuardBusyError } from "@/lib/syncGuard";
import { searchWaRecipients, type WaTestRecipient } from "@/data/whatsappTestLookup";

interface FoundContact {
  contact: string;
  time?: string;
}

export function WhatsAppTest() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [sendPhone, setSendPhone] = useState("");
  const [sendText, setSendText] = useState("Test da WCA Partner Connect 🚀");
  const [foundContacts, setFoundContacts] = useState<FoundContact[]>([]);
  const [lastSentTo, setLastSentTo] = useState<string | null>(null);
  const [dbQuery, setDbQuery] = useState("");
  const [dbResults, setDbResults] = useState<WaTestRecipient[]>([]);
  const [dbSearching, setDbSearching] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<WaTestRecipient | null>(null);

  const log = useCallback((msg: string, type: LogEntry["type"] = "info") => {
    setLogs((prev) => [...prev, { ts: ts(), msg, type }]);
  }, []);

  // Stream eventi Optimus nel terminal in tempo reale
  useEffect(() => {
    return subscribeOptimusEvents((e) => {
      if (e.channel !== "whatsapp") return;
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

  const isExpectedWaVersion = (version?: string) => version === WHATSAPP_EXTENSION_REQUIRED_VERSION;

  const ensureCurrentWaExtension = async () => {
    const ping = await waMsg("ping", {}, 5000);
    if (!ping?.success) {
      log(`❌ Estensione WhatsApp non raggiungibile: ${ping?.error || JSON.stringify(ping)}`, "error");
      return null;
    }
    const version = ping.version as string | undefined;
    if (!isExpectedWaVersion(version)) {
      if (version === "3.4.0") {
        log(`⚠️ Hai installata Partner Connect (v3.4.0) che risponde al posto della WhatsApp extension. Rimuovi Partner Connect o aggiornala alla v3.4.1+`, "error");
      } else {
        log(`⚠️ Estensione v${version} ancora installata in Chrome. Serve la v${WHATSAPP_EXTENSION_REQUIRED_VERSION}.`, "error");
        log(`AZIONE: chrome://extensions → RIMUOVI la v${version} (non solo disattiva) → scarica nuovo ZIP → estrai in CARTELLA NUOVA → 'Carica estensione non pacchettizzata'.`, "warn");
      }
      return { ...ping, outdated: true };
    }
    return ping;
  };

  const testPing = async () => {
    setRunning(true);
    log("🔌 Ping estensione WhatsApp...");
    const r = await waMsg("ping", {}, 5000);
    if (r?.success) {
      const version = (r.version as string) || "?";
      if (isExpectedWaVersion(version)) log(`✅ Estensione attiva (v${version})`, "ok");
      else {
        if (version === "3.4.0") {
          log(`⚠️ Hai installata Partner Connect (v3.4.0) che risponde al posto della WhatsApp extension. Rimuovi Partner Connect o aggiornala alla v3.4.1+`, "error");
        } else {
          log(`⚠️ Estensione v${version} ancora installata in Chrome — richiesta v${WHATSAPP_EXTENSION_REQUIRED_VERSION}`, "error");
          log(`AZIONE: chrome://extensions → RIMUOVI la v${version} (non solo disattiva) → estrai il nuovo ZIP in una CARTELLA NUOVA → 'Carica estensione non pacchettizzata'.`, "warn");
        }
      }
    } else log(`❌ Non raggiungibile: ${r?.error || JSON.stringify(r)}`, "error");
    setRunning(false);
  };

  const testSession = async () => {
    setRunning(true);
    const ping = await ensureCurrentWaExtension();
    if (!ping || (ping as Record<string, unknown>).outdated) { setRunning(false); return; }
    log("🔑 Verifica sessione WhatsApp Web...");
    let r = await waMsg("verifySession", {}, 60000);
    if (!r?.success && /timeout/i.test(String(r?.error || ""))) {
      log("⏳ Timeout: attendo 3s e riprovo una volta...", "warn");
      await new Promise((res) => setTimeout(res, 3000));
      r = await waMsg("verifySession", {}, 60000);
    }
    if (r?.reason === "confirm_popup") {
      log(`🚧 ${r.message || "WhatsApp Web ha un popup di conferma aperto. Aprilo e chiudi il popup."}`, "error");
    } else if (r?.reason === "qr_required") {
      log("📱 QR code richiesto: scansiona WhatsApp Web col telefono.", "warn");
    } else if (r?.reason === "loading") {
      log("⏳ WhatsApp Web ancora in caricamento — riprova fra qualche secondo.", "warn");
    } else {
      log(`Risultato: ${JSON.stringify(r, null, 2)}`, r?.authenticated ? "ok" : "warn");
    }
    setRunning(false);
  };

  const testReadUnread = async () => {
    setRunning(true);
    const ping = await ensureCurrentWaExtension();
    if (!ping || (ping as Record<string, unknown>).outdated) { setRunning(false); return; }
    log("📨 Lettura messaggi (readUnread)...");
    const r = await waMsg("readUnread", {}, 60000);
    if (!r?.success) { log(`❌ Fallito: ${r?.error || JSON.stringify(r)}`, "error"); setRunning(false); return; }
    log(`✅ Metodo: ${r.method || "?"} | Scansionati: ${r.scanned || "?"}`, "ok");

    // Riepilogo Optimus inline (dalla response)
    const opt = r.optimus as { cached?: boolean; planVersion?: number; confidence?: number; latencyMs?: number; dropped?: number } | undefined;
    if (opt) {
      const tag = opt.cached ? "cache" : "AI fresh";
      const conf = typeof opt.confidence === "number" ? `${(opt.confidence * 100).toFixed(0)}%` : "n/d";
      const lat = opt.latencyMs ? `${opt.latencyMs}ms` : "—";
      const dropped = typeof opt.dropped === "number" && opt.dropped > 0 ? ` · ${opt.dropped} scartati (dati insufficienti)` : "";
      log(`🤖 Optimus: piano [${tag}] · confidence ${conf} · ${((r.messages as unknown[]) || []).length} estratti in ${lat}${dropped}`, opt.cached ? "ok" : "info");
    } else if (r.method && String(r.method).startsWith("legacy")) {
      log(`⚠️ Optimus non disponibile, fallback ${r.method}`, "warn");
    }

    const msgs = (r.messages || []) as Array<Record<string, unknown>>;
    log(`📬 Messaggi trovati: ${msgs.length}`);
    for (const m of msgs) {
      const verify = m.isVerify ? " 🔄VERIFY" : "";
      const unread = (m.unreadCount as number) > 0 ? ` (${m.unreadCount} non letti)` : "";
      log(`  👤 ${m.contact}${unread}${verify} — "${((m.lastMessage as string) || "").slice(0, 80)}" — ⏰ ${m.time || "?"}`, (m.unreadCount as number) > 0 ? "ok" : "info");
    }
    if (msgs.length === 0) {
      log("❌ Optimus: DOM non riconosciuto · 0 estratti · serve intervento", "error");
    } else {
      setFoundContacts(msgs.map((m) => ({ contact: m.contact as string, time: m.time as string | undefined })));
    }
    setRunning(false);
  };

  const testSendMessage = async () => {
    const phoneRaw = sendPhone.trim();
    const cleanedPhone = phoneRaw.replace(/[^0-9+]/g, "");
    const hasPhone = cleanedPhone.replace(/^\+/, "").length >= 7;
    if (!hasPhone) {
      log("⛔ Serve un numero E.164 (es. +393331234567). Cerca il destinatario nel database qui sotto: il numero verrà compilato automaticamente. L'invio per nome chat non è affidabile e può finire alla persona sbagliata.", "error");
      return;
    }
    if (!sendText.trim()) { log("⚠️ Inserisci il testo del messaggio", "warn"); return; }
    setRunning(true);
    const ping = await ensureCurrentWaExtension();
    if (!ping || (ping as Record<string, unknown>).outdated) { setRunning(false); return; }
    const target = cleanedPhone;
    if (selectedRecipient) {
      log(`🎯 Destinatario CRM: ${selectedRecipient.name}${selectedRecipient.company ? " — " + selectedRecipient.company : ""} [${selectedRecipient.source}] → ${target}`, "info");
    }
    log(`📤 Invio WhatsApp a "${target}" via URL diretto /send?phone=: "${sendText.slice(0, 60)}..."`);
    // Se il destinatario è cambiato rispetto all'ultimo invio, chiediamo
    // all'estensione di chiudere la chat aperta — così non riusa la conversazione
    // precedente per errore.
    if (lastSentTo && lastSentTo !== target) {
      try {
        await waMsg("closeActiveChat", {}, 5000);
        log(`🧹 Chat precedente chiusa (destinatario cambiato: ${lastSentTo} → ${target})`, "info");
      } catch { /* opzionale, l'estensione potrebbe non supportarlo */ }
    }
    const r = await waMsg("sendWhatsApp", { phone: target, text: sendText }, 60000);
    if (r?.success) {
      log(`✅ Messaggio inviato con successo!`, "ok");
      log(`Risposta: ${JSON.stringify(r, null, 2).slice(0, 500)}`, "info");
      setLastSentTo(target);
    } else {
      log(`❌ Invio fallito: ${r?.error || JSON.stringify(r)}`, "error");
    }
    setRunning(false);
  };

  const resetSendForm = () => {
    setSendPhone("");
    setFoundContacts([]);
    setLastSentTo(null);
    setSelectedRecipient(null);
    setDbQuery("");
    setDbResults([]);
    log("🔄 Reset destinatario: numero, nome, dropdown contatti e memoria ultimo invio azzerati.", "info");
  };

  const runDbSearch = async (override?: string) => {
    const q = (override ?? dbQuery).trim();
    if (q.length < 2) {
      log("⚠️ Scrivi almeno 2 caratteri (nome, azienda, email o telefono)", "warn");
      return;
    }
    setDbSearching(true);
    try {
      const results = await searchWaRecipients(q, 25);
      setDbResults(results);
      const withPhone = results.filter(r => r.bestPhone).length;
      log(`🔎 Trovati ${results.length} record nel database (${withPhone} con telefono inviabile)`, results.length > 0 ? "ok" : "warn");
    } catch (e) {
      log(`❌ Ricerca database fallita: ${e instanceof Error ? e.message : String(e)}`, "error");
    } finally {
      setDbSearching(false);
    }
  };

  const pickRecipient = (r: WaTestRecipient) => {
    setSelectedRecipient(r);
    if (r.bestPhone) {
      setSendPhone(r.bestPhone);
      log(`✅ Destinatario selezionato: ${r.name}${r.company ? " — " + r.company : ""} → ${r.bestPhone}`, "ok");
    } else {
      setSendPhone("");
      log(`⛔ ${r.name} non ha telefono nel database (${r.source}). Aggiorna il record o scegli un altro destinatario.`, "error");
    }
  };

  const testRawDom = async () => {
    setRunning(true);
    const ping = await ensureCurrentWaExtension();
    if (!ping || (ping as Record<string, unknown>).outdated) { setRunning(false); return; }
    log("🔍 Test DOM diretto — cerco selettori sulla pagina WA...");
    const r = await sendToExtension("from-webapp-wa", "from-extension-wa", "diagnosticDom", {}, 30000);
    log(`Risposta: ${JSON.stringify(r, null, 2).slice(0, 2000)}`, r?.success ? "ok" : "error");
    setRunning(false);
  };

  const testGuardSequence = async () => {
    setRunning(true);
    log("🛡️ Avvio verifica Controllo Tempi (mutex + cooldown reali)...");
    let guard;
    try {
      guard = tryAcquire("whatsapp", "Test Controllo Tempi");
    } catch (e) {
      if (e instanceof SyncGuardBusyError) {
        window.dispatchEvent(new CustomEvent("sync-guard-blocked", { detail: { channel: "whatsapp" } }));
        log(`⛔ Mutex già occupato: ${e.message}`, "error");
        setRunning(false);
        return;
      }
      throw e;
    }
    try {
      log("→ throttle('ping')", "info");
      await throttle("whatsapp", "ping", "Demo: ping");
      log("→ throttle('open')", "info");
      await throttle("whatsapp", "open", "Demo: apri chat");
      log("→ throttle('read')", "info");
      await throttle("whatsapp", "read", "Demo: leggi");
      log("→ throttle('betweenThreads')", "info");
      await throttle("whatsapp", "betweenThreads", "Demo: pausa thread");
      log("✅ Sequenza completata. Tutto serializzato.", "ok");
    } finally {
      guard.release();
      setRunning(false);
    }
  };

  const testGuardConcurrent = async () => {
    setRunning(true);
    log("🚦 Verifica blocco concorrenza WA...", "info");
    let g1;
    try {
      g1 = tryAcquire("whatsapp", "Concorrenza A");
    } catch (e) {
      log(`❌ Già occupato: ${(e as Error).message}`, "error");
      setRunning(false);
      return;
    }
    try {
      try {
        tryAcquire("whatsapp", "Concorrenza B");
        log("❌ ERRORE: secondo acquire passato (mutex rotto!)", "error");
      } catch (e) {
        if (e instanceof SyncGuardBusyError) {
          window.dispatchEvent(new CustomEvent("sync-guard-blocked", { detail: { channel: "whatsapp" } }));
          log(`✅ Bloccato come previsto: ${e.message}`, "ok");
        }
      }
      await throttle("whatsapp", "read", "Concorrenza: rilascio");
    } finally {
      g1.release();
      log("🔓 Mutex rilasciato.", "ok");
      setRunning(false);
    }
  };

  const testRemapSendDom = async () => {
    setRunning(true);
    const ping = await ensureCurrentWaExtension();
    if (!ping || (ping as Record<string, unknown>).outdated) { setRunning(false); return; }
    log("🔧 Rimappa DOM invio: l'AI sta studiando la pagina WhatsApp Web...");
    const r = await waMsg("remapSendDom", {}, 60000);
    if (r?.success) {
      const fields = r.fields as Record<string, { primary?: string; fallback?: string; confidence?: number }> | undefined;
      log(`✅ Mappa salvata (hash ${String(r.domHash || "").slice(0, 8)}, plan v${r.planVersion ?? "?"})`, "ok");
      if (fields) {
        for (const [k, v] of Object.entries(fields)) {
          const conf = typeof v.confidence === "number" ? ` · ${(v.confidence * 100).toFixed(0)}%` : "";
          log(`  • ${k}: ${v.primary || "—"}${conf}`, "info");
          if (v.fallback) log(`     ↪ fallback: ${v.fallback}`, "info");
        }
      }
      log("Riprova ora l'invio: il sistema userà i nuovi selettori.", "ok");
    } else {
      log(`❌ Rimappatura fallita: ${r?.error || JSON.stringify(r)}`, "error");
    }
    setRunning(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button onClick={testPing} disabled={running} size="sm">🔌 Ping</Button>
        <Button onClick={testSession} disabled={running} size="sm">🔑 Sessione</Button>
        <Button onClick={testReadUnread} disabled={running} size="sm">📨 Leggi Messaggi</Button>
        <Button onClick={testRawDom} disabled={running} size="sm" variant="outline">🔍 Diagnostica DOM</Button>
        <Button onClick={testRemapSendDom} disabled={running} size="sm" variant="outline" title="L'AI rilegge il DOM e salva selettori freschi per l'invio. Usalo se l'invio fallisce dopo un aggiornamento di WhatsApp Web.">🔧 Rimappa DOM invio</Button>
        <Button
          size="sm"
          variant="outline"
          disabled={running}
          onClick={async () => {
            setRunning(true);
            log("🧠 Test AI Extract via bridge...");
            try {
              const result = await waMsg("readUnread", {}, 90000);
              log("Risultato AI: " + JSON.stringify(result, null, 2).slice(0, 2000), result?.success ? "ok" : "error");
            } catch (e) {
              log("❌ AI Extract fallito: " + (e instanceof Error ? e.message : String(e)), "error");
            }
            setRunning(false);
          }}
        >🧠 AI Extract</Button>
        <Button onClick={testGuardSequence} disabled={running} size="sm" variant="secondary">🛡️ Verifica Controllo</Button>
        <Button onClick={testGuardConcurrent} disabled={running} size="sm" variant="secondary">🚦 Test Concorrenza</Button>
        <Button onClick={() => setLogs([])} size="sm" variant="ghost">🗑️ Pulisci</Button>
        <div className="ml-auto flex items-center"><SyncGuardIndicator channel="whatsapp" /></div>
      </div>
      <div className="flex gap-2">
        <Input
          value={sendPhone}
          onChange={(e) => setSendPhone(e.target.value)}
          placeholder="Numero E.164 (es. +393331234567) — preferito"
          className="flex-1"
        />
      </div>
      <div className="rounded-lg border border-border bg-card/50 p-3 space-y-2">
        <div className="text-xs font-semibold text-muted-foreground">🔎 Cerca destinatario nel database CRM</div>
        <div className="text-[11px] text-muted-foreground leading-snug">
          Cerca tra: <strong>imported_contacts</strong> (lead importati), <strong>partner_contacts</strong> (referenti partner), <strong>partners</strong> (aziende partner) e <strong>business_cards</strong> (biglietti da visita OCR). Serve per recuperare il <strong>numero E.164</strong> del destinatario — il nome chat di WhatsApp Web non basta per inviare in modo affidabile.
        </div>
        <div className="flex gap-2">
          <Input
            value={dbQuery}
            onChange={(e) => setDbQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") runDbSearch(); }}
            placeholder="Nome, azienda, email o telefono (es. Gianfranco)"
            className="flex-1"
          />
          <Button onClick={runDbSearch} disabled={dbSearching} size="sm" variant="secondary">{dbSearching ? "Cerco…" : "Cerca DB"}</Button>
          <Button onClick={resetSendForm} disabled={running} size="sm" variant="outline" title="Svuota destinatario e ricerca">🔄 Reset</Button>
        </div>
        {dbResults.length > 0 && (
          <div className="max-h-64 overflow-auto divide-y divide-border rounded-md border border-border bg-background">
            {dbResults.map((r) => {
              const selected = selectedRecipient?.id === r.id && selectedRecipient?.source === r.source;
              return (
                <button
                  key={`${r.source}-${r.id}`}
                  type="button"
                  onClick={() => pickRecipient(r)}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-accent/50 transition-colors ${selected ? "bg-accent/40" : ""} ${!r.bestPhone ? "opacity-60" : ""}`}
                  disabled={!r.bestPhone}
                  title={!r.bestPhone ? "Nessun telefono in DB — non inviabile" : "Usa questo destinatario"}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{r.name || "(senza nome)"} {r.company && <span className="text-muted-foreground font-normal">— {r.company}</span>}</div>
                      <div className="text-muted-foreground truncate">
                        {r.bestPhone ? <span className="text-green-500">📱 {r.bestPhone}</span> : <span className="text-red-500">⛔ no phone</span>}
                        {r.email && <span> · ✉️ {r.email}</span>}
                      </div>
                    </div>
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground shrink-0">{r.source.replace("_", " ")}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
        {selectedRecipient && (
          <div className="text-xs text-muted-foreground">
            Destinatario attivo: <strong>{selectedRecipient.name}</strong>
            {selectedRecipient.company ? ` — ${selectedRecipient.company}` : ""}
            {selectedRecipient.bestPhone ? ` → ${selectedRecipient.bestPhone}` : " (no phone)"}
          </div>
        )}
      </div>
      {foundContacts.length > 0 && (
        <details className="text-xs text-muted-foreground" open>
          <summary className="cursor-pointer">📨 Chat lette da WhatsApp Web ({foundContacts.length}) — clicca un nome per cercarlo nel CRM e usarlo come destinatario</summary>
          <div className="mt-2 max-h-64 overflow-auto divide-y divide-border rounded-md border border-border bg-background">
            {foundContacts.slice(0, 30).map((c, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setDbQuery(c.contact);
                  log(`🔎 Cerco "${c.contact}" nel CRM per recuperare il numero...`, "info");
                  void runDbSearch(c.contact);
                }}
                className="w-full text-left px-3 py-2 text-xs hover:bg-accent/50 transition-colors flex items-center justify-between gap-2"
                title="Cerca questo nome nel CRM per ottenere il telefono"
              >
                <span className="truncate">👤 {c.contact}</span>
                <span className="text-[10px] text-muted-foreground shrink-0">{c.time || ""} · cerca →</span>
              </button>
            ))}
          </div>
        </details>
      )}
      <div className="flex gap-2">
        <Input value={sendText} onChange={(e) => setSendText(e.target.value)} placeholder="Testo del messaggio" className="flex-1" />
        <Button onClick={testSendMessage} disabled={running} size="sm" variant="default">📤 Invia WA</Button>
      </div>
      <Terminal logs={logs} />
    </div>
  );
}
