/**
 * Kanban board view of deals pipeline
 */
import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DealCard } from "./DealCard";
import { DealDetailSheet } from "./DealDetailSheet";
import { formatCurrency } from "@/lib/utils";
import { useDealsByStage, useUpdateDeal } from "@/hooks/useDeals";
import type { DealWithRelations, DealStage } from "@/hooks/useDeals";

const STAGES: { value: DealStage; label: string; color: string }[] = [
  { value: "lead", label: "Lead", color: "bg-gray-50 dark:bg-gray-900" },
  { value: "qualified", label: "Qualificato", color: "bg-blue-50 dark:bg-blue-950" },
  { value: "proposal", label: "Proposta", color: "bg-purple-50 dark:bg-purple-950" },
  { value: "negotiation", label: "Negoziazione", color: "bg-amber-50 dark:bg-amber-950" },
  { value: "won", label: "Vinto", color: "bg-green-50 dark:bg-green-950" },
  { value: "lost", label: "Perso", color: "bg-red-50 dark:bg-red-950" },
];

interface DealPipelineProps {
  searchTerm?: string;
}

export function DealPipeline({ searchTerm }: DealPipelineProps) {
  const [selectedDeal, setSelectedDeal] = useState<DealWithRelations | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draggedDeal, setDraggedDeal] = useState<DealWithRelations | null>(null);
  const { data: dealsByStage, isLoading } = useDealsByStage();
  const { mutate: updateDeal } = useUpdateDeal();

  const handleDragStart = (deal: DealWithRelations) => {
    setDraggedDeal(deal);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (stage: DealStage) => {
    if (draggedDeal && draggedDeal.stage !== stage) {
      updateDeal({
        id: draggedDeal.id,
        updates: { stage },
      });
      setDraggedDeal(null);
    }
  };

  const filterDeals = (deals: DealWithRelations[]) => {
    if (!searchTerm) return deals;
    const term = searchTerm.toLowerCase();
    return deals.filter(
      (d) =>
        d.title.toLowerCase().includes(term) ||
        d.description?.toLowerCase().includes(term) ||
        d.partner?.company_name.toLowerCase().includes(term)
    );
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 2xl:grid-cols-6 gap-4">
        {STAGES.map((stage) => (
          <div key={stage.value} className="space-y-2">
            <div className="h-8 bg-muted rounded animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 2xl:grid-cols-6 gap-4 overflow-x-auto">
        {STAGES.map((stage) => {
          const stageData = dealsByStage?.get(stage.value);
          if (!stageData) return null;

          const filteredDeals = filterDeals(stageData.deals);

          return (
            <div
              key={stage.value}
              className={`flex flex-col h-full min-w-[300px] rounded-lg border-2 border-dashed border-muted p-4 ${stage.color} transition-colors`}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(stage.value)}
            >
              {/* Column Header */}
              <div className="mb-4 pb-3 border-b">
                <h3 className="font-semibold text-foreground">{stage.label}</h3>
                <div className="flex items-center justify-between mt-2 text-sm text-muted-foreground">
                  <span>{filteredDeals.length} deal</span>
                  <span className="font-semibold text-foreground">
                    {formatCurrency(
                      filteredDeals.reduce((sum, d) => sum + (d.amount || 0), 0),
                      "EUR"
                    )}
                  </span>
                </div>
              </div>

              {/* Deals */}
              <div className="flex-1 space-y-3 overflow-y-auto">
                {filteredDeals.length === 0 ? (
                  <Card className="p-4 text-center text-sm text-muted-foreground bg-background/50">
                    Nessun affare
                  </Card>
                ) : (
                  filteredDeals.map((deal) => (
                    <div
                      key={deal.id}
                      draggable
                      onDragStart={() => handleDragStart(deal)}
                      onDragEnd={() => setDraggedDeal(null)}
                      onClick={() => {
                        setSelectedDeal(deal);
                        setSheetOpen(true);
                      }}
                      className="cursor-grab active:cursor-grabbing"
                    >
                      <DealCard deal={deal} isDragging={draggedDeal?.id === deal.id} />
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      <DealDetailSheet deal={selectedDeal} open={sheetOpen} onOpenChange={setSheetOpen} />
    </>
  );
}
