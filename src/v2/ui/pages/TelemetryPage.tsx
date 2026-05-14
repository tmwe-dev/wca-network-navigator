/**
 * TelemetryPage V2 — Admin-only page for telemetry metrics and logs.
 */
import { useMemo } from "react";
import { useTrackPage } from "@/hooks/useTrackPage";
import { useUrlState } from "@/hooks/useUrlState";
import { useRequireRole } from "@/v2/hooks/useRequireRole";
import type { TabKey } from "@/v2/ui/pages/telemetry/types";
import { TABS, RANGES } from "@/v2/ui/pages/telemetry/constants";
import { PageEventsView } from "@/v2/ui/pages/telemetry/PageEventsView";
import { RequestLogsView } from "@/v2/ui/pages/telemetry/RequestLogsView";
import { AIRequestLogsView } from "@/v2/ui/pages/telemetry/AIRequestLogsView";
import { PageShell } from "@/v2/ui/templates/PageShell";

export function TelemetryPage() {
  const isAdmin = useRequireRole({ role: "admin" });

  useTrackPage("telemetry");
  const [tab, setTab] = useUrlState<TabKey>("tab", "events");
  const [range, setRange] = useUrlState<string>("range", "24h");

  const sinceIso = useMemo(() => {
    const hours = RANGES.find((r) => r.key === range)?.hours ?? 24;
    return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  }, [range]);

  if (!isAdmin) {
    return (
      <PageShell title="Telemetria">
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          Accesso riservato agli amministratori.
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      width="wide"
      title="Telemetria"
      description="Cosa sta succedendo nel sistema in tempo reale"
      actions={
        <select
          value={range}
          onChange={(e) => setRange(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {RANGES.map((r) => (
            <option key={r.key} value={r.key}>{r.label}</option>
          ))}
        </select>
      }
      toolbar={
        <div className="inline-flex rounded-md bg-muted p-0.5 text-xs font-medium">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-sm transition ${
                tab === t.key ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="mr-1">{t.icon}</span>{t.label}
            </button>
          ))}
        </div>
      }
    >
      {tab === "events" && <PageEventsView sinceIso={sinceIso} />}
      {tab === "requests" && <RequestLogsView sinceIso={sinceIso} />}
      {tab === "ai" && <AIRequestLogsView sinceIso={sinceIso} />}
    </PageShell>
  );
}
