/**
 * AnalyticsPage — Full analytics dashboard page with date range selector
 */
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AnalyticsDashboard } from "@/components/analytics/AnalyticsDashboard";
import { cn } from "@/lib/utils";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { PageShell } from "@/v2/ui/templates/PageShell";

type DateRangePreset = "7d" | "30d" | "90d" | "custom";

export function AnalyticsPage() {
  const [preset, setPreset] = useState<DateRangePreset>("30d");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");

  const dateRange = useMemo(() => {
    const to = new Date();
    to.setHours(23, 59, 59, 999);

    let from = new Date();

    switch (preset) {
      case "7d":
        from.setDate(from.getDate() - 7);
        break;
      case "30d":
        from.setDate(from.getDate() - 30);
        break;
      case "90d":
        from.setDate(from.getDate() - 90);
        break;
      case "custom":
        if (customStartDate) {
          from = new Date(customStartDate);
          from.setHours(0, 0, 0, 0);
        }
        break;
    }

    from.setHours(0, 0, 0, 0);
    return { from, to };
  }, [preset, customStartDate, customEndDate]);

  const handlePreviousPeriod = () => {
    const daysDiff = Math.floor(
      (dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24)
    );
    const newTo = new Date(dateRange.from);
    const newFrom = new Date(dateRange.from);
    newFrom.setDate(newFrom.getDate() - daysDiff);
    setCustomStartDate(newFrom.toISOString().split("T")[0]);
    setCustomEndDate(newTo.toISOString().split("T")[0]);
    setPreset("custom");
  };

  const handleNextPeriod = () => {
    const daysDiff = Math.floor(
      (dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24)
    );
    const newFrom = new Date(dateRange.to);
    const newTo = new Date(dateRange.to);
    newTo.setDate(newTo.getDate() + daysDiff);
    setCustomStartDate(newFrom.toISOString().split("T")[0]);
    setCustomEndDate(newTo.toISOString().split("T")[0]);
    setPreset("custom");
  };

  const formattedDateRange = `${dateRange.from.toLocaleDateString("it-IT")} - ${dateRange.to.toLocaleDateString("it-IT")}`;

  return (
    <div data-testid="page-analytics" className="h-full min-h-0 overflow-y-auto">
      <PageShell
        title={<span className="inline-flex items-center gap-2"><Calendar className="h-5 w-5" /> Analisi</span>}
        description="Metriche e KPI dei tuoi dati di outreach, partner e AI."
        width="wide"
        toolbar={
          <>
            <div className="flex gap-2 flex-wrap">
              {["7d", "30d", "90d"].map((p) => (
                <Button
                  key={p}
                  variant={preset === p ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPreset(p as DateRangePreset)}
                  className={cn(
                    "transition-all",
                    preset === p && "shadow-md"
                  )}
                >
                  {p === "7d" ? "7 giorni" : p === "30d" ? "30 giorni" : "90 giorni"}
                </Button>
              ))}
            </div>
            <div className="flex gap-1 items-center flex-wrap ml-auto">
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePreviousPeriod}
                title="Periodo precedente"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="text-xs text-muted-foreground px-2 py-1 bg-muted/50 rounded whitespace-nowrap">
                {formattedDateRange}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNextPeriod}
                title="Periodo successivo"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button
                variant={preset === "custom" ? "default" : "outline"}
                size="sm"
                onClick={() => setPreset("custom")}
                className="transition-all"
              >
                Personalizzato
              </Button>
            </div>
          </>
        }
      >
        {preset === "custom" && (
          <div className="rounded-xl border border-border bg-card/60 px-3 py-2 flex gap-2 items-center flex-wrap">
              <span className="text-xs text-muted-foreground">Dal:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-2 py-1 text-xs rounded border border-border/50 bg-background text-foreground"
              />
              <span className="text-xs text-muted-foreground">Al:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-2 py-1 text-xs rounded border border-border/50 bg-background text-foreground"
              />
          </div>
          )}
        <AnalyticsDashboard dateRange={dateRange} />
      </PageShell>
    </div>
  );
}
