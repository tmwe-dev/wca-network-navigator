/**
 * Dialog to create a new deal
 */
import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useCreateDeal } from "@/hooks/useDeals";
import type { DealStage } from "@/hooks/useDeals";

interface CreateDealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partnerIdDefault?: string;
  contactIdDefault?: string;
}

const STAGES: { value: DealStage; label: string }[] = [
  { value: "lead", label: "Lead" },
  { value: "qualified", label: "Qualificato" },
  { value: "proposal", label: "Proposta" },
  { value: "negotiation", label: "Negoziazione" },
  { value: "won", label: "Vinto" },
  { value: "lost", label: "Perso" },
];

export function CreateDealDialog({
  open,
  onOpenChange,
  partnerIdDefault,
  contactIdDefault,
}: CreateDealDialogProps) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    stage: "lead" as DealStage,
    amount: 0,
    currency: "EUR",
    probability: 10,
    expected_close_date: "",
    partner_id: partnerIdDefault || null,
    contact_id: contactIdDefault || null,
    tags: [] as string[],
  });

  const { mutate: createDeal, isPending } = useCreateDeal();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast.error("Inserisci il titolo dell'affare");
      return;
    }

    createDeal(
      {
        title: formData.title,
        description: formData.description || null,
        stage: formData.stage,
        amount: formData.amount,
        currency: formData.currency,
        probability: formData.probability,
        expected_close_date: formData.expected_close_date || null,
        partner_id: formData.partner_id || null,
        contact_id: formData.contact_id || null,
        tags: formData.tags,
        metadata: {},
        lost_reason: null,
        actual_close_date: null,
      },
      {
        onSuccess: () => {
          toast.success("Affare creato con successo");
          onOpenChange(false);
          setFormData({
            title: "",
            description: "",
            stage: "lead",
            amount: 0,
            currency: "EUR",
            probability: 10,
            expected_close_date: "",
            partner_id: partnerIdDefault || null,
            contact_id: contactIdDefault || null,
            tags: [],
          });
        },
        onError: () => {
          toast.error("Errore nella creazione dell'affare");
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Nuovo Affare</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="text-sm font-medium">Titolo *</label>
            <Input
              placeholder="Es: Proposta spedizione merci"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              disabled={isPending}
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium">Descrizione</label>
            <textarea
              placeholder="Dettagli aggiuntivi..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              disabled={isPending}
              className="w-full p-2 border rounded bg-background text-foreground text-sm min-h-[80px]"
            />
          </div>

          {/* Stage */}
          <div>
            <label className="text-sm font-medium">Fase</label>
            <Select value={formData.stage} onValueChange={(v) => setFormData({ ...formData, stage: v as DealStage })}>
              <SelectTrigger disabled={isPending}>
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
          </div>

          {/* Amount & Currency */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-sm font-medium">Importo</label>
              <Input
                type="number"
                placeholder="0"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                disabled={isPending}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Valuta</label>
              <Select value={formData.currency} onValueChange={(v) => setFormData({ ...formData, currency: v })}>
                <SelectTrigger disabled={isPending}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Probability */}
          <div>
            <label className="text-sm font-medium">Probabilità ({formData.probability}%)</label>
            <input
              type="range"
              min="0"
              max="100"
              value={formData.probability}
              onChange={(e) => setFormData({ ...formData, probability: parseInt(e.target.value) })}
              disabled={isPending}
              className="w-full"
            />
          </div>

          {/* Expected Close Date */}
          <div>
            <label className="text-sm font-medium">Chiusura prevista</label>
            <Input
              type="date"
              value={formData.expected_close_date}
              onChange={(e) => setFormData({ ...formData, expected_close_date: e.target.value })}
              disabled={isPending}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={isPending} className="flex-1">
              {isPending ? "Creazione..." : "Crea Affare"}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending} className="flex-1">
              Annulla
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
