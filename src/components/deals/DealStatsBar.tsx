/**
 * Top bar with KPIs for deals pipeline
 */
import React from "react";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { useDealStats } from "@/hooks/useDeals";
import { TrendingUp, Target, Calendar, Percent, DollarSign, Package } from "lucide-react";

const KPI_ITEMS = [
  {
    icon: DollarSign,
    label: "Valore Pipeline",
    key: "totalPipelineValue" as const,
    suffix: "",
    description: "Valore totale deal aperti",
  },
  {
    icon: TrendingUp,
    label: "Previsione Ponderata",
    key: "weightedForecast" as const,
    suffix: "",
    description: "Valore previsto con probabilità",
  },
  {
    icon: Calendar,
    label: "Deal Questo Mese",
    key: "dealsThisMonth" as const,
    suffix: "",
    description: "Deal creati negli ultimi 30 giorni",
  },
  {
    icon: Percent,
    label: "Tasso Vincita",
    key: "winRate" as const,
    suffix: "%",
    description: "Percentuale deal vinti su chiusi",
  },
  {
    icon: Package,
    label: "Deal Medio",
    key: "avgDealSize" as const,
    suffix: "",
    description: "Valore medio per deal",
  },
];

export function DealStatsBar() {
  const { data: stats, isLoading } = useDealStats();

  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {KPI_ITEMS.map((item) => (
          <Card key={item.key} className="p-4 animate-pulse">
            <div className="h-4 bg-muted rounded w-3/4 mb-3" />
            <div className="h-6 bg-muted rounded w-1/2" />
          </Card>
        ))}
      </div>
    );
  }

  const formatValue = (key: string, value: number): string => {
    switch (key) {
      case "totalPipelineValue":
      case "weightedForecast":
      case "avgDealSize":
        return formatCurrency(value, "EUR");
      case "dealsThisMonth":
        return value.toString();
      case "winRate":
        return `${value.toFixed(1)}%`;
      default:
        return value.toString();
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {KPI_ITEMS.map((item) => {
        const Icon = item.icon;
        const value = stats[item.key];

        return (
          <Card
            key={item.key}
            className="p-4 hover:shadow-md transition-shadow bg-card border-border"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {item.label}
                </p>
                <p className="text-2xl font-bold text-foreground mt-2">
                  {formatValue(item.key, value as number)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
              </div>
              <Icon className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-1" />
            </div>
          </Card>
        );
      })}
    </div>
  );
}
