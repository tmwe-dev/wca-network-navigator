/**
 * DiagnosticsPage — STEP 9
 * System health and connection diagnostics.
 */

import * as React from "react";
import { useState, useCallback } from "react";
import { Button } from "../atoms/Button";
import { StatusBadge } from "../atoms/StatusBadge";
import { Activity, Database, Wifi, Server } from "lucide-react";

interface DiagnosticCheck {
  readonly name: string;
  readonly icon: React.ReactNode;
  readonly status: "idle" | "checking" | "ok" | "error";
  readonly message?: string;
}

const INITIAL_CHECKS: readonly DiagnosticCheck[] = [
  { name: "Database", icon: <Database className="h-4 w-4" />, status: "idle" },
  { name: "Auth", icon: <Activity className="h-4 w-4" />, status: "idle" },
  { name: "API", icon: <Wifi className="h-4 w-4" />, status: "idle" },
  { name: "Edge Functions", icon: <Server className="h-4 w-4" />, status: "idle" },
];

export function DiagnosticsPage(): React.ReactElement {
  const [checks, setChecks] = useState<readonly DiagnosticCheck[]>(INITIAL_CHECKS);
  const [isRunning, setIsRunning] = useState(false);

  const runDiagnostics = useCallback(async () => {
    setIsRunning(true);
    setChecks((prev) => prev.map((c) => ({ ...c, status: "checking" as const })));

    // Simulate diagnostic checks
    for (let i = 0; i < INITIAL_CHECKS.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      setChecks((prev) =>
        prev.map((c, idx) =>
          idx === i ? { ...c, status: "ok" as const, message: "Connesso" } : c,
        ),
      );
    }
    setIsRunning(false);
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Diagnostica</h1>
          <p className="text-sm text-muted-foreground">
            Verifica stato connessioni e servizi.
          </p>
        </div>
        <Button onClick={runDiagnostics} disabled={isRunning}>
          {isRunning ? "Verificando..." : "Esegui diagnostica"}
        </Button>
      </div>

      <div className="space-y-3">
        {checks.map((check) => (
          <div
            key={check.name}
            className="flex items-center justify-between p-4 rounded-lg border bg-card"
          >
            <div className="flex items-center gap-3">
              {check.icon}
              <span className="font-medium text-foreground">{check.name}</span>
            </div>
            <div className="flex items-center gap-2">
              {check.message ? (
                <span className="text-sm text-muted-foreground">{check.message}</span>
              ) : null}
              <StatusBadge
                status={
                  check.status === "ok"
                    ? "success"
                    : check.status === "error"
                      ? "error"
                      : check.status === "checking"
                        ? "warning"
                        : "neutral"
                }
                label={
                  check.status === "idle"
                    ? "In attesa"
                    : check.status === "checking"
                      ? "Verifica..."
                      : check.status === "ok"
                        ? "OK"
                        : "Errore"
                }
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
