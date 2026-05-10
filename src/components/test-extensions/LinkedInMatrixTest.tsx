/**
 * LinkedInMatrixTest — Test runner per TUTTE le versioni LinkedIn in archivio.
 *
 * Workflow operativo (richiesto dall'utente):
 *   1. Scarica la versione X dall'elenco
 *   2. Caricala manualmente in chrome://extensions (rimuovendo la precedente)
 *   3. Premi "Esegui suite" → il runner rileva la versione installata via ping,
 *      poi esegue 6 test di scrittura (sendMessage standard + 5 metodi
 *      diagnostici) con pause di sicurezza fra l'uno e l'altro per non
 *      farsi bloccare da LinkedIn.
 *   4. Risultati salvati in localStorage indicizzati per versione → matrice
 *      verde/rosso persistente. Riapri la pagina, vedi il quadro completo.
 *
 * Pause di sicurezza:
 *   - 12s tra ogni test di scrittura (LinkedIn rate-limit)
 *   - 25s pausa lunga ogni 3 test (rolling window)
 *
 * UI-only: nessun side-effect AI/DB. Solo postMessage all'estensione.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Terminal, type LogEntry, ts } from "./Terminal";
import { liMsg } from "./extensionBridge";
import { CheckCircle2, XCircle, Circle, Download, Play, Trash2 } from "lucide-react";

// Tutte le 59 versioni in archivio (sort semver crescente)
const LI_VERSIONS = [
  "3.4.0","3.5.0","3.6.0","3.7.0","3.9.0","3.9.2","3.9.3","3.9.4","3.9.8","3.9.9",
  "3.9.10","3.9.11","3.9.12","3.9.13","3.9.14","3.9.15","3.9.16","3.9.17","3.9.18","3.9.19",
  "3.9.20","3.9.21","3.9.22","3.9.23","3.9.24","3.9.25","3.9.26","3.9.27","3.9.28","3.9.29",
  "3.9.31","3.9.32","3.9.33","3.9.34","3.9.35","3.9.36","3.9.37","3.9.38","3.9.39","3.9.40",
  "3.9.41","3.9.42","3.9.43","3.9.44","3.9.45","3.9.46","3.9.47","3.9.48","3.9.49","3.9.50",
  "3.9.51","3.9.52","3.9.53","3.9.54","3.9.55","3.9.56","3.9.57","3.9.58","3.9.59",
];

const STORAGE_KEY = "li_matrix_results_v1";
const FIXED_RECIPIENT_KEY = "li_test_fixed_recipient";
const PAUSE_BETWEEN_TESTS_MS = 12_000;
const LONG_PAUSE_EVERY = 3;
const LONG_PAUSE_MS = 25_000;

type TestId = "sendMessage" | "physical_click" | "form_submit" | "keyboard_shortcut" | "cdp_physical_click" | "cdp_ctrl_enter";

const TESTS: Array<{ id: TestId; label: string; emoji: string }> = [
  { id: "sendMessage", label: "Pipeline standard", emoji: "📤" },
  { id: "physical_click", label: "Click fisico", emoji: "🖱️" },
  { id: "form_submit", label: "Form submit", emoji: "📋" },
  { id: "keyboard_shortcut", label: "Ctrl+Enter", emoji: "⌨️" },
  { id: "cdp_physical_click", label: "CDP click", emoji: "🎯" },
  { id: "cdp_ctrl_enter", label: "CDP Ctrl+Enter", emoji: "⌘" },
];

type Outcome = "ok" | "fail" | "skip";
interface RunResult {
  outcome: Outcome;
  error?: string;
  at: string;
}
type MatrixResults = Record<string, Partial<Record<TestId, RunResult>>>;

function loadResults(): MatrixResults {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as MatrixResults;
  } catch { return {}; }
}

function saveResults(r: MatrixResults): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(r)); } catch { /* ignore */ }
}

async function downloadZip(version: string): Promise<void> {
  const url = `/chrome-extensions/linkedin/linkedin-extension-${version}.zip?t=${Date.now()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `linkedin-extension-${version}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function LinkedInMatrixTest() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [results, setResults] = useState<MatrixResults>(loadResults);
  const [running, setRunning] = useState(false);
  const [installedVersion, setInstalledVersion] = useState<string | null>(null);
  const [recipient, setRecipient] = useState("");
  const [messageText, setMessageText] = useState("Test matrix LinkedIn — verifica invio");
  const [countdown, setCountdown] = useState(0);
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

  // Detect versione installata via ping
  const detectInstalled = useCallback(async () => {
    log("🔌 Ping estensione per rilevare versione installata...");
    const r = await liMsg("ping", {}, 5000);
    const v = (r as { version?: string })?.version;
    if (v) {
      setInstalledVersion(v);
      log(`✅ Versione installata rilevata: v${v}`, "ok");
      if (!LI_VERSIONS.includes(v)) {
        log(`⚠️ v${v} non è nell'archivio noto — i risultati verranno salvati comunque`, "warn");
      }
    } else {
      setInstalledVersion(null);
      log("❌ Estensione non risponde. Installa una versione e riprova.", "error");
    }
    return v ?? null;
  }, [log]);

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

  const runOneTest = useCallback(async (test: typeof TESTS[number]): Promise<RunResult> => {
    log(`${test.emoji} → ${test.label} (${test.id})`, "info");
    try {
      const action = test.id === "sendMessage" ? "sendMessage" : "sendMessageWithMethod";
      const payload: Record<string, unknown> = { url: recipient, message: messageText };
      if (test.id !== "sendMessage") payload.method = test.id;
      const r = await liMsg(action, payload, 90_000) as Record<string, unknown>;
      if (r?.success) {
        log(`  ✅ ${test.label}: OK`, "ok");
        return { outcome: "ok", at: new Date().toISOString() };
      }
      const err = String(r?.error || JSON.stringify(r)).slice(0, 200);
      log(`  ❌ ${test.label}: ${err}`, "error");
      return { outcome: "fail", error: err, at: new Date().toISOString() };
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      log(`  ❌ ${test.label} eccezione: ${err}`, "error");
      return { outcome: "fail", error: err, at: new Date().toISOString() };
    }
  }, [recipient, messageText, log]);

  const runSuite = useCallback(async () => {
    if (!recipient.trim()) { log("⛔ Inserisci il destinatario LinkedIn fisso", "error"); return; }
    if (!messageText.trim()) { log("⛔ Inserisci il testo del messaggio", "error"); return; }
    setRunning(true);
    abortRef.current = false;
    try {
      const version = await detectInstalled();
      if (!version) return;
      log(`🧪 Avvio suite (6 test) su v${version}. Pause: ${PAUSE_BETWEEN_TESTS_MS / 1000}s tra test, ${LONG_PAUSE_MS / 1000}s ogni ${LONG_PAUSE_EVERY}.`, "info");
      const next: MatrixResults = { ...results, [version]: { ...(results[version] || {}) } };
      for (let i = 0; i < TESTS.length; i++) {
        if (abortRef.current) break;
        const t = TESTS[i];
        const res = await runOneTest(t);
        next[version]![t.id] = res;
        setResults({ ...next });
        saveResults(next);
        if (i < TESTS.length - 1) {
          const longPause = (i + 1) % LONG_PAUSE_EVERY === 0;
          await safePause(longPause ? LONG_PAUSE_MS : PAUSE_BETWEEN_TESTS_MS, longPause ? "ciclo lungo anti rate-limit" : "tra test");
        }
      }
      const v = next[version]!;
      const ok = TESTS.filter((t) => v[t.id]?.outcome === "ok").length;
      log(`🏁 Suite completata su v${version}: ${ok}/${TESTS.length} test OK`, ok === TESTS.length ? "ok" : "warn");
    } catch (e) {
      if (e instanceof Error && e.message === "ABORTED") { /* già loggato */ }
      else log(`❌ Errore suite: ${e instanceof Error ? e.message : String(e)}`, "error");
    } finally {
      setRunning(false);
      setCountdown(0);
    }
  }, [recipient, messageText, detectInstalled, results, runOneTest, safePause, log]);

  const stopSuite = useCallback(() => { abortRef.current = true; }, []);

  const clearMatrix = useCallback(() => {
    if (!window.confirm("Cancellare TUTTI i risultati matrice salvati?")) return;
    setResults({});
    saveResults({});
    log("🗑️ Matrice azzerata", "info");
  }, [log]);

  const exportJson = useCallback(() => {
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `linkedin-matrix-results-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }, [results]);

  const summary = useMemo(() => {
    const versions = Object.keys(results);
    let ok = 0, fail = 0;
    for (const v of versions) {
      for (const t of TESTS) {
        const r = results[v]?.[t.id];
        if (r?.outcome === "ok") ok++;
        else if (r?.outcome === "fail") fail++;
      }
    }
    return { tested: versions.length, ok, fail };
  }, [results]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">🧪 LinkedIn Matrix Runner</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {LI_VERSIONS.length} versioni in archivio · {summary.tested} testate · {summary.ok} OK · {summary.fail} KO
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={detectInstalled} disabled={running} size="sm" variant="outline">🔌 Rileva versione installata</Button>
            <Button onClick={exportJson} size="sm" variant="ghost" disabled={!summary.tested}>⬇️ Export JSON</Button>
            <Button onClick={clearMatrix} size="sm" variant="ghost" disabled={!summary.tested}>
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Reset matrice
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground">Destinatario LinkedIn (URL profilo o thread)</label>
            <Input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="https://www.linkedin.com/in/..." className="text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Testo messaggio (verrà inviato 6 volte)</label>
            <Input value={messageText} onChange={(e) => setMessageText(e.target.value)} className="text-sm" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-border/50">
          <div className="text-xs text-muted-foreground">
            Versione installata: <span className="font-mono font-semibold">{installedVersion ? `v${installedVersion}` : "?"}</span>
          </div>
          {countdown > 0 && (
            <span className="text-xs font-mono text-yellow-500 animate-pulse">⏳ pausa {countdown}s</span>
          )}
          <div className="ml-auto flex gap-2">
            {!running && (
              <Button onClick={runSuite} disabled={!recipient.trim() || !messageText.trim()} size="sm">
                <Play className="h-3.5 w-3.5 mr-1" /> Esegui suite (6 test)
              </Button>
            )}
            {running && (
              <Button onClick={stopSuite} size="sm" variant="destructive">🛑 Stop</Button>
            )}
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Pause di sicurezza: <b>{PAUSE_BETWEEN_TESTS_MS / 1000}s</b> tra ogni test, <b>{LONG_PAUSE_MS / 1000}s</b> ogni {LONG_PAUSE_EVERY} test.
          Per cambiare versione: scarica con il pulsante ⬇️ accanto, vai su <code>chrome://extensions</code>, rimuovi la vecchia, "Carica estensione non pacchettizzata" sulla cartella decompressa, poi torna qui e premi "Esegui suite".
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-3 py-2 border-b border-border bg-muted/30">
          <h4 className="text-xs font-semibold">Matrice versioni × test ({LI_VERSIONS.length} righe)</h4>
        </div>
        <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur z-10">
              <tr>
                <th className="text-left px-2 py-1.5 font-medium">Versione</th>
                {TESTS.map((t) => (
                  <th key={t.id} className="px-2 py-1.5 font-medium text-center" title={t.label}>
                    {t.emoji}
                  </th>
                ))}
                <th className="px-2 py-1.5 text-right font-medium">Azione</th>
              </tr>
            </thead>
            <tbody>
              {[...LI_VERSIONS].reverse().map((v) => {
                const isInstalled = installedVersion === v;
                const row = results[v];
                return (
                  <tr key={v} className={`border-t border-border/50 ${isInstalled ? "bg-primary/5" : ""}`}>
                    <td className="px-2 py-1 font-mono">
                      {isInstalled && <span className="text-primary mr-1">●</span>}
                      v{v}
                    </td>
                    {TESTS.map((t) => {
                      const r = row?.[t.id];
                      return (
                        <td key={t.id} className="px-2 py-1 text-center" title={r?.error || r?.at || "non testato"}>
                          {r?.outcome === "ok" && <CheckCircle2 className="h-3.5 w-3.5 text-green-500 inline" />}
                          {r?.outcome === "fail" && <XCircle className="h-3.5 w-3.5 text-red-500 inline" />}
                          {!r && <Circle className="h-3.5 w-3.5 text-muted-foreground/30 inline" />}
                        </td>
                      );
                    })}
                    <td className="px-2 py-1 text-right">
                      <button
                        type="button"
                        onClick={async () => {
                          try { await downloadZip(v); log(`⬇️ Scaricato linkedin-extension-${v}.zip`, "ok"); }
                          catch (e) { log(`❌ Download v${v} fallito: ${e instanceof Error ? e.message : String(e)}`, "error"); }
                        }}
                        className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                        title={`Scarica linkedin-extension-${v}.zip`}
                      >
                        <Download className="h-3 w-3" /> zip
                      </button>
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