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
    <div
      data-testid="page-analytics"
      className="h-full min-h-0 overflow-hidden bg-background text-foreground flex flex-col"
    >
      {/* Header */}
      <div className="border-b border-border/50 bg-card/50 backdrop-blur-sm p-4 sm:p-6">
        <div className="max-w-7xl mx-auto space-y-4">
          {/* Title */}
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Calendar className="w-6 h-6" />
              Analisi
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Metriche e KPI dei tuoi dati di outreach, partner e AI
            </p>
          </div>

          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            {/* Preset buttons */}
            <div className="flex gap-2">
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

            {/* Date selector and navigation */}
            <div className="flex gap-2 items-center flex-wrap">
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
          </div>

          {/* Custom date inputs */}
          {preset === "custom" && (
            <div className="flex gap-2 items-center flex-wrap pt-2 border-t border-border/30">
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
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <AnalyticsDashboard dateRange={dateRange} />
      </div>
    </div>
  );
}
