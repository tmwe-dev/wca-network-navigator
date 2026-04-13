import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { createLogger } from "@/lib/log";
import { findJobsByStatusSelect } from "@/data/downloadJobs";

const log = createLogger("RuntimeDiagnosticPanel");

interface DiagState {
  supabaseStatus: "connected" | "auth_missing" | "error";
  userId: string | null;
  extensionStatus: "connected" | "timeout" | "no_extension";
  wcaSession: "valid" | "invalid" | "unknown";
  activeJobs: number;
  queryCacheSize: number;
  lastFailedCall: { endpoint: string; status: number; ts: string } | null;
  lastWcaError: any;
}

export function RuntimeDiagnosticPanel() {
  const [open, setOpen] = useState(false);
  const [diag, setDiag] = useState<DiagState | null>(null);
  const queryClient = useQueryClient();

  const refresh = useCallback(async () => {
    const state: DiagState = {
      supabaseStatus: "error",
      userId: null,
      extensionStatus: "no_extension",
      wcaSession: "unknown",
      activeJobs: 0,
      queryCacheSize: 0,
      lastFailedCall: null,
      lastWcaError: null,
    };

    // Supabase + auth
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        state.supabaseStatus = "connected";
        state.userId = session.user?.id || null;
      } else {
        state.supabaseStatus = "auth_missing";
      }
    } catch (e) {
      log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) });
      state.supabaseStatus = "error";
    }

    // Extension
    try {
      const extOk = await new Promise<boolean>((resolve) => {
        const id = `diag_${Date.now()}`;
        const timer = setTimeout(() => resolve(false), 3000);
        const handler = (e: MessageEvent) => {
          if (e.data?.direction === "from-extension" && e.data?.requestId === id) {
            clearTimeout(timer);
            window.removeEventListener("message", handler);
            resolve(e.data?.response?.success === true);
          }
        };
        window.addEventListener("message", handler);
        window.postMessage({ direction: "from-webapp", action: "ping", requestId: id }, window.location.origin || "*");
      });
      state.extensionStatus = extOk ? "connected" : "timeout";
    } catch (e) {
      log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) });
      state.extensionStatus = "no_extension";
    }

    // Active jobs
    try {
      const data = await findJobsByStatusSelect(["pending", "running"], "id", 10);
      state.activeJobs = data?.length || 0;
    } catch (e) { log.debug("best-effort operation failed", { error: e instanceof Error ? e.message : String(e) }); /* intentionally ignored: best-effort cleanup */ }

    // Cache size
    state.queryCacheSize = queryClient.getQueryCache().getAll().length;

    // Last WCA error
    try {
      const raw = localStorage.getItem("last_wca_error");
      if (raw) state.lastWcaError = JSON.parse(raw);
    } catch (e) { log.debug("best-effort operation failed", { error: e instanceof Error ? e.message : String(e) }); /* intentionally ignored: best-effort cleanup */ }

    // Last failed call
    try {
      const raw = localStorage.getItem("last_failed_network_call");
      if (raw) state.lastFailedCall = JSON.parse(raw);
    } catch (e) { log.debug("best-effort operation failed", { error: e instanceof Error ? e.message : String(e) }); /* intentionally ignored: best-effort cleanup */ }

    setDiag(state);
  }, [queryClient]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "D") {
        e.preventDefault();
        setOpen(o => {
          if (!o) refresh();
          return !o;
        });
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [refresh]);

  if (!open || !diag) return null;

  const _statusDot = (ok: boolean) => (
    <span className={`inline-block w-2 h-2 rounded-full ${ok ? "bg-emerald-400" : "bg-red-400"}`} />
  );

  return (
    <div className="fixed bottom-4 right-4 z-[9999] w-80 bg-background border border-border rounded-xl shadow-2xl text-xs font-mono overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border">
        <span className="text-foreground font-semibold text-[11px]">🔧 Runtime Diagnostics</span>
        <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="p-3 space-y-2 max-h-80 overflow-auto">
        <Row label="Supabase" value={diag.supabaseStatus} dot={diag.supabaseStatus === "connected"} />
        <Row label="User" value={diag.userId ? diag.userId.slice(0, 8) + "…" : "—"} dot={!!diag.userId} />
        <Row label="Extension" value={diag.extensionStatus} dot={diag.extensionStatus === "connected"} />
        <Row label="WCA Session" value={diag.wcaSession} dot={diag.wcaSession === "valid"} />
        <Row label="Active Jobs" value={String(diag.activeJobs)} dot={diag.activeJobs === 0} />
        <Row label="RQ Cache" value={String(diag.queryCacheSize)} dot />

        {diag.lastWcaError && (
          <div className="pt-1 border-t border-border">
            <span className="text-red-400">Last WCA Error:</span>
            <pre className="text-[10px] text-muted-foreground mt-0.5 whitespace-pre-wrap">{JSON.stringify(diag.lastWcaError, null, 1)}</pre>
          </div>
        )}
        {diag.lastFailedCall && (
          <div className="pt-1 border-t border-border">
            <span className="text-red-400">Last Failed Call:</span>
            <pre className="text-[10px] text-muted-foreground mt-0.5">{diag.lastFailedCall.endpoint} → {diag.lastFailedCall.status}</pre>
          </div>
        )}
      </div>
      <div className="px-3 py-1.5 border-t border-border text-muted-foreground text-[10px]">
        Ctrl+Shift+D to close • <button onClick={refresh} className="underline hover:text-foreground">Refresh</button>
      </div>
    </div>
  );
}

function Row({ label, value, dot }: { label: string; value: string; dot?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5 text-foreground">
        <span className={`inline-block w-1.5 h-1.5 rounded-full ${dot ? "bg-emerald-400" : "bg-red-400"}`} />
        {value}
      </span>
    </div>
  );
}
