/**
 * Slide-over panel with full deal details, activity timeline, and edit form
 */
import React, { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { useUpdateDeal, useDealActivities } from "@/hooks/useDeals";
import type { DealWithRelations, DealStage, DealActivity } from "@/hooks/useDeals";
import { X, Calendar, User, DollarSign, TrendingUp } from "lucide-react";

interface DealDetailSheetProps {
  deal: DealWithRelations | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STAGES: { value: DealStage; label: string; color: string }[] = [
  { value: "lead", label: "Lead", color: "bg-gray-100 dark:bg-gray-800" },
  { value: "qualified", label: "Qualificato", color: "bg-blue-100 dark:bg-blue-900" },
  { value: "proposal", label: "Proposta", color: "bg-purple-100 dark:bg-purple-900" },
  { value: "negotiation", label: "Negoziazione", color: "bg-amber-100 dark:bg-amber-900" },
  { value: "won", label: "Vinto", color: "bg-green-100 dark:bg-green-900" },
  { value: "lost", label: "Perso", color: "bg-red-100 dark:bg-red-900" },
];

export function DealDetailSheet({ deal, open, onOpenChange }: DealDetailSheetProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState<Partial<DealWithRelations>>({});
  const { mutate: updateDeal, isPending } = useUpdateDeal();
  const { data: activities } = useDealActivities(deal?.id || "");

  React.useEffect(() => {
    if (deal) {
      setEditValues(deal);
    }
  }, [deal, open]);

  const handleSave = () => {
    if (!deal) return;

    updateDeal(
      { id: deal.id, updates: editValues as any },
      {
        onSuccess: () => {
          toast.success("Affare aggiornato");
          setIsEditing(false);
        },
        onError: () => {
          toast.error("Errore nell'aggiornamento");
        },
      }
    );
  };

  if (!deal) return null;

  const stageInfo = STAGES.find((s) => s.value === deal.stage);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:w-[540px] overflow-y-auto">
        <SheetHeader className="mb-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <SheetTitle className="text-2xl">{deal.title}</SheetTitle>
              {deal.partner && (
                <p className="text-sm text-muted-foreground mt-2">{deal.partner.company_name}</p>
              )}
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </SheetHeader>

        <div className="space-y-6">
          {/* Stage & Amount */}
          <Card className="p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Fase</label>
                {isEditing ? (
                  <Select
                    value={editValues.stage || deal.stage}
                    onValueChange={(value) =>
                      setEditValues({ ...editValues, stage: value as DealStage })
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STAGES.map((stage) => (
                        <SelectItem key={stage.value} value={stage.value}>
                          {stage.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge className={`mt-1 ${stageInfo?.color || ""}`}>
                    {stageInfo?.label || deal.stage}
                  </Badge>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <DollarSign className="w-3 h-3" /> Importo
                </label>
                {isEditing ? (
                  <Input
                    type="number"
                    value={editValues.amount || 0}
                    onChange={(e) =>
                      setEditValues({ ...editValues, amount: parseFloat(e.target.value) || 0 })
                    }
                    className="mt-1"
                  />
                ) : (
                  <p className="mt-1 font-bold text-lg">
                    {formatCurrency(deal.amount, deal.currency)}
                  </p>
                )}
              </div>
            </div>
          </Card>

          {/* Probability & Expected Close */}
          <Card className="p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> Probabilità
                </label>
                {isEditing ? (
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={editValues.probability || 50}
                    onChange={(e) =>
                      setEditValues({
                        ...editValues,
                        probability: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)),
                      })
                    }
                    className="mt-1"
                  />
                ) : (
                  <p className="mt-1 font-bold text-lg">{deal.probability}%</p>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Chiusura prevista
                </label>
                {isEditing ? (
                  <Input
                    type="date"
                    value={editValues.expected_close_date || ""}
                    onChange={(e) =>
                      setEditValues({ ...editValues, expected_close_date: e.target.value || null })
                    }
                    className="mt-1"
                  />
                ) : (
                  <p className="mt-1 text-sm">
                    {deal.expected_close_date
                      ? new Date(deal.expected_close_date).toLocaleDateString("it-IT")
                      : "—"}
                  </p>
                )}
              </div>
            </div>
          </Card>

          {/* Description */}
          <Card className="p-4">
            <label className="text-xs font-semibold text-muted-foreground">Descrizione</label>
            {isEditing ? (
              <textarea
                value={editValues.description || ""}
                onChange={(e) =>
                  setEditValues({ ...editValues, description: e.target.value || null })
                }
                className="w-full mt-2 p-2 border rounded bg-background text-foreground text-sm min-h-[100px]"
              />
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                {deal.description || "Nessuna descrizione"}
              </p>
            )}
          </Card>

          {/* Activity Timeline */}
          <Card className="p-4">
            <h3 className="font-semibold text-sm mb-4">Timeline attività</h3>
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {activities && activities.length > 0 ? (
                activities.map((activity) => (
                  <div key={activity.id} className="flex gap-3 text-sm">
                    <div className="flex-shrink-0 w-2 h-2 rounded-full bg-primary mt-1.5" />
                    <div className="flex-1">
                      <p className="font-medium text-foreground capitalize">
                        {activity.activity_type.replace("_", " ")}
                      </p>
                      {activity.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{activity.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(activity.created_at).toLocaleDateString("it-IT")}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">Nessuna attività</p>
              )}
            </div>
          </Card>

          {/* Actions */}
          <div className="flex gap-2 pt-4 border-t">
            {!isEditing ? (
              <Button onClick={() => setIsEditing(true)} className="flex-1">
                Modifica
              </Button>
            ) : (
              <>
                <Button onClick={handleSave} disabled={isPending} className="flex-1">
                  Salva
                </Button>
                <Button onClick={() => setIsEditing(false)} variant="outline" className="flex-1">
                  Annulla
                </Button>
              </>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
