/**
 * CampaignGoalDialog — Goal picker before sending to Cockpit
 */
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Target, Send } from "lucide-react";
import { CAMPAIGN_GOALS, type CampaignPartner } from "./useCampaignData";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignPartners: CampaignPartner[];
  selectedGoal: string;
  onGoalChange: (goal: string) => void;
  onConfirm: () => void;
}

export function CampaignGoalDialog({ open, onOpenChange, campaignPartners, selectedGoal, onGoalChange, onConfirm }: Props) {
  const bcaCount = campaignPartners.filter((p) => p.has_bca).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <Target className="w-5 h-5" />
            Seleziona Goal Campagna
          </DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-3">
            {campaignPartners.length} aziende saranno inviate al Cockpit con il goal selezionato.
            {bcaCount > 0 && (
              <span className="text-primary ml-1">
                ({bcaCount} incontrate di persona)
              </span>
            )}
          </p>
          <Select value={selectedGoal} onValueChange={onGoalChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CAMPAIGN_GOALS.map((g) => (
                <SelectItem key={g.value} value={g.value}>
                  {g.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button onClick={onConfirm} className="space-button-primary">
            <Send className="w-4 h-4 mr-1.5" />
            Invia al Cockpit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
