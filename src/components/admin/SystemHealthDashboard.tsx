import * as React from "react";
import { useTranslation } from "react-i18next";
import { useSystemHealth, type HealthCheck } from "@/hooks/useSystemHealth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Database, Shield, HardDrive, BrainCircuit, RefreshCw } from "lucide-react";

const SERVICE_ICONS: Record<string, React.ReactNode> = {
  database: <Database className="h-4 w-4" />,
  auth: <Shield className="h-4 w-4" />,
  storage: <HardDrive className="h-4 w-4" />,
  ai_gateway: <BrainCircuit className="h-4 w-4" />,
};

function getHistory(): HealthCheck[] {
  try {
    return JSON.parse(localStorage.getItem("health-history") || "[]");
  } catch { return []; }
}

function pushHistory(entry: HealthCheck) {
  const hist = getHistory();
  hist.push(entry);
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const filtered = hist.filter((h) => new Date(h.timestamp).getTime() > cutoff);
  localStorage.setItem("health-history", JSON.stringify(filtered.slice(-200)));
}

export function SystemHealthDashboard() {
  const { t } = useTranslation();
  const { data, isLoading, refetch, dataUpdatedAt } = useSystemHealth();

  React.useEffect(() => {
    if (data) pushHistory(data);
  }, [data]);

  const history = getHistory();

  return (
    <div className="space-y-6" data-testid="page-system-health">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">System Health</h1>
        </div>
        <div className="flex items-center gap-3">
          {data && (
            <Badge variant={data.status === "healthy" ? "default" : "destructive"}>
              {data.status}
            </Badge>
          )}
          <button onClick={() => refetch()} className="p-1.5 rounded hover:bg-accent transition-colors">
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {data && Object.entries(data.checks).map(([service, status]) => (
          <Card key={service}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                {SERVICE_ICONS[service] || <Activity className="h-4 w-4" />}
                {service.replace(/_/g, " ")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant={status === "ok" ? "default" : "destructive"} className="text-xs">
                {status}
              </Badge>
              {status === "fail" && (
                <p className="text-xs text-muted-foreground mt-1">
                  Last OK: {
                    history.findLast((h) => h.checks[service] === "ok")?.timestamp
                      ? new Date(history.findLast((h) => h.checks[service] === "ok")!.timestamp).toLocaleTimeString()
                      : "N/A"
                  }
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {dataUpdatedAt && (
        <p className="text-xs text-muted-foreground">
          Last checked: {new Date(dataUpdatedAt).toLocaleTimeString()} · Auto-refreshes every 30s
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">24h History ({history.length} checks)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-0.5 flex-wrap">
            {history.slice(-100).map((h, i) => (
              <div
                key={i}
                className={`w-2 h-6 rounded-sm ${h.status === "healthy" ? "bg-green-500" : "bg-destructive"}`}
                title={`${h.timestamp}: ${h.status}`}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
