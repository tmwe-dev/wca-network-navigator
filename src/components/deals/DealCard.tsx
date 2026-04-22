/**
 * Individual deal card for pipeline view
 */
import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import type { DealWithRelations } from "@/hooks/useDeals";

interface DealCardProps {
  deal: DealWithRelations;
  onClick?: (deal: DealWithRelations) => void;
  isDragging?: boolean;
}

export function DealCard({ deal, onClick, isDragging }: DealCardProps) {
  const getProbabilityColor = (probability: number) => {
    if (probability >= 75) return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    if (probability >= 50) return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    if (probability >= 25) return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200";
    return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
  };

  const formatDate = (date: string | null) => {
    if (!date) return null;
    return new Date(date).toLocaleDateString("it-IT", { month: "short", day: "numeric" });
  };

  return (
    <Card
      onClick={() => onClick?.(deal)}
      className={`p-4 cursor-pointer transition-all ${
        isDragging ? "opacity-50" : "hover:shadow-lg hover:border-primary"
      } ${deal.stage === "lost" ? "bg-red-50/50 dark:bg-red-950/20" : ""}
      ${deal.stage === "won" ? "bg-green-50/50 dark:bg-green-950/20" : ""}`}
    >
      <div className="space-y-3">
        {/* Title */}
        <div className="space-y-1">
          <h3 className="font-semibold text-sm line-clamp-2 text-foreground">{deal.title}</h3>
          {deal.partner && (
            <p className="text-xs text-muted-foreground">{deal.partner.company_name}</p>
          )}
        </div>

        {/* Amount */}
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold text-foreground">
            {formatCurrency(deal.amount, deal.currency)}
          </span>
          <Badge variant="outline" className={getProbabilityColor(deal.probability)}>
            {deal.probability}%
          </Badge>
        </div>

        {/* Expected close date */}
        {deal.expected_close_date && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Chiusura prevista:</span>
            <span>{formatDate(deal.expected_close_date)}</span>
          </div>
        )}

        {/* Tags */}
        {deal.tags && deal.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {deal.tags.slice(0, 2).map((tag, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
            {deal.tags.length > 2 && (
              <Badge variant="secondary" className="text-xs">
                +{deal.tags.length - 2}
              </Badge>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
