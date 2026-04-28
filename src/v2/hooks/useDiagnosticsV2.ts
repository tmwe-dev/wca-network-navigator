/**
 * useDiagnosticsV2 — Real system health checks
 */
import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CheckStatus = "idle" | "checking" | "ok" | "error";

export interface DiagCheck {
  readonly name: string;
  readonly status: CheckStatus;
  readonly latencyMs: number;
  readonly message: string;
}

async function timedCheck(
  name: string,
  fn: () => Promise<string>,
): Promise<DiagCheck> {
  const start = performance.now();
  try {
    const msg = await fn();
    return { name, status: "ok", latencyMs: Math.round(performance.now() - start), message: msg };
  } catch (e) {
    return {
      name,
      status: "error",
      latencyMs: Math.round(performance.now() - start),
      message: e instanceof Error ? e.message : String(e),
    };
  }
}

export function useDiagnosticsV2() {
  const [checks, setChecks] = useState<readonly DiagCheck[]>([]);
  const [running, setRunning] = useState(false);

  const run = useCallback(async () => {
    setRunning(true);
    setChecks([]);

    const results: DiagCheck[] = [];

    // 1) Database ping
    const dbCheck = await timedCheck("Database", async () => {
      const { error } = await supabase.from("app_settings").select("id").limit(1);
      if (error) throw error;
      return "Connesso";
    });
    results.push(dbCheck);
    setChecks([...results]);

    // 2) Auth session
    const authCheck = await timedCheck("Autenticazione", async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (!session) throw new Error("Nessuna sessione attiva");
      return `Sessione attiva (${session.user.email})`;
    });
    results.push(authCheck);
    setChecks([...results]);

    // 3) Edge Functions
    const edgeCheck = await timedCheck("Edge Functions", async () => {
      const { error } = await supabase.functions.invoke("ai-assistant", {
        // Charter R1+R2: ping diagnostico marcato esplicitamente
        body: {
          ping: true,
          scope: "diagnostics",
          context: { source: "useDiagnosticsV2", route: "/v2/diagnostics", mode: "ping" },
        },
      });
      // Even a 400 means edge functions are reachable
      if (error && !error.message.includes("validation")) {
        return "Raggiungibile (con warning)";
      }
      return "Raggiungibile";
    });
    results.push(edgeCheck);
    setChecks([...results]);

    // 4) WCA API
    const wcaCheck = await timedCheck("WCA API", async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const resp = await fetch("https://wca-app.vercel.app/api/health", {
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return "Online";
      } catch (e) {
        clearTimeout(timeout);
        if (e instanceof Error && e.name === "AbortError") throw new Error("Timeout");
        throw e;
      }
    });
    results.push(wcaCheck);
    setChecks([...results]);

    // 5) Storage
    const storageCheck = await timedCheck("Storage", async () => {
      const { data, error } = await supabase.storage.listBuckets();
      if (error) throw error;
      return `${data.length} bucket disponibili`;
    });
    results.push(storageCheck);
    setChecks([...results]);

    setRunning(false);
  }, []);

  return { checks, running, run } as const;
}
