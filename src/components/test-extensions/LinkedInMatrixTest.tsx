/**
 * LinkedInMatrixTest — Test matrice di SCRITTURA MESSAGGIO LinkedIn.
 *
 * Estensione = ponte. Un solo click esegue tutte le 5 strategie di invio
 * (pipeline standard + 4 metodi click isolati) sullo stesso destinatario,
 * con pause anti rate-limit, e mostra una matrice verde/rosso di cosa funziona.
 *
 * Pause: 15s tra strategie · 30s ogni 3 strategie.
 * Risultati persistenti in localStorage. UI-only: nessun side-effect AI/DB.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Terminal, type LogEntry, ts } from "./Terminal";
import { liMsg } from "./extensionBridge";
import { CheckCircle2, XCircle, Circle, Play, Trash2 } from "lucide-react";

const STORAGE_KEY = "li_matrix_results_v1";
const FIXED_RECIPIENT_KEY = "li_test_fixed_recipient";
const PAUSE_BETWEEN_TESTS_MS = 15_000;
const LONG_PAUSE_EVERY = 3;
const LONG_PAUSE_MS = 30_000;

/**
 * Strategie di SCRITTURA MESSAGGIO supportate dall'estensione 3.9.59.
 * Ogni strategia è un preset auto-contenuto: stesso destinatario, stesso testo,
 * cambia solo il MECCANISMO di invio per capire quale funziona.
 */
type StrategyId =
  | "pipeline_standard"
  | "physical_click"
  | "form_submit"
  | "keyboard_shortcut"
  | "cdp_physical_click"
  | "cdp_ctrl_enter";

interface Strategy {
  id: StrategyId;
  label: string;
  emoji: string;
  desc: string;
  /** Action e payload da inviare all'estensione bridge */
  action: "sendMessage" | "sendMessageWithMethod";
  method?: string;
}

const STRATEGIES: Strategy[] = [
  { id: "pipeline_standard",  label: "Pipeline standard",     emoji: "📤", desc: "navigate + clickMessage + composer + writer (default 3.9.59)", action: "sendMessage" },
  { id: "physical_click",     label: "Click fisico",          emoji: "🖱️", desc: "pointerdown/mousedown/click reali con coordinate",            action: "sendMessageWithMethod", method: "physical_click" },
  { id: "form_submit",        label: "Form submit",           emoji: "📋", desc: "form.requestSubmit() su .msg-form",                          action: "sendMessageWithMethod", method: "form_submit" },
  { id: "keyboard_shortcut",  label: "Ctrl+Enter",            emoji: "⌨️", desc: "Ctrl+Enter (Cmd+Enter su Mac)",                              action: "sendMessageWithMethod", method: "keyboard_shortcut" },
  { id: "cdp_physical_click", label: "CDP click",             emoji: "🎯", desc: "Chrome DevTools Protocol mousePressed/Released",             action: "sendMessageWithMethod", method: "cdp_physical_click" },
  { id: "cdp_ctrl_enter",     label: "CDP Ctrl+Enter",        emoji: "⌘", desc: "Chrome DevTools Protocol Ctrl/Cmd+Enter nativo",             action: "sendMessageWithMethod", method: "cdp_ctrl_enter" },
];

type Outcome = "ok" | "fail" | "skip";
interface RunResult {
  outcome: Outcome;
  error?: string;
  at: string;
  durationMs?: number;
}
type MatrixResults = Record<StrategyId, RunResult | undefined>;

function loadResults(): MatrixResults {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {} as MatrixResults;
    return JSON.parse(raw) as MatrixResults;
  } catch { return {} as MatrixResults; }
}

function saveResults(r: MatrixResults): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(r)); } catch { /* ignore */ }
}

export function LinkedInMatrixTest() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [results, setResults] = useState<MatrixResults>(loadResults);
  const [running, setRunning] = useState(false);
  const [bridgeVersion, setBridgeVersion] = useState<string | null>(null);
  const [recipient, setRecipient] = useState("");
  const [messageText, setMessageText] = useState("Test matrice scrittura LinkedIn — verifica invio");
  const [countdown, setCountdown] = useState(0);
  const [currentStrategy, setCurrentStrategy] = useState<StrategyId | null>(null);
  const abortRef = useRef(false);

  const log = useCallback((msg: string, type: LogEntry["type"] = "info") => {
    setLogs((p) => [...p, { ts: ts(), msg, type }]);
  }, []);

  // Carica destinatario fisso condiviso con la tab LinkedInTest principale
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FIXED_RECIPIENT_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { url?: string };
        if (saved.url) setRecipient(saved.url);
      }
    } catch { /* ignore */ }
  }, []);

  // Pausa interrompibile con countdown UI
  const safePause = useCallback(async (ms: number, reason: string) => {
    log(`⏸️ Pausa di sicurezza ${(ms / 1000).toFixed(0)}s · ${reason}`, "info");
    const startedAt = Date.now();
    while (Date.now() - startedAt < ms) {
      if (abortRef.current) { log("🛑 Suite annullata dall'operatore", "warn"); throw new Error("ABORTED"); }
      const remaining = Math.max(0, Math.ceil((ms - (Date.now() - startedAt)) / 1000));
      setCountdown(remaining);
      await new Promise((r) => setTimeout(r, 500));
    }
    setCountdown(0);
  }, [log]);

  const runOneStrategy = useCallback(async (s: Strategy): Promise<RunResult> => {
    log(`${s.emoji} → ${s.label} — ${s.desc}`, "info");
    const t0 = Date.now();
    try {
      const payload: Record<string, unknown> = { url: recipient, message: messageText };
      if (s.method) payload.method = s.method;
      const r = await liMsg(s.action, payload, 90_000) as Record<string, unknown>;
      const durationMs = Date.now() - t0;
      if (r?.success) {
        log(`  ✅ ${s.label}: OK in ${durationMs}ms`, "ok");
        return { outcome: "ok", at: new Date().toISOString(), durationMs };
      }
      const err = String(r?.error || JSON.stringify(r)).slice(0, 200);
      log(`  ❌ ${s.label}: ${err}`, "error");
      return { outcome: "fail", error: err, at: new Date().toISOString(), durationMs };
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      log(`  ❌ ${s.label} eccezione: ${err}`, "error");
      return { outcome: "fail", error: err, at: new Date().toISOString(), durationMs: Date.now() - t0 };
    }
  }, [recipient, messageText, log]);

  const runSuite = useCallback(async () => {
    if (!recipient.trim()) { log("⛔ Inserisci il destinatario LinkedIn fisso", "error"); return; }
    if (!messageText.trim()) { log("⛔ Inserisci il testo del messaggio", "error"); return; }
    setRunning(true);
    abortRef.current = false;
    try {
      // Verifica che l'estensione bridge risponda (un solo ping, non è un test)
      log("🔌 Verifica bridge estensione...", "info");
      const pong = await liMsg("ping", {}, 5000) as { success?: boolean; version?: string };
      if (!pong?.success) { log("❌ Estensione LinkedIn non risponde. Installala e riprova.", "error"); return; }
      setBridgeVersion(pong.version || "?");
      log(`✅ Bridge attivo · estensione v${pong.version || "?"}`, "ok");
      log(`🧪 Avvio matrice ${STRATEGIES.length} strategie di scrittura · pause ${PAUSE_BETWEEN_TESTS_MS / 1000}s tra strategie, ${LONG_PAUSE_MS / 1000}s ogni ${LONG_PAUSE_EVERY}`, "info");

      const next: MatrixResults = { ...results };
      for (let i = 0; i < STRATEGIES.length; i++) {
        if (abortRef.current) break;
        const s = STRATEGIES[i];
        setCurrentStrategy(s.id);
        const res = await runOneStrategy(s);
        next[s.id] = res;
        setResults({ ...next });
        saveResults(next);
        if (i < STRATEGIES.length - 1) {
          const longPause = (i + 1) % LONG_PAUSE_EVERY === 0;
          await safePause(longPause ? LONG_PAUSE_MS : PAUSE_BETWEEN_TESTS_MS, longPause ? "ciclo lungo anti rate-limit" : "tra strategie");
        }
      }
      const ok = STRATEGIES.filter((s) => next[s.id]?.outcome === "ok").length;
      log(`🏁 Matrice completata: ${ok}/${STRATEGIES.length} strategie funzionanti`, ok > 0 ? "ok" : "error");
    } catch (e) {
      if (e instanceof Error && e.message === "ABORTED") { /* già loggato */ }
      else log(`❌ Errore suite: ${e instanceof Error ? e.message : String(e)}`, "error");
    } finally {
      setRunning(false);
      setCountdown(0);
      setCurrentStrategy(null);
    }
  }, [recipient, messageText, results, runOneStrategy, safePause, log]);

  const stopSuite = useCallback(() => { abortRef.current = true; }, []);

  const clearMatrix = useCallback(() => {
    if (!window.confirm("Cancellare i risultati matrice salvati?")) return;
    setResults({} as MatrixResults);
    saveResults({} as MatrixResults);
    log("🗑️ Matrice azzerata", "info");
  }, [log]);

  const summary = useMemo(() => {
    let ok = 0, fail = 0;
    for (const s of STRATEGIES) {
      const r = results[s.id];
      if (r?.outcome === "ok") ok++;
      else if (r?.outcome === "fail") fail++;
    }
    return { tested: ok + fail, ok, fail };
  }, [results]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">🧪 LinkedIn — Matrice strategie di scrittura</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {STRATEGIES.length} strategie · {summary.ok} OK · {summary.fail} KO
              {bridgeVersion && <span className="ml-2">· bridge v{bridgeVersion}</span>}
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={clearMatrix} size="sm" variant="ghost" disabled={!summary.tested}>
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Reset
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground">Destinatario (URL profilo o thread)</label>
            <Input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="https://www.linkedin.com/in/..." className="text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Testo messaggio (inviato {STRATEGIES.length} volte)</label>
            <Input value={messageText} onChange={(e) => setMessageText(e.target.value)} className="text-sm" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-border/50">
          {currentStrategy && (
            <div className="text-xs">
              In esecuzione: <span className="font-mono font-semibold text-primary">{currentStrategy}</span>
            </div>
          )}
          {countdown > 0 && (
            <span className="text-xs font-mono text-yellow-500 animate-pulse">⏳ pausa {countdown}s</span>
          )}
          <div className="ml-auto flex gap-2">
            {!running && (
              <Button onClick={runSuite} disabled={!recipient.trim() || !messageText.trim()} size="sm">
                <Play className="h-3.5 w-3.5 mr-1" /> Esegui matrice ({STRATEGIES.length} strategie)
              </Button>
            )}
            {running && (
              <Button onClick={stopSuite} size="sm" variant="destructive">🛑 Stop</Button>
            )}
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground leading-relaxed">
          L'estensione installata fa SOLO da ponte: un click esegue {STRATEGIES.length} strategie di scrittura diverse sullo stesso destinatario.
          Pause: <b>{PAUSE_BETWEEN_TESTS_MS / 1000}s</b> tra strategie, <b>{LONG_PAUSE_MS / 1000}s</b> ogni {LONG_PAUSE_EVERY} (anti rate-limit LinkedIn).
          Solo SCRITTURA messaggio: niente ping, inbox, scraping profilo.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-3 py-2 border-b border-border bg-muted/30">
          <h4 className="text-xs font-semibold">Risultati per strategia</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-center px-2 py-1.5 font-medium w-10">Esito</th>
                <th className="text-left px-2 py-1.5 font-medium">Strategia</th>
                <th className="text-left px-2 py-1.5 font-medium">Meccanismo</th>
                <th className="text-right px-2 py-1.5 font-medium w-20">Tempo</th>
                <th className="text-left px-2 py-1.5 font-medium">Errore</th>
              </tr>
            </thead>
            <tbody>
              {STRATEGIES.map((s) => {
                const r = results[s.id];
                const isCurrent = currentStrategy === s.id;
                return (
                  <tr key={s.id} className={`border-t border-border/50 ${isCurrent ? "bg-primary/5" : ""}`}>
                    <td className="px-2 py-1.5 text-center">
                      {r?.outcome === "ok" && <CheckCircle2 className="h-4 w-4 text-green-500 inline" />}
                      {r?.outcome === "fail" && <XCircle className="h-4 w-4 text-red-500 inline" />}
                      {!r && <Circle className="h-4 w-4 text-muted-foreground/30 inline" />}
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="font-medium">{s.emoji} {s.label}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">{s.id}</div>
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground">{s.desc}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-muted-foreground">
                      {r?.durationMs ? `${(r.durationMs / 1000).toFixed(1)}s` : "—"}
                    </td>
                    <td className="px-2 py-1.5 text-red-500 text-[10px] truncate max-w-[280px]" title={r?.error}>
                      {r?.error || ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Terminal logs={logs} />
    </div>
  );
}