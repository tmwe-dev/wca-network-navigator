import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listFunnemailBrain, type FunnemailBrainRow } from "@/data/funnemailBrain";
import { listEmailProcessingJobs } from "@/data/emailProcessingJobs";
import { useMemo } from "react";

const QK_BRAIN = ["funnemail", "brain"] as const;
const QK_JOBS = ["funnemail", "ops-jobs"] as const;

export default function EmailIntelligenceOperationsPage() {
  const { data: brain = [] } = useQuery({ queryKey: QK_BRAIN, queryFn: () => listFunnemailBrain(50), refetchInterval: 15000 });
  const { data: jobs = [] } = useQuery({ queryKey: QK_JOBS, queryFn: () => listEmailProcessingJobs({ limit: 200 }), refetchInterval: 15000 });

  const stats = useMemo(() => {
    const counts: Record<string, number> = { received: 0, classified: 0, routed: 0, completed: 0, failed: 0, dlq: 0 };
    for (const j of jobs) counts[j.stage] = (counts[j.stage] ?? 0) + 1;
    return counts;
  }, [jobs]);

  // KPI live derivati dai dati già caricati (no extra query, refresh ogni 15s)
  const kpis = useMemo(() => {
    const now = Date.now();
    const oneHourAgo = now - 3600_000;
    const lastHour = brain.filter((b) => new Date(b.received_at).getTime() >= oneHourAgo);
    const withDecision = brain.filter((b) => b.decision_action != null);
    const highConf = brain.filter((b) => (b.decision_confidence ?? 0) >= 0.7);
    const queueDepth = (stats.received ?? 0) + (stats.classified ?? 0) + (stats.routed ?? 0);
    return {
      perHour: lastHour.length,
      accuracyPct: brain.length ? Math.round((highConf.length / brain.length) * 100) : 0,
      claimRatePct: brain.length ? Math.round((withDecision.length / brain.length) * 100) : 0,
      queueDepth,
    };
  }, [brain, stats]);

  return (
    <div className="flex flex-col gap-4 p-4 overflow-auto">
      <h1 className="text-xl font-semibold">Funnemail Operations</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Card>
          <CardContent className="py-3">
            <div className="text-xs text-muted-foreground uppercase">Smistati / ora</div>
            <div className="text-2xl font-semibold">{kpis.perHour}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <div className="text-xs text-muted-foreground uppercase">Accuracy ≥70%</div>
            <div className="text-2xl font-semibold">{kpis.accuracyPct}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <div className="text-xs text-muted-foreground uppercase">Claim rate</div>
            <div className="text-2xl font-semibold">{kpis.claimRatePct}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <div className="text-xs text-muted-foreground uppercase">Queue depth</div>
            <div className={`text-2xl font-semibold ${kpis.queueDepth > 50 ? "text-warning" : ""}`}>{kpis.queueDepth}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        {Object.entries(stats).map(([stage, count]) => (
          <Card key={stage}>
            <CardContent className="py-3">
              <div className="text-xs text-muted-foreground uppercase">{stage}</div>
              <div className="text-2xl font-semibold">{count}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Brain (ultimi 50 messaggi)</CardTitle></CardHeader>
        <CardContent className="grid gap-2">
          {brain.map((b: FunnemailBrainRow) => (
            <div key={b.message_id} className="flex items-center gap-3 text-sm border-b pb-2">
              <Badge variant={b.job_stage === "completed" ? "secondary" : b.job_stage === "failed" || b.job_stage === "dlq" ? "destructive" : "outline"}>
                {b.job_stage ?? "n/a"}
              </Badge>
              <span className="truncate flex-1">{b.from_address ?? "?"} — {b.subject ?? "(no subject)"}</span>
              {b.decision_action && <Badge variant="outline">{b.decision_action} {b.decision_confidence != null ? `(${Math.round(b.decision_confidence * 100)}%)` : ""}</Badge>}
              <span className="text-xs text-muted-foreground">{new Date(b.received_at).toLocaleString()}</span>
              <span className="text-xs text-muted-foreground">{b.actions_ok_count}/{b.actions_count} azioni</span>
            </div>
          ))}
          {brain.length === 0 && <p className="text-sm text-muted-foreground">Nessun messaggio.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
