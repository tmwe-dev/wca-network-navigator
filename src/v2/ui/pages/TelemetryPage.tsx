/**
 * TelemetryPage V2 — Admin-only page for telemetry metrics and logs.
 */
import { useMemo } from "react";
import { useTrackPage } from "@/hooks/useTrackPage";
import { useUrlState } from "@/hooks/useUrlState";
import { useRequireRole } from "@/v2/hooks/useRequireRole";
import type { TabKey } from "@/pages/telemetry/types";
import { TABS, RANGES } from "@/pages/telemetry/constants";
import { PageEventsView } from "@/pages/telemetry/PageEventsView";
import { RequestLogsView } from "@/pages/telemetry/RequestLogsView";
import { AIRequestLogsView } from "@/pages/telemetry/AIRequestLogsView";

export function TelemetryPage() {
  const isAdmin = useRequireRole({ role: "admin" });

  if (!isAdmin) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Accesso riservato agli amministratori.
      </div>
    );
  }

  useTrackPage("telemetry");
  const [tab, setTab] = useUrlState<TabKey>("tab", "events");
  const [range, setRange] = useUrlState<string>("range", "24h");

  const sinceIso = useMemo(() => {
    const hours = RANGES.find((r) => r.key === range)?.hours ?? 24;
    return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  }, [range]);

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="px-6 py-4 border-b border-border bg-card">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold text-foreground">Telemetria</h1>
            <p className="text-xs text-muted-foreground">Cosa sta succedendo nel sistema in tempo reale</p>
          </div>
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="text-xs px-3 py-1.5 rounded-lg border border-border bg-card"
          >
            {RANGES.map((r) => (
              <option key={r.key} value={r.key}>{r.label}</option>
            ))}
          </select>
        </div>
        <div className="inline-flex p-0.5 bg-muted rounded-lg text-xs font-medium">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-md transition ${
                tab === t.key ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="mr-1">{t.icon}</span>{t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        {tab === "events" && <PageEventsView sinceIso={sinceIso} />}
        {tab === "requests" && <RequestLogsView sinceIso={sinceIso} />}
        {tab === "ai" && <AIRequestLogsView sinceIso={sinceIso} />}
      </div>
    </div>
  );
}
