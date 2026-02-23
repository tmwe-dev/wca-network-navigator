import { useState } from "react";
import GoalBar from "@/components/workspace/GoalBar";
import ContactListPanel from "@/components/workspace/ContactListPanel";
import EmailCanvas from "@/components/workspace/EmailCanvas";
import { type AllActivity } from "@/hooks/useActivities";
import { Sparkles } from "lucide-react";

export default function Workspace() {
  const [selectedActivity, setSelectedActivity] = useState<AllActivity | null>(null);
  const [goal, setGoal] = useState("");
  const [baseProposal, setBaseProposal] = useState("");

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-4 pb-2">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Email Workspace</h1>
            <p className="text-xs text-muted-foreground">
              Genera email personalizzate con AI per ogni partner
            </p>
          </div>
        </div>
        <GoalBar
          goal={goal}
          baseProposal={baseProposal}
          onGoalChange={setGoal}
          onBaseProposalChange={setBaseProposal}
        />
      </div>

      {/* Split panel */}
      <div className="flex-1 flex overflow-hidden px-6 pb-4 pt-3 gap-4">
        {/* Left: Contact list */}
        <div className="w-[380px] shrink-0 rounded-xl border border-border/50 bg-card/60 backdrop-blur-xl overflow-hidden flex flex-col">
          <ContactListPanel
            selectedActivityId={selectedActivity?.id || null}
            onSelect={setSelectedActivity}
          />
        </div>

        {/* Right: Email canvas */}
        <div className="flex-1 rounded-xl border border-border/50 bg-card/60 backdrop-blur-xl overflow-hidden flex flex-col">
          <EmailCanvas
            activity={selectedActivity}
            goal={goal}
            baseProposal={baseProposal}
          />
        </div>
      </div>
    </div>
  );
}
