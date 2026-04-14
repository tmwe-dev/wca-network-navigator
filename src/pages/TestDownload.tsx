import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";

const TEST_IDS = [62345, 91027, 90991, 118343, 115505];

type LogEntry = { ts: string; msg: string; type: "info" | "ok" | "warn" | "error" };

interface ExtensionResponse {
  success?: boolean;
  error?: string;
  reason?: string;
  version?: string;
  authenticated?: boolean;
  cookieLength?: number;
  pageLoaded?: boolean;
  htmlLength?: number;
  companyName?: string;
  profileHtml?: string;
  contacts?: Array<{ name?: string; email?: string; title?: string }>;
  profile?: { address?: string; phone?: string; networks?: unknown[] };
}

function ts() {
  return new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/** Send a raw postMessage to the WCA extension and wait for response */
function sendToExtension(action: string, payload: Record<string, unknown> = {}, timeoutMs = 90000): Promise<ExtensionResponse> {
  return new Promise((resolve) => {
    const requestId = `test_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const timer = setTimeout(() => {
      window.removeEventListener("message", handler);
      resolve({ success: false, error: "Timeout after " + (timeoutMs / 1000) + "s" });
    }, timeoutMs);

    function handler(e: MessageEvent) {
      if (e.source !== window) return;
      if (e.data?.direction !== "from-extension") return;
      if (e.data?.requestId !== requestId) return;
      clearTimeout(timer);
      window.removeEventListener("message", handler);
      resolve(e.data.response || { success: false, error: "Empty response" });
    }

    window.addEventListener("message", handler);
    window.postMessage(
      { direction: "from-webapp", action, requestId, ...payload },
      window.location.origin
    );
  });
}

export default function TestDownload() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [delay, setDelay] = useState(25);
  const abortRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const log = useCallback((msg: string, type: LogEntry["type"] = "info") => {
    setLogs((prev) => [...prev, { ts: ts(), msg, type }]);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, []);

  const runTest = useCallback(async () => {
    abortRef.current = false;
    setRunning(true);
    setLogs([]);

    // 1. Check extension availability
    log("🔌 Checking extension availability...");
    const ping = await sendToExtension("ping", {}, 5000);
    if (!ping?.success) {
      log("❌ Extension not reachable: " + (ping?.error || "no response"), "error");
      setRunning(false);
      return;
    }
    log("✅ Extension is alive (v" + (ping.version || "?") + ")", "ok");

    // 2. Verify session
    log("🔑 Verifying WCA session...");
    const session = await sendToExtension("verifySession", {}, 30000);
    log(`Session: authenticated=${session?.authenticated}, cookieLength=${session?.cookieLength}, pageLoaded=${session?.pageLoaded}`, session?.authenticated ? "ok" : "warn");

    // 3. Loop through test IDs
    for (let i = 0; i < TEST_IDS.length; i++) {
      if (abortRef.current) {
        log("🛑 Aborted by user", "warn");
        break;
      }

      const wcaId = TEST_IDS[i];
      log(`\n━━━ [${i + 1}/${TEST_IDS.length}] START #${wcaId} ━━━`);
      const t0 = performance.now();

      // Try extraction
      const res = await sendToExtension("extractContacts", { wcaId }, 90000);
      const elapsed = ((performance.now() - t0) / 1000).toFixed(1);

      if (!res) {
        log(`❌ #${wcaId} — null response after ${elapsed}s`, "error");
      } else if (!res.success) {
        log(`❌ #${wcaId} — FAILED: ${res.error || res.reason || "unknown"} (${elapsed}s)`, "error");
        if (res.htmlLength) log(`   htmlLength=${res.htmlLength}`, "warn");
      } else {
        const contactCount = res.contacts?.length || 0;
        const membersOnly = res.profileHtml?.includes("Members only") ? " ⚠️ MEMBERS_ONLY" : "";
        log(`✅ #${wcaId} — "${res.companyName}" — contacts=${contactCount} — htmlLength=${res.htmlLength || "?"} (${elapsed}s)${membersOnly}`, "ok");

        // Log H1 from profileHtml if available
        if (res.profileHtml) {
          const h1Match = res.profileHtml.match(/<h1[^>]*>(.*?)<\/h1>/i);
          if (h1Match) log(`   H1: "${h1Match[1].replace(/<[^>]+>/g, "").trim()}"`, "info");
        }

        // Log first contact
        if (res.contacts?.[0]) {
          const c = res.contacts[0];
          log(`   Contact 1: ${c.name || "?"} | ${c.email || "no-email"} | ${c.title || ""}`, "info");
        }

        // Log profile fields
        if (res.profile) {
          const p = res.profile;
          log(`   Address: ${p.address || "?"} | Phone: ${p.phone || "?"} | Networks: ${p.networks?.length || 0}`, "info");
        }
      }

      log(`DONE #${wcaId} in ${elapsed}s`);

      // Wait before next
      if (i < TEST_IDS.length - 1 && !abortRef.current) {
        log(`⏳ Waiting ${delay}s before next...`, "info");
        await new Promise((r) => {
          const interval = setInterval(() => {
            if (abortRef.current) { clearInterval(interval); r(undefined); }
          }, 500);
          setTimeout(() => { clearInterval(interval); r(undefined); }, delay * 1000);
        });
      }
    }

    log("\n🏁 Test completato.", "ok");
    setRunning(false);
  }, [delay, log]);

  const abort = () => { abortRef.current = true; };

  const colorMap = { info: "text-muted-foreground", ok: "text-green-400", warn: "text-yellow-400", error: "text-red-400" };

  return (
    <div className="min-h-screen bg-background text-foreground p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">🧪 Brand New — Test Download ZA</h1>
      <p className="text-muted-foreground text-sm mb-6">
        Comunicazione diretta con l'estensione. Nessun codice condiviso con il processore.
        IDs: {TEST_IDS.join(", ")}
      </p>

      <div className="flex items-center gap-4 mb-4">
        <Button onClick={runTest} disabled={running} size="lg">
          {running ? "In corso..." : "🚀 Avvia Test"}
        </Button>
        {running && (
          <Button onClick={abort} variant="destructive" size="sm">
            Stop
          </Button>
        )}
      </div>

      <div className="flex items-center gap-3 mb-6">
        <span className="text-sm text-muted-foreground whitespace-nowrap">Delay: {delay}s</span>
        <Slider
          min={5} max={60} step={1}
          value={[delay]}
          onValueChange={([v]) => setDelay(v)}
          className="w-48"
          disabled={running}
        />
      </div>

      {/* Terminal */}
      <ScrollArea className="h-[500px] rounded-lg border border-border bg-card p-4 font-mono text-xs">
        {logs.length === 0 && (
          <p className="text-muted-foreground">Premi "Avvia Test" per iniziare...</p>
        )}
        {logs.map((l, i) => (
          <div key={i} className={colorMap[l.type]}>
            <span className="text-muted-foreground/60">[{l.ts}]</span> {l.msg}
          </div>
        ))}
        <div ref={bottomRef} />
      </ScrollArea>
    </div>
  );
}
