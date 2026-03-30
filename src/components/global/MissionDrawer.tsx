import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Target } from "lucide-react";
import GoalBar from "@/components/workspace/GoalBar";
import { useMission } from "@/contexts/MissionContext";

interface MissionDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MissionDrawer({ open, onOpenChange }: MissionDrawerProps) {
  const m = useMission();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[380px] sm:max-w-[420px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-sm">
            <Target className="w-4 h-4 text-primary" />
            Mission Context
          </SheetTitle>
        </SheetHeader>
        <div className="mt-4">
          <GoalBar
            goal={m.goal}
            baseProposal={m.baseProposal}
            onGoalChange={m.setGoal}
            onBaseProposalChange={m.setBaseProposal}
            documents={m.documents}
            onUploadDocument={m.upload}
            onRemoveDocument={m.removeDocument}
            uploading={m.uploading}
            referenceLinks={m.referenceLinks}
            onAddLink={(url) => m.setReferenceLinks((prev) => [...prev, url])}
            onRemoveLink={(idx) => m.setReferenceLinks((prev) => prev.filter((_, i) => i !== idx))}
            presets={m.presets}
            activePresetId={m.activePresetId}
            onLoadPreset={m.loadPreset}
            onSavePreset={m.savePreset}
            onDeletePreset={m.deletePreset}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
