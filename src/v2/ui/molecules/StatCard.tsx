/**
 * StatCard molecule — STEP 4 Design System v2
 */

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  readonly title: string;
  readonly value: string | number;
  readonly icon?: React.ReactNode;
  readonly trend?: { readonly direction: "up" | "down" | "flat"; readonly label: string };
  readonly className?: string;
}

const trendColors = {
  up: "text-green-600 dark:text-green-400",
  down: "text-red-600 dark:text-red-400",
  flat: "text-muted-foreground",
};

export function StatCard({ title, value, icon, trend, className }: StatCardProps): React.ReactElement {
  return (
    <Card className={cn(className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon ? <div className="text-muted-foreground">{icon}</div> : null}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {trend ? (
          <p className={cn("text-xs mt-1", trendColors[trend.direction])}>
            {trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "→"} {trend.label}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
