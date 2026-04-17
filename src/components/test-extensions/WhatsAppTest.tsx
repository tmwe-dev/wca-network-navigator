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

interface FoundContact {
  contact: string;
  time?: string;
}

export function WhatsAppTest() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [sendContact, setSendContact] = useState("");
  const [sendText, setSendText] = useState("Test da WCA Partner Connect 🚀");
  const [foundContacts, setFoundContacts] = useState<FoundContact[]>([]);

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
      const version = (r.version as string) || "?";
      if (isExpectedWaVersion(version)) log(`✅ Estensione attiva (v${version})`, "ok");
      else log(`⚠️ Estensione attiva ma obsoleta (v${version}) — richiesta v${WHATSAPP_EXTENSION_REQUIRED_VERSION}`, "error");
    } else log(`❌ Non raggiungibile: ${r?.error || JSON.stringify(r)}`, "error");
    setRunning(false);
  };

  const testSession = async () => {
    setRunning(true);
    const ping = await ensureCurrentWaExtension();
    if (!ping || (ping as Record<string, unknown>).outdated) { setRunning(false); return; }
    log("🔑 Verifica sessione WhatsApp Web...");
    const r = await waMsg("verifySession", {}, 30000);
    log(`Risultato: ${JSON.stringify(r, null, 2)}`, r?.authenticated ? "ok" : "warn");
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
    if (!sendContact.trim()) { log("⚠️ Inserisci il nome del contatto WhatsApp", "warn"); return; }
    if (!sendText.trim()) { log("⚠️ Inserisci il testo del messaggio", "warn"); return; }
    setRunning(true);
    const ping = await ensureCurrentWaExtension();
    if (!ping || (ping as Record<string, unknown>).outdated) { setRunning(false); return; }
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
    if (!ping || (ping as Record<string, unknown>).outdated) { setRunning(false); return; }
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
          <select value={sendContact} onChange={(e) => setSendContact(e.target.value)} className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="">— Seleziona contatto —</option>
            {foundContacts.map((c, i) => (<option key={i} value={c.contact}>{c.contact}{c.time ? ` (${c.time})` : ""}</option>))}
          </select>
        ) : (
          <Input value={sendContact} onChange={(e) => setSendContact(e.target.value)} placeholder="Nome contatto (prima fai 📨 Leggi Messaggi)" className="flex-1" />
        )}
      </div>
      <div className="flex gap-2">
        <Input value={sendText} onChange={(e) => setSendText(e.target.value)} placeholder="Testo del messaggio" className="flex-1" />
        <Button onClick={testSendMessage} disabled={running} size="sm" variant="default">📤 Invia WA</Button>
      </div>
      <Terminal logs={logs} />
    </div>
  );
}
