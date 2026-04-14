import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";
import { MissionWidgetRenderer } from "@/components/missions/MissionChatWidgets";
import type { MissionStepData } from "@/components/missions/MissionStepRenderer";
import type { MissionPlan } from "@/hooks/useMissionActions";
import type { Msg } from "./useMissionBuilder";
import type { RefObject } from "react";

interface BuilderChatInterfaceProps {
  messages: Msg[];
  isChatLoading: boolean;
  chatScrollRef: RefObject<HTMLDivElement>;
  stepData: MissionStepData;
  onSetStepData: (data: MissionStepData) => void;
  countryStats: { code: string; name: string; count: number; withEmail: number }[];
  onLaunch: () => void;
  onPlanApprove: () => void;
  onPlanCancel: () => void;
  pendingPlan: MissionPlan | null;
  isApproving: boolean;
}

export function BuilderChatInterface({
  messages, isChatLoading, chatScrollRef,
  stepData, onSetStepData, countryStats,
  onLaunch, onPlanApprove, onPlanCancel,
  pendingPlan, isApproving,
}: BuilderChatInterfaceProps) {
  return (
    <ScrollArea className="flex-1 p-4" ref={chatScrollRef}>
      <div className="max-w-2xl mx-auto space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${
              m.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border border-border"
            }`}>
              {m.role === "assistant" ? (
                <>
                  <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:my-1">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                  {m.widgets && m.widgets.length > 0 && (
                    <MissionWidgetRenderer widgets={m.widgets} stepData={stepData} onChange={onSetStepData}
                      countryStats={countryStats} onLaunch={onLaunch} onPlanApprove={onPlanApprove} onPlanCancel={onPlanCancel}
                      planReviewProps={pendingPlan ? { plan: pendingPlan, isApproving } : undefined}
                    />
                  )}
                </>
              ) : m.content}
            </div>
          </div>
        ))}
        {isChatLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex justify-start">
            <div className="bg-card border border-border rounded-xl px-3 py-2">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-bounce" />
                <span className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-bounce [animation-delay:0.15s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-bounce [animation-delay:0.3s]" />
              </div>
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
