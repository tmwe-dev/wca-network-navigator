/**
 * DiagnosticsPage — Real system health checks
 */
import * as React from "react";
import { useDiagnosticsV2 } from "@/v2/hooks/useDiagnosticsV2";
import { Button } from "../atoms/Button";
import { StatusBadge } from "../atoms/StatusBadge";
import { Database, ShieldCheck, Server, Globe, HardDrive } from "lucide-react";

const ICONS: Record<string, React.ReactNode> = {
  Database: <Database className="h-4 w-4" />,
  Autenticazione: <ShieldCheck className="h-4 w-4" />,
  "Edge Functions": <Server className="h-4 w-4" />,
  "WCA API": <Globe className="h-4 w-4" />,
  Storage: <HardDrive className="h-4 w-4" />,
};

export function DiagnosticsPage(): React.ReactElement {
  const { checks, running, run } = useDiagnosticsV2();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Diagnostica</h1>
          <p className="text-sm text-muted-foreground">Verifica stato connessioni e servizi.</p>
        </div>
        <Button onClick={run} isLoading={running}>
          {running ? "Verificando..." : "Esegui diagnostica"}
        </Button>
      </div>

      {checks.length === 0 && !running ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Premi "Esegui diagnostica" per verificare lo stato di tutti i servizi.
        </p>
      ) : null}

      <div className="space-y-3">
        {checks.map((check) => (
          <div key={check.name} className="flex items-center justify-between p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-3">
              {ICONS[check.name] ?? <Server className="h-4 w-4" />}
              <span className="font-medium text-foreground">{check.name}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground font-mono">{check.latencyMs}ms</span>
              <span className="text-sm text-muted-foreground max-w-[200px] truncate">{check.message}</span>
              <StatusBadge
                status={check.status === "ok" ? "success" : check.status === "error" ? "error" : "warning"}
                label={check.status === "ok" ? "OK" : check.status === "error" ? "Errore" : "..."}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
