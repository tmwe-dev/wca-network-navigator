/**
 * OutreachFunnel — Funnel visualization of conversion stages
 */
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface OutreachFunnelProps {
  data: {
    contacted: number;
    replied: number;
    interested: number;
    meeting: number;
    deal: number;
  };
  loading?: boolean;
}

interface FunnelStage {
  label: string;
  value: number;
  color: string;
}

export function OutreachFunnel({ data, loading = false }: OutreachFunnelProps) {
  if (loading) {
    return (
      <Card className="p-4">
        <Skeleton className="h-96 w-full rounded" />
      </Card>
    );
  }

  const stages: FunnelStage[] = [
    { label: "Contattati", value: data.contacted, color: "bg-blue-500" },
    { label: "Risposte", value: data.replied, color: "bg-indigo-500" },
    { label: "Interessati", value: data.interested, color: "bg-violet-500" },
    { label: "Riunioni", value: data.meeting, color: "bg-fuchsia-500" },
    { label: "Affari", value: data.deal, color: "bg-pink-500" },
  ];

  const maxValue = Math.max(...stages.map((s) => s.value), 1);
  const totalValue = data.contacted || 1;

  return (
    <Card className="p-4">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">
          Funnel di Conversione Outreach
        </h3>
        <p className="text-xs text-muted-foreground">
          Tassi di conversione da contatto a affare
        </p>
      </div>

      <div className="space-y-4 py-4">
        {stages.map((stage, index) => {
          const percentage = totalValue > 0 ? (stage.value / totalValue) * 100 : 0;
          const width = (stage.value / maxValue) * 100;
          const nextStage = stages[index + 1];
          const conversionRate =
            nextStage && stage.value > 0
              ? ((nextStage.value / stage.value) * 100).toFixed(1)
              : "0";

          return (
            <div key={stage.label} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">
                  {stage.label}
                </span>
                <span className="text-xs text-muted-foreground">
                  {stage.value.toLocaleString("it-IT")} ({percentage.toFixed(1)}%)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "h-10 rounded-lg transition-all duration-300 shadow-sm",
                    stage.color
                  )}
                  style={{ width: `${width}%` }}
                />
                {nextStage && (
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {conversionRate}%
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-2 pt-4 border-t border-border/50">
        <div className="text-center py-2">
          <p className="text-xs text-muted-foreground">Tasso Complessivo</p>
          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
            {totalValue > 0
              ? ((data.deal / data.contacted) * 100).toFixed(1)
              : "0"}
            %
          </p>
        </div>
        <div className="text-center py-2">
          <p className="text-xs text-muted-foreground">Tasso Risposta</p>
          <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
            {totalValue > 0
              ? ((data.replied / data.contacted) * 100).toFixed(1)
              : "0"}
            %
          </p>
        </div>
      </div>
    </Card>
  );
}
