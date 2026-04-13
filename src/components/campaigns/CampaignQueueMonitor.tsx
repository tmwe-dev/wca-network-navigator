import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Play, Pause, XCircle, CheckCircle2, AlertCircle, Clock, Loader2, Mail } from "lucide-react";
import { useEmailCampaignQueue, useProcessQueue } from "@/hooks/useEmailCampaignQueue";

interface CampaignQueueMonitorProps {
  draftId: string;
  queueStatus: string;
  onClose?: () => void;
  onStatusChange?: (status: string) => void;
}

export function CampaignQueueMonitor({ draftId, queueStatus, onClose, onStatusChange }: CampaignQueueMonitorProps) {
  const { items, stats } = useEmailCampaignQueue(draftId);
  const { processing, startProcessing, pauseProcessing, cancelProcessing } = useProcessQueue();

  const progressPercent = stats.total > 0 
    ? ((stats.sent + stats.failed + stats.cancelled) / stats.total) * 100 
    : 0;

  const isActive = queueStatus === "processing" || processing;
  const isPaused = queueStatus === "paused";
  const isCompleted = queueStatus === "completed";
  const isCancelled = queueStatus === "cancelled";

  const statusBadge = useMemo(() => {
    if (isActive) return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Invio in corso</Badge>;
    if (isPaused) return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"><Pause className="w-3 h-3 mr-1" /> In pausa</Badge>;
    if (isCompleted) return <Badge className="bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle2 className="w-3 h-3 mr-1" /> Completata</Badge>;
    if (isCancelled) return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><XCircle className="w-3 h-3 mr-1" /> Annullata</Badge>;
    return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" /> In coda</Badge>;
  }, [isActive, isPaused, isCompleted, isCancelled]);

  const recentItems = useMemo(() => {
    const sorted = [...items].sort((a, b) => {
      const order: Record<string, number> = { sending: 0, sent: 1, failed: 2, pending: 3, cancelled: 4 };
      return (order[a.status] ?? 5) - (order[b.status] ?? 5);
    });
    return sorted.slice(0, 50);
  }, [items]);

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="w-4 h-4 text-primary" />
            Monitor Campagna
          </CardTitle>
          {statusBadge}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progresso</span>
            <span className="font-mono">{stats.sent + stats.failed}/{stats.total}</span>
          </div>
          <Progress value={progressPercent} className="h-3" />
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-4 gap-2">
          <StatBox label="In coda" value={stats.pending} icon={<Clock className="w-3.5 h-3.5" />} color="text-muted-foreground" />
          <StatBox label="Inviate" value={stats.sent} icon={<CheckCircle2 className="w-3.5 h-3.5" />} color="text-green-400" />
          <StatBox label="Fallite" value={stats.failed} icon={<AlertCircle className="w-3.5 h-3.5" />} color="text-red-400" />
          <StatBox label="Annullate" value={stats.cancelled} icon={<XCircle className="w-3.5 h-3.5" />} color="text-muted-foreground" />
        </div>

        {/* Controls */}
        <div className="flex gap-2">
          {(isCompleted || isCancelled) && onClose && (
            <Button size="sm" variant="outline" onClick={onClose} className="gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Chiudi monitor
            </Button>
          )}
          {(queueStatus === "idle" || isPaused) && !isCompleted && !isCancelled && (
            <Button size="sm" onClick={() => startProcessing(draftId)} disabled={processing || stats.pending === 0}>
              <Play className="w-4 h-4 mr-1" />
              {isPaused ? "Riprendi" : "Avvia invio"}
            </Button>
          )}
          {isActive && (
            <Button size="sm" variant="outline" onClick={() => { pauseProcessing(draftId); onStatusChange?.("paused"); }}>
              <Pause className="w-4 h-4 mr-1" /> Pausa
            </Button>
          )}
          {!isCompleted && !isCancelled && stats.total > 0 && (
            <Button size="sm" variant="destructive" onClick={() => { cancelProcessing(draftId); onStatusChange?.("cancelled"); }} disabled={isCancelled}>
              <XCircle className="w-4 h-4 mr-1" /> Annulla
            </Button>
          )}
        </div>

        {/* Recent items log */}
        {items.length > 0 && (
          <ScrollArea className="h-[200px]">
            <div className="space-y-1">
              {recentItems.map((item) => (
                <div key={item.id} className="flex items-center gap-2 text-xs py-1 border-b border-border/30">
                  <StatusIcon status={item.status} />
                  <span className="truncate flex-1 text-muted-foreground">{item.recipient_email}</span>
                  <span className="truncate max-w-[120px] text-muted-foreground/60">{item.recipient_name}</span>
                  {item.error_message && (
                    <span className="text-destructive truncate max-w-[150px]" title={item.error_message}>
                      {item.error_message}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

function StatBox({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div className="text-center p-2 rounded-lg bg-muted/30 border border-border/50">
      <div className={`flex items-center justify-center gap-1 ${color}`}>
        {icon}
        <span className="text-lg font-bold">{value}</span>
      </div>
      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "sent": return <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0" />;
    case "failed": return <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />;
    case "sending": return <Loader2 className="w-3 h-3 text-blue-400 animate-spin shrink-0" />;
    case "cancelled": return <XCircle className="w-3 h-3 text-muted-foreground shrink-0" />;
    default: return <Clock className="w-3 h-3 text-muted-foreground shrink-0" />;
  }
}
